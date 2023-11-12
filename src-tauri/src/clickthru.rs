use tauri::Window;
use windows::Win32::{
  Foundation::{WPARAM, LPARAM, LRESULT, POINT, RECT, HWND},
  Graphics::Gdi::{ScreenToClient, PtInRect},
  UI::Controls::WM_MOUSELEAVE,
  UI::Shell::{SetWindowSubclass, RemoveWindowSubclass, DefSubclassProc},
  UI::WindowsAndMessaging::{SetWindowsHookExA, WH_MOUSE_LL, UnhookWindowsHookEx, CallNextHookEx, GetClientRect, WM_MOUSEMOVE, MSLLHOOKSTRUCT, HHOOK},
};
use std::mem;
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[derive(Clone, serde::Serialize)]
struct Position {
  x:i32,
  y:i32,
}

static FOWARDING_MOUSE_MESSAGES:Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static FORWARDING_WINDOWS: Lazy<Mutex<Vec<Window>>> = Lazy::new(|| Mutex::new(Vec::new()));
static MOUSE_HOOK:Lazy<Mutex<Option<HHOOK>>> = Lazy::new(|| Mutex::new(None) );

pub fn clear_forward(){
  FORWARDING_WINDOWS.lock().unwrap().iter().for_each(|window| forward_mouse_messages(window, false));
}

pub fn forward_mouse_messages(window:&Window, forward:bool){

  let hwnd = window.hwnd().unwrap();
  let mut fowarding_mouse_messages = FOWARDING_MOUSE_MESSAGES.lock().unwrap();
  let mut forwarding_windows = FORWARDING_WINDOWS.lock().unwrap();
  let mut mouse_hook = MOUSE_HOOK.lock().unwrap();

  if forward == true {

    *fowarding_mouse_messages = true;
    forwarding_windows.push(window.clone());

    unsafe{
      // Subclassing is used to fix some issues when forwarding mouse messages;
      // see comments in |SubclassProc|.
      SetWindowSubclass(
        hwnd,
        Some(sub_class_proc),
        1,
        Box::into_raw(Box::new(window)) as usize
      );

      if *mouse_hook == None {
        let rusult = SetWindowsHookExA(
          WH_MOUSE_LL,
          Some(mouse_hook_proc),
          None,
          0
        );
        *mouse_hook = rusult.ok();
      }
    }

  } else if forward == false{


    if let Some(index) = forwarding_windows.iter().position(|x| x.label() == window.label()) {
      forwarding_windows.remove(index);
      unsafe{
        RemoveWindowSubclass(hwnd, Some(sub_class_proc), 1);
      }
    }

    if *fowarding_mouse_messages == true && forwarding_windows.is_empty() == true {
      *fowarding_mouse_messages = false;
      unsafe{
        if *mouse_hook != None {
          UnhookWindowsHookEx(mouse_hook.unwrap());
        }
      }
      *mouse_hook = None;
    }

  }


}

unsafe extern "system" fn sub_class_proc(hwnd: HWND, umsg: u32, wparam: WPARAM, lparam: LPARAM, _uidsubclass: usize, _dwrefdata: usize)  -> LRESULT {

  if umsg == WM_MOUSELEAVE {
    // When input is forwarded to underlying windows, this message is posted.
    // If not handled, it interferes with Chromium logic, causing for example
    // mouseleave events to fire. If those events are used to exit forward
    // mode, excessive flickering on for example hover items in underlying
    // windows can occur due to rapidly entering and leaving forwarding mode.
    // By consuming and ignoring the message, we're essentially telling
    // Chromium that we have not left the window despite somebody else getting
    // the messages. As to why this is caught for the legacy window and not
    // the actual browser window is simply that the legacy window somehow
    // makes use of these events; posting to the main window didn't work.
    if *FOWARDING_MOUSE_MESSAGES.lock().unwrap() == true {
        return windows::Win32::Foundation::LRESULT(0);
    }

  }

  unsafe{
    return DefSubclassProc(hwnd, umsg, wparam, lparam);
  }
}

unsafe extern "system" fn mouse_hook_proc(n_code:i32,wparam: WPARAM, lparam: LPARAM) -> LRESULT{
  if n_code < 0 {
    return CallNextHookEx(None, n_code, wparam, lparam);
  }

  // Post a WM_MOUSEMOVE message for those windows whose client area contains
  // the cursor since they are in a state where they would otherwise ignore all
  // mouse input.

  if wparam.0 == WM_MOUSEMOVE as usize {

    let forwarding_windows = FORWARDING_WINDOWS.lock().unwrap();

    for window in &*forwarding_windows {
      let hwnd = window.hwnd().unwrap();

      // At first I considered enumerating windows to check whether the cursor
      // was directly above the window, but since nothing bad seems to happen
      // if we post the message even if some other window occludes it I have
      // just left it as is.
      let mut client_rect = RECT::default();
      GetClientRect(hwnd, &mut client_rect);

      let hook_struct = unsafe { mem::transmute::<LPARAM, &MSLLHOOKSTRUCT>(lparam) };
      let mut p:POINT = hook_struct.pt;
      //println!("{:?}", p);
      ScreenToClient(hwnd, &mut p as *mut POINT);
      if PtInRect(&mut client_rect, p) == true {
        //println!("Message from Rust: {}","here");
        //let w:WPARAM = WPARAM(0);  // No virtual keys pressed for our purposes
        //let l:LPARAM = make_lparam(p.x as i16, p.y as i16);
        //PostMessageW(hwnd, WM_MOUSEMOVE, w, l);
        window.emit("MOUSEMOVE", Position{x:p.x, y:p.y}).unwrap();
      }
  }

}

  return CallNextHookEx(None, n_code, wparam, lparam);
}

pub fn _make_lparam(x: i16, y: i16) -> LPARAM {
  LPARAM(((x as u16 as u32) | ((y as u16 as u32) << 16)) as usize as _)
}

