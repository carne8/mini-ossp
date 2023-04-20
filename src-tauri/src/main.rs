// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use librespot::connect::context::StationContext;
use librespot::core::SpotifyId;
use std::cell::Cell;
use std::env;
use std::future::Future;
use std::ops::Deref;
use std::sync::{Arc, Mutex};

use librespot;
use librespot::connect::config::ConnectConfig;
use librespot::connect::spirc::{self, Spirc, SpircLoadCommand};
use librespot::core::authentication::Credentials;
use librespot::core::config::SessionConfig;
use librespot::core::session::{Session, SessionError};
use librespot::discovery::{DeviceType, Discovery};
use librespot::metadata::{Album, Metadata};
use librespot::playback::audio_backend::Sink;
use librespot::playback::config::{AudioFormat, PlayerConfig};
use librespot::playback::mixer::softmixer::SoftMixer;
use librespot::playback::mixer::{Mixer, MixerConfig, NoOpVolume, VolumeGetter};
use librespot::playback::player::Player;
use librespot::playback::{audio_backend, player};
use librespot::protocol::spirc::TrackRef;
use sha1::{Digest, Sha1};
use tokio::join;

struct AppState {
    credentials: Mutex<Option<librespot::discovery::Credentials>>,
    audio_backend: Mutex<fn(Option<String>, AudioFormat) -> Box<dyn Sink>>,
    player: Mutex<Option<Spirc>>,
}

impl AppState {
    fn default() -> AppState {
        AppState {
            credentials: Mutex::new(None),
            audio_backend: Mutex::new(audio_backend::find(None).unwrap()),
            player: Mutex::new(None),
        }
    }
}

fn device_id(name: &str) -> String {
    hex::encode(Sha1::digest(name.as_bytes()))
}
const SCOPES: &str =
    "streaming,user-read-playback-state,user-modify-playback-state,user-read-currently-playing";

#[tauri::command]
async fn login(
    username: String,
    password: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let credentials = Credentials::with_password(username, password);
    let res = Session::new(SessionConfig::default(), None)
        .connect(credentials.clone(), false)
        .await;

    match res {
        Ok(_) => {
            *state.credentials.lock().unwrap() = Some(credentials);
            Ok(())
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
async fn start_spotify_connect(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let credentials = state.credentials.lock().unwrap().to_owned();
    let backend = *state.audio_backend.lock().unwrap();

    let session_config = SessionConfig::default();
    let player_config = PlayerConfig::default();
    let audio_format = AudioFormat::default();
    let connect_config = ConnectConfig {
        name: "Mini Spotify".to_string(),
        device_type: DeviceType::Observer,
        initial_volume: Some(50),
        has_volume_ctrl: true,
    };

    match credentials {
        Some(_) => (),
        None => return Err("Not logged.".to_string()),
    };

    let session = Session::new(session_config, None);

    let player = Player::new(
        player_config,
        session.clone(),
        Box::new(NoOpVolume),
        move || backend(None, audio_format),
    );

    let player_res = Spirc::new(
        connect_config,
        session.clone(),
        credentials.unwrap(),
        player,
        Box::new(SoftMixer::open(MixerConfig::default())),
    )
    .await;

    match player_res {
        Err(error) => Err(error.to_string()),
        Ok((spirc, spirc_task)) => {
            join!(spirc_task, async {
                let activation_res = spirc.activate().map_err(|err| err.to_string());
                *state.player.lock().unwrap() = Some(spirc);
                activation_res
            }).1
        }
    }
}

#[tauri::command]
fn play(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let player_opt = state.player.lock().unwrap();
    match player_opt.deref() {
        Some(player) => {
            player.play().map_err(|err| err.to_string())
        },
        None => return Err("Player not started".to_string()),
    }
}

#[tauri::command]
fn pause(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let player_opt = state.player.lock().unwrap();
    match player_opt.deref() {
        Some(player) => {
            player.pause().map_err(|err| err.to_string())
        },
        None => Err("Player not started".to_string()),
    }
}

// let album = Album::get(&session, &SpotifyId::from_uri(&context_uri).unwrap())
//     .await
//     .unwrap();

// let tracks = album
//     .tracks()
//     .map(|track_id| {
//         let mut track = TrackRef::new();
//         track.set_gid(Vec::from(track_id.to_raw()));
//         track
//     })
//     .collect();

// spirc.activate().unwrap();
// let load_command = SpircLoadCommand {
//     context_uri,
//     start_playing: true,
//     shuffle: false,
//     repeat: false,
//     playing_track_index: 0,
//     tracks,
// };

// spirc.load(load_command).unwrap();
// // err.map(|err| println!("{}", err.to_string()));

// spirc.play().unwrap();

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            login,
            start_spotify_connect,
            play,
            pause
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
