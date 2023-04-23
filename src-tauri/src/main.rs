// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::sync::Mutex;

use futures::StreamExt;
use librespot::core::SpotifyId;
use librespot::metadata::{Metadata, Track};
use librespot::playback::mixer::Mixer;
use librespot::playback::player::PlayerEvent;
use librespot::{
    connect::{config::ConnectConfig, spirc::Spirc},
    core::{Session, SessionConfig},
    discovery,
    playback::{
        self,
        config::{AudioFormat, PlayerConfig},
        mixer::{softmixer::SoftMixer, MixerConfig, NoOpVolume},
        player::Player,
    },
};
use sha1::{Digest, Sha1};

struct DiscoveryStarted(Mutex<bool>);
struct CurrentPlayer(Mutex<Option<Spirc>>);
impl Default for CurrentPlayer {
    fn default() -> Self {
        CurrentPlayer(Mutex::new(None))
    }
}

const CDN_URL: &str = "https://i.scdn.co/image/";

fn create_session(name: &str) -> Session {
    let device_id = hex::encode(Sha1::digest(name.as_bytes()));
    let client_id = String::from("76e0a38d911846b89f1e8f31e0718da7");

    let config = SessionConfig {
        client_id,
        device_id,
        ..SessionConfig::default()
    };

    Session::new(config, None)
}

fn create_player(session: Session) -> Player {
    let config = PlayerConfig::default();
    let backend = playback::audio_backend::find(None).unwrap();
    let audio_format = AudioFormat::default();

    Player::new(config, session, Box::new(NoOpVolume), move || {
        backend(None, audio_format)
    })
}

async fn load_track_data(session: &Session, track_id: &SpotifyId) -> String {
    let track = Track::get(session, track_id).await.unwrap();

    let album_cover_file_id = track.album.covers.0[0].id;
    let album_cover_url = format!("{}{}", CDN_URL, album_cover_file_id.to_string());

    let artists = track
        .artists
        .0
        .iter()
        .map(|artist| artist.name.to_owned())
        .collect::<Vec<String>>()
        .join(", ");

    [track.name, artists, track.album.name, album_cover_url].join("|separator|")
}


#[tauri::command]
async fn start_spotify_connect(
    window: tauri::window::Window,
    discovery_started: tauri::State<'_, DiscoveryStarted>,
    app_player: tauri::State<'_, CurrentPlayer>,
) -> Result<(), String> {
    if discovery_started.0.lock().unwrap().to_owned() {
        return Ok(())
    }

    let name = "Mini Spotify";
    let device_id = hex::encode(Sha1::digest(name.as_bytes()));
    let client_id = String::from("76e0a38d911846b89f1e8f31e0718da7");

    let connect_config = ConnectConfig {
        name: "Mini Spotify".to_string(),
        device_type: discovery::DeviceType::Observer,
        initial_volume: Some(50),
        has_volume_ctrl: true,
    };

    let mut server = librespot::discovery::Discovery::builder(device_id, client_id)
        .name(name)
        .device_type(discovery::DeviceType::Computer)
        .launch()
        .unwrap();
    let credentials = server.next().await.unwrap();

    let session = create_session(&name);
    let session_ = session.clone();
    let player = create_player(session.clone());
    let mut event_channel = player.get_player_event_channel();

    tokio::spawn(async move {
        while let Some(event) = event_channel.recv().await {
            match event {
                PlayerEvent::Paused { .. } => _ = window.emit("player_event", "paused"),
                PlayerEvent::Playing { track_id, .. } => {
                    let track_data = load_track_data(&session_, &track_id).await;
                    _ = window.emit(
                        "player_event",
                        String::from("playing:") + track_data.as_str(),
                    );
                }
                PlayerEvent::Loading { track_id, .. } => {
                    let track_data = load_track_data(&session_, &track_id).await;
                    _ = window.emit(
                        "player_event",
                        String::from("loaded:") + track_data.as_str(),
                    );
                }
                _ => ()
            };
        }
    });

    let spirc_res = Spirc::new(
        connect_config,
        session.clone(),
        credentials,
        player,
        Box::new(SoftMixer::open(MixerConfig::default())),
    )
    .await;

    let (spirc, spirc_task) = match spirc_res {
        Ok((spirc, spirc_task)) => (spirc, Box::pin(spirc_task)),
        Err(error) => return Err(format!("Failed to start spirc: {}", error)),
    };

    tokio::spawn(spirc_task);

    *app_player.0.lock().unwrap() = Some(spirc);
    *discovery_started.0.lock().unwrap() = true;

    Ok(())
}

#[tauri::command]
fn player_command(command: String, player: tauri::State<'_, CurrentPlayer>) -> Result<(), String> {
    let player_opt = player.0.lock().unwrap();

    player_opt
        .as_ref()
        .map(|spirc| {
            match command.as_str() {
                "play" => spirc.play(),
                "pause" => spirc.pause(),
                "next" => spirc.next(),
                "prev" => spirc.prev(),
                _ => Ok(()),
            }
            .map_err(|err| err.to_string())
        })
        .unwrap_or_else(|| Err(String::from("Player not started.")))
}

fn main() {
    tauri::Builder::default()
        .manage(CurrentPlayer::default())
        .manage(DiscoveryStarted(Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            start_spotify_connect,
            player_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
