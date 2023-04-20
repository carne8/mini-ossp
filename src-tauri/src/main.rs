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

use librespot::{
    connect::spirc::Spirc,
    playback::{audio_backend::Sink, config::AudioFormat},
};
use std::sync::Mutex;

pub struct AppCredentials(Mutex<Option<librespot::discovery::Credentials>>);
pub struct AppAudioBackend(Mutex<fn(Option<String>, AudioFormat) -> Box<dyn Sink>>);
pub struct AppPlayer(Mutex<Option<Spirc>>);

impl AppCredentials {
    pub fn new(value: Option<librespot::discovery::Credentials>) -> AppCredentials {
        AppCredentials(Mutex::new(value))
    }
}
impl AppAudioBackend {
    pub fn new(value: fn(Option<String>, AudioFormat) -> Box<dyn Sink>) -> AppAudioBackend {
        AppAudioBackend(Mutex::new(value))
    }
}
impl AppPlayer {
    pub fn new(value: Option<Spirc>) -> AppPlayer {
        AppPlayer(Mutex::new(value))
    }
}

fn new_arc_mutex<T>(value: T) -> Arc<Mutex<T>> {
    Arc::new(Mutex::new(value))
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
    appCredentials: tauri::State<'_, AppCredentials>,
) -> Result<(), String> {
    let credentials = Credentials::with_password(username, password);
    let res = Session::new(SessionConfig::default(), None)
        .connect(credentials.clone(), false)
        .await;

    match res {
        Ok(_) => {
            *appCredentials.0.lock().unwrap() = Some(credentials);
            Ok(())
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
async fn start_spotify_connect(
    context_uri: String,
    credentials: tauri::State<'_, AppCredentials>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let credentials = state.credentials.lock().unwrap().to_owned();
    let backend = state.audio_backend.lock().unwrap().to_owned();

    let session_config = SessionConfig::default();
    let player_config = PlayerConfig::default();
    let audio_format = AudioFormat::default();
    let connect_config = ConnectConfig {
        name: "Mini Spotify".to_string(),
        device_type: DeviceType::AudioDongle,
        initial_volume: Some(50),
        has_volume_ctrl: true,
    };

    let session = Session::new(session_config, None);
    // let error_opt = session.connect(credentials.clone().unwrap(), false).await.err();

    match credentials {
        Some(_) => (),
        None => return Err("Not logged.".to_string()),
    };
    // match error_opt {
    //     None => (),
    //     Some(error) => return Err(error.to_string())
    // };

    let player = AppPlayer::new(
        player_config,
        session.clone(),
        Box::new(NoOpVolume),
        move || backend(None, audio_format),
    );

    let spirc_res = Spirc::new(
        connect_config,
        session.clone(),
        credentials.unwrap(),
        player,
        Box::new(SoftMixer::open(MixerConfig::default())),
    )
    .await;

    match spirc_res {
        Err(err) => return Err(err.to_string()),
        Ok((spirc, spirc_task)) => {
            join!(spirc_task, async {
                println!("Connected !");

                let album = Album::get(&session, &SpotifyId::from_uri(&context_uri).unwrap())
                    .await
                    .unwrap();

                let tracks = album
                    .tracks()
                    .map(|track_id| {
                        let mut track = TrackRef::new();
                        track.set_gid(Vec::from(track_id.to_raw()));
                        track
                    })
                    .collect();

                spirc.activate().unwrap();
                let load_command = SpircLoadCommand {
                    context_uri,
                    start_playing: true,
                    shuffle: false,
                    repeat: false,
                    playing_track_index: 0,
                    tracks,
                };

                spirc.load(load_command).unwrap();
                // err.map(|err| println!("{}", err.to_string()));

                spirc.play().unwrap();

                *state.spirc.lock().unwrap() = Some(spirc);
            });
        }
    };

    Ok(())
}

#[tauri::command]
fn show_login(credentials: tauri::State<'_, AppCredentials>, player: tauri::State<'_, AppPlayer>) {
    println!(
        "Credentials: {:?}",
        credentials.0.lock().unwrap().is_some()
    );
    println!("Spirc: {:?}", player.0.lock().unwrap().is_some());
}

#[tauri::command]
fn toggle_song(player: tauri::State<'_, AppPlayer>) -> Result<(), String> {
    let player = player.0.lock().unwrap();
    match *player {
        None => Err("Player not started.".to_string()),
        Some(spirc) => spirc.play_pause().map_err(|err| err.to_string()),
    }
}

// #[tauri::command]
// async fn test_song(stored_credentials: tauri::State<'_, StoredCredentials>) -> Result<(), ()> {
//     let session_config = SessionConfig::default();
//     let player_config = PlayerConfig::default();
//     let audio_format = AudioFormat::default();
//     let connect_config =
//     ConnectConfig {
//         name: "Mini Spotify".to_string(),
//         device_type: DeviceType::default(),
//         initial_volume: Some(50),
//         has_volume_ctrl: true,
//     };

//     let credentials = Credentials::with_password(username, password);
//     let backend = audio_backend::find(None).unwrap();

//     let context_uri = String::from("spotify:album:0C8bAFI1POhzztBVShuzll");

//     println!("Connecting ...");
//     let session = Session::new(session_config, None);
//     // let error_opt = session.connect(credentials.clone(), false).await.err();

//     // match error_opt {
//     //     Some(error) => println!("{}", error.to_string()),
//     //     None => ()
//     // };

//     // let discovery = Discovery::builder(session.device_id(), session.client_id().as_str())
//     //     .device_type(librespot::discovery::DeviceType::HomeThing)
//     //     .name("Mini Spotify")
//     //     .port(0)
//     //     .launch()
//     //     .unwrap();

//     let player = Player::new(
//         player_config,
//         session.clone(),
//         Box::new(NoOpVolume),
//         move || backend(None, audio_format),
//     );

//     let res = Spirc::new(
//         connect_config,
//         session.clone(),
//         credentials,
//         player,
//         Box::new(SoftMixer::open(MixerConfig::default())),
//     )
//     .await;

//     match res {
//         Err(err) => println!("{}", err.to_string()),
//         Ok((spirc, spirc_task)) => {
//             join!(spirc_task, async {
//                 println!("Connected !");

//                 let album = Album::get(&session, &SpotifyId::from_uri(&context_uri).unwrap())
//                     .await
//                     .unwrap();

//                 let tracks = album
//                     .tracks()
//                     .map(|track_id| {
//                         let mut track = TrackRef::new();
//                         track.set_gid(Vec::from(track_id.to_raw()));
//                         track
//                     })
//                     .collect();

//                 spirc.activate().unwrap();
//                 let load_command = SpircLoadCommand {
//                     context_uri,
//                     start_playing: true,
//                     shuffle: false,
//                     repeat: false,
//                     playing_track_index: 0,
//                     tracks
//                 };

//                 spirc.load(load_command).unwrap();
//                 // err.map(|err| println!("{}", err.to_string()));

//                 spirc.play().unwrap();
//             });
//         }
//     };

//     // match session_res {
//     //     Ok((session, _)) => {
//     //         let (mut player, _) = Player::new(player_config, session, Box::new(NoOpVolume), move || {
//     //             backend(None, audio_format)
//     //         });

//     //         let connect_config = librespot::core::config::ConnectConfig::default();

//     //         let res =
//     //             librespot_discovery::Discovery::builder(device_id(&connect_config.name))
//     //                 .device_type(librespot_discovery::DeviceType::HomeThing)
//     //                 .name("Mini Spotify")
//     //                 .port(0)
//     //                 .launch();

//     //         match res {
//     //             Ok(res) => (),
//     //             Err(err) => println!("{}", err.to_string())
//     //         };

//     //         // println!("{}", )

//     //         // player.load(SpotifyId::from_base62("7oTQ4d0UJeH8LOyvpfd5uW").unwrap(), true, 0);
//     //         // println!("Playing...");

//     //         // player.await_end_of_track().await;
//     //         // println!("Done");
//     //     },
//     //     Err(error) => println!("{}", error.to_string()),
//     // };

//     Ok(())
// }

fn main() {
    let initial_credential = AppCredentials::new(None);
    let initial_audio_backend = AppAudioBackend::new(audio_backend::find(None).unwrap());
    let initial_player = AppPlayer::new(None);

    tauri::Builder::default()
        .manage(initial_credential)
        .manage(initial_audio_backend)
        .manage(initial_player)
        .invoke_handler(tauri::generate_handler![
            login,
            show_login,
            start_spotify_connect,
            toggle_song
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
