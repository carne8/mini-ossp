// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use tauri::Manager;

fn main() {
    tauri_plugin_deep_link::prepare("de.fabianlars.deep-link-test");

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            tauri_plugin_deep_link::register(
                "mini-ossp",
                move |request| {
                    handle.emit_all("scheme-request-received", request).unwrap();
                },
            )
            .unwrap();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
