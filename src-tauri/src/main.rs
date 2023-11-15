// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::os::windows::prelude::*;
use tauri::{Manager, WindowBuilder, utils::config::WindowConfig, App, Window};
mod clickthru;
use clickthru::{clear_forward, forward_mouse_messages};

#[tauri::command]
fn clickthru(app: tauri::AppHandle, ignore:bool, id:String){
    //println!("win:{}, ignore:{}",id, ignore);
    let window: tauri::Window = app.get_window(&id).unwrap();
    forward_mouse_messages(&window, ignore);
    window.set_ignore_cursor_events(ignore).unwrap();
}

#[tauri::command]
async fn create_modal(app: tauri::AppHandle, parent_label: String, options: WindowConfig) -> bool {

    let win = app.get_window(&options.label);

    if win.is_none() {
        let child = WindowBuilder::from_config(&app, options);

        let parent = app.get_window(&parent_label).unwrap();
        let child = child.owner_window(parent.hwnd().unwrap());

        child.build().unwrap();

        return true;
    }

    return true;
}

#[tauri::command]
async fn create_child(app: tauri::AppHandle, parent_label: String, options: WindowConfig) {
    let child = WindowBuilder::from_config(&app, options);

    let parent = app.get_window(&parent_label).unwrap();
    let child = child.parent_window(parent.hwnd().unwrap());

    child.build().unwrap();
}

#[tauri::command]
async fn rename(file_path: std::path::PathBuf, new_path: std::path::PathBuf){
	std::fs::rename(file_path, new_path).unwrap();
}

#[derive(Clone, serde::Serialize)]
struct Metadata {
    size:u64,
    atime:u64,
    mtime:u64,
    ctime:u64,
}

#[tauri::command]
async fn stat(full_path: std::path::PathBuf) -> Metadata {
    let metadata = std::fs::metadata(full_path).unwrap();

	return Metadata {
        size:metadata.file_size(),
        atime:metadata.last_access_time(),
        mtime:metadata.last_write_time(),
        ctime:metadata.creation_time(),
    }
}

fn create_child_window(app:&App, id: &str, url: &str, parent: &Window) -> Window {

    let visible = if id == "Playlist" {false} else {true};
    let closable = if id == "Playlist" {true} else {false};
    let transparent = if id == "Playlist" {false} else {true};
    let child = WindowBuilder::new(app, id, tauri::WindowUrl::App(url.into()))
        .title("")
        .fullscreen(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(closable)
        .focused(false)
        .visible(visible)
        .decorations(false)
        .skip_taskbar(true)
        .transparent(transparent)
        .theme(Some(tauri::Theme::Dark));

    let child = child.owner_window(parent.hwnd().unwrap());

    return child.build().unwrap();

}

fn main(){
    tauri::Builder::default()
        .setup(|app| {

            let player = app.get_window("Player").unwrap();
            create_child_window(app, "Playlist", "src/playlist/playlist.html", &player);

            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Destroyed => {

              if event.window().label() == "player" {
                clear_forward();
              }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![clickthru, create_modal, create_child, rename, stat])
        .run(tauri::generate_context!())
        .expect("error while running application");
}

