// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::os::windows::prelude::*;
use std::{env, sync::Mutex};
use tauri::{Manager, WindowBuilder, utils::config::WindowConfig, App, Window};

pub mod util;
use util::ffmpeg;
use util::forward;

const PLAYER:&str = "Player";
const PLAYLIST:&str = "Playlist";
const CONVERT:&str = "Convert";

#[derive(serde::Serialize)]
struct OpenedUrls(Mutex<Vec<String>>);

#[derive(Clone, serde::Serialize)]
struct SecondInstanceArgs {
  args: Vec<String>,
}

#[derive(Clone, serde::Serialize)]
struct Metadata {
    size:u64,
    atime:u64,
    mtime:u64,
    ctime:u64,
}

#[tauri::command]
fn init(app_handle: tauri::AppHandle) -> Vec<String> {
    let urls = app_handle.state::<OpenedUrls>().0.lock().unwrap().clone();
    return urls;
}

#[tauri::command]
fn cancel_convert(){
    ffmpeg::cancel();
}

#[tauri::command]
async fn get_media_metadata(full_path:String) -> Result<ffmpeg::MediaMetadata, ()> {
    let result = ffmpeg::get_media_metadata(full_path).await;
    Ok(result)
}

#[tauri::command]
async fn convert_audio(source_path:String, dest_path:String, audio_options:ffmpeg::AudioOptions) -> Result<bool, String> {
    let result = ffmpeg::convert_audio(source_path, dest_path, audio_options).await;

    if result.is_ok() {
        Ok(result.ok().unwrap())
    }else{
        Err(result.err().unwrap())
    }
}

#[tauri::command]
async fn convert_video(source_path:String, dest_path:String, video_options:ffmpeg::VideoOptions) -> Result<bool, String> {
    let result = ffmpeg::convert_video(source_path, dest_path, video_options).await;

    if result.is_ok() {
        Ok(result.ok().unwrap())
    }else{
        Err(result.err().unwrap())
    }
}

#[tauri::command]
fn clickthru(app: tauri::AppHandle, ignore:bool, id:String){
    //println!("win:{}, ignore:{}",id, ignore);
    let window: tauri::Window = app.get_window(&id).unwrap();
    forward::forward_mouse_messages(&window, ignore);
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

#[tauri::command]
fn close(app_handle: tauri::AppHandle){
    forward::clear_forward();
    app_handle.exit(0);
}

fn create_child_window(app:&App, id: &str, url: &str, parent: &Window) -> Window {

    let child = WindowBuilder::new(app, id, tauri::WindowUrl::App(url.into()))
        .title("")
        .fullscreen(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(true)
        .focused(false)
        .visible(false)
        .decorations(false)
        .skip_taskbar(true)
        .transparent(false)
        .theme(Some(tauri::Theme::Dark));

    let child = child.owner_window(parent.hwnd().unwrap());

    return child.build().unwrap();

}

fn main(){
    tauri::Builder::default()
        .manage(OpenedUrls(Default::default()))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            app.emit_to(PLAYER, "second-instance", SecondInstanceArgs { args: argv[1..].to_vec() }).unwrap();
        }))
        .setup(|app| {

            let player = app.get_window(PLAYER).unwrap();
            create_child_window(app, PLAYLIST, "src/playlist/playlist.html", &player);
            create_child_window(app, CONVERT, "src/convert/convert.html", &player);

            let mut urls = Vec::new();
            for arg in env::args().skip(1) {
                urls.push(arg);
            }

            *app.state::<OpenedUrls>().0.lock().unwrap() = urls;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init,
            close,
            clickthru,
            create_modal,
            create_child,
            rename,
            stat,
            get_media_metadata,
            convert_audio,
            convert_video,
            cancel_convert
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

