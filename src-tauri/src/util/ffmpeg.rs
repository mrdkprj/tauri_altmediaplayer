use tauri::api::process::{self, CommandEvent};
use tauri::api::process::Command;
use std::sync::Mutex;
use std::path::Path;
use once_cell::sync::Lazy;

const LOG_LEVEL:&str = "-loglevel";
const LOG_LEVEL_VALUE:&str = "error";
static CURRENT_FILE:Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::from("")));
static COMMAND:Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None) );
const FFMPEG_PATH:&str = "ffmpeg";
const FFPROBE_PATH:&str = "ffprobe";

#[derive(Clone, serde::Serialize)]
pub struct MediaMetadata {
    metadata:String,
    volume:String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioOptions {
    audio_bitrate:String,
    audio_volume:String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoOptions {
    audio_bitrate:String,
    audio_volume:String,
    size:String,
    rotation:String,
}

pub fn cancel(){

    let mut x = COMMAND.lock().unwrap();
    if *x != None {
        let command = format!("taskkill /pid {} /F", x.unwrap().to_string());
        Command::new("cmd").args([command]).output().expect("failed to execute process");
        *x = None;
    }

}

pub async fn get_media_metadata(full_path:String) -> MediaMetadata {
    let mut args:Vec<&str> = Vec::new();
    args.push("-hide_banner");
    args.push("-v");
    args.push("error");
    args.push("-print_format");
    args.push("json");
    args.push("-show_streams");
    args.push("-show_format");
    args.push("-i");
    args.push(&full_path);

    let result = process::Command::new_sidecar(FFPROBE_PATH).unwrap().args(args).output().expect("Failed to run ffprobe");

    let volume = get_volume(full_path.clone()).await;

    return MediaMetadata {
        metadata: result.stdout,
        volume,
    };
}

pub async fn get_volume(source_path:String) -> String {
    let mut args:Vec<&str> = Vec::new();
    args.push("-i");
    args.push(&source_path);
    args.push("-vn");
    args.push("-af");
    args.push("volumedetect");
    args.push("-f");
    args.push("null");
    args.push("-");

    let (mut rx, _child) = Command::new_sidecar(FFMPEG_PATH).unwrap().args(args).spawn().expect("Failed to spawn ffmpeg");

    let mut result = "".to_owned();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
            result.push_str(&line);
        }
    }

    return result;
}

pub async fn convert_audio(source_path:String, dest_path:String, options:AudioOptions) -> Result<bool, String> {

    *CURRENT_FILE.lock().unwrap() = dest_path.clone();
    let mut args:Vec<&str> = Vec::new();
    args.push("-i");
    args.push(&source_path);
    args.push(LOG_LEVEL);
    args.push(LOG_LEVEL_VALUE);
    args.push("-y");
    args.push("-acodec");
    args.push("libmp3lame");
    args.push("-b:a");
    args.push(&options.audio_bitrate);

    let volume = if options.audio_volume.is_empty() { String::new() } else { format!("volume={}", options.audio_volume) };

    if volume.is_empty() == false {
        args.push("-filter:a");
        args.push(&volume);
    }

    args.push("-f");
    args.push("mp3");
    args.push(&dest_path);

    let (mut rx, child) = Command::new_sidecar(FFMPEG_PATH).unwrap().args(args).spawn().expect("Failed to spawn ffmpeg");

    *COMMAND.lock().unwrap() = Some(child.pid());

    let mut errors = "".to_owned();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
            errors.push_str(&line);
        }
    }

    if errors.is_empty() {
        finish_convert();
        Ok(true)
    } else {
        clean_up();
        Err(errors)
    }

}

pub async fn convert_video(source_path:String, dest_path:String, options:VideoOptions) -> Result<bool, String> {

    *CURRENT_FILE.lock().unwrap() = dest_path.clone();
    let mut args:Vec<&str> = Vec::new();
    args.push("-i");
    args.push(&source_path);
    args.push(LOG_LEVEL);
    args.push(LOG_LEVEL_VALUE);
    args.push("-y");
    args.push("-acodec");
    args.push("libmp3lame");
    args.push("-b:a");
    args.push(&options.audio_bitrate);

    let volume = if options.audio_volume.is_empty() { String::new() } else { format!("volume={}", options.audio_volume) };

    if !volume.is_empty() {
        args.push("-filter:a");
        args.push(&volume);
    }

    args.push("-vcodec");
    args.push("libx264");

    let video_filters = if options.size.is_empty() { String::new() } else { format!("scale={}", options.size) };
    let video_filters = if options.rotation.is_empty() { String::new() } else { format!("{},transpose={}", video_filters, options.rotation) };

    if !video_filters.is_empty()  {
        args.push("-filter:v");
        args.push(&video_filters);
    }

    args.push("-f");
    args.push("mp4");
    args.push(&dest_path);

    let (mut rx, child) = Command::new_sidecar(FFMPEG_PATH).unwrap().args(args).spawn().expect("Failed to spawn ffmpeg");

    *COMMAND.lock().unwrap() = Some(child.pid());

    let mut errors = "".to_owned();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
            errors.push_str(&line);
        }
    }

    if errors.is_empty() {
        finish_convert();
        Ok(true)
    } else {
        clean_up();
        Err(errors)
    }

}

fn finish_convert(){
    *CURRENT_FILE.lock().unwrap() = String::new();
    *COMMAND.lock().unwrap() = None;
}

fn clean_up(){

    let mut current_file = CURRENT_FILE.lock().unwrap();

    if !current_file.is_empty() && Path::new(current_file.as_str()).exists() {
        std::fs::remove_file(current_file.as_str()).unwrap();
    }

    *current_file = String::new();
    *COMMAND.lock().unwrap() = None;

}