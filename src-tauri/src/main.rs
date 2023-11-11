// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::time::{SystemTime, UNIX_EPOCH};
use lazy_static::lazy_static;
use std::sync::Mutex;
use tauri::{Manager, WindowBuilder, utils::config::WindowConfig, App, Window};
mod click;
use click::{clear_forward, forward_mouse_messages};

#[tauri::command]
fn clickthru(app: tauri::AppHandle, ignore:bool, id:String){
    println!("window:{}, ignore:{}", id, ignore);
    let window: tauri::Window = app.get_window(&id).unwrap();
    forward_mouse_messages(&window, ignore);
    window.set_ignore_cursor_events(ignore).unwrap();
}

// #[tauri::command]
// async fn create_modal(app: tauri::AppHandle, _parent_label: String, options: WindowConfig) -> bool {
//     println!("{}", &options.label);
//     let child = app.get_window(&options.label).unwrap();
//     let parent = app.get_window("Player").unwrap();
//     let h = parent.hwnd().unwrap();
//     println!("{:?}", h);

//     child.with_webview(|webview| unsafe {

//         println!("{:?}", h);
//         webview.controller().SetParentWindow(h).unwrap();

//     }).unwrap();

//     return true;

// }

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

lazy_static! {
    static ref WINDOW_LABELS:Mutex<Vec<String>> = Mutex::new(vec![]);
}

fn main(){
    tauri::Builder::default()
        .plugin(tauri_plugin_fs_extra::init())
        .setup(|app| {
            let start = SystemTime::now();
            let since_the_epoch = start
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards");
            println!("{:?}", since_the_epoch);

            let player = app.get_window("Player").unwrap();
            create_child_window(app, "Playlist", "src/playlist/playlist.html", &player);

            Ok(())
        })
        // .setup(|app|{
        //     let player = app.get_window("Player").unwrap();
        //     let _child = create_child_window(app, "Playlist", "src/playlist/playlist.html", &player);
        //     block_on(child);
        //     let playlist = app.get_window("Playlist").unwrap();

        //     let child = create_child_window(app, "PlayerMenu", "src/menu/menu.html", &player);
        //     block_on(child);
        //     let child = create_child_window(app, "PlaylistMenu", "src/menu/menu.html", &playlist);
        //     block_on(child);
        //     let child = create_child_window(app, "SortMenu", "src/menu/menu.html", &playlist);
        //     block_on(child);

        //     Ok(())
        // })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Destroyed => {

              if event.window().label() == "player" {
                //event.window().app_handle().emit_all("close", {}).unwrap();
                clear_forward();
              }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![clickthru, create_modal, create_child, rename])
        .run(tauri::generate_context!())
        .expect("error while running application");
}

/*
//use tauri::menu::{MenuBuilder};
//use tauri::menu::{MenuItem, Menu, PredefinedMenuItem, Submenu};

fn main(){
    tauri::Builder::default()
        .setup(move |app| {
            build_menu(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, clickthru])
        .plugin(tauri_plugin_window::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_menu(app:&App){

    let handle: &tauri::AppHandle = app.handle();
    let menu = Menu::new(handle);
    //let menu2 = Menu::new(handle);
    let menu_item2 = MenuItem::new(handle,"Menu item #2", true, None);

    let submenu = Submenu::with_items(handle,"Submenu Outer", true,&[
        &MenuItem::with_id(handle, "quit", "Menu item #1", true, None),
        &PredefinedMenuItem::separator(handle),
        &MenuItem::with_id(handle, "close", "Menu item #3", true, None),
        &PredefinedMenuItem::separator(handle),
    ]).unwrap();
    menu.append(&menu_item2).unwrap();
    menu.append(&submenu).unwrap();
    handle.on_menu_event(attach_menu_event_handler);
    //app.set_menu(menu).unwrap();
    //app.hide_menu().unwrap();

}

fn attach_menu_event_handler(handel:&AppHandle, event: tauri::menu::MenuEvent){
    match event.id.as_ref() {
        "quit" => {
          std::process::exit(0);
        }
        "close" => {
          let win = handel.get_window("player").unwrap();
          win.close().unwrap();
        }
        _ => {}
      }
}

        .setup(|app|{
            let player = app.get_window("player").unwrap();
            let child = create_child_window(app, "playlist", "src/playlist/playlist.html", &player);
            block_on(child);
            // let playlist = app.get_window("playlist").unwrap();

            // let child = create_menu_window(app, "player_menu", "src/menu/menu.html", &player);
            // block_on(child);
            // let child = create_menu_window(app, "playlist_menu", "src/menu/menu.html", &playlist);
            // block_on(child);

            Ok(())
        })
*/