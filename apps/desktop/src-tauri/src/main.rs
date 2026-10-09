#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[cfg(windows)]
mod notifications;
mod protocol;
mod server;
mod stream;
use server::*;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn show_history(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let _ = app.emit("tunnel-history", ());
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--tray"])
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let state = TunnelState::load(app.handle())?;
            app.manage(state.clone());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = serve(handle.clone(), state.clone()).await {
                    state.inner.lock().await.error = Some(error);
                    let _ = handle.emit("tunnel-changed", ());
                }
            });
            let open = MenuItem::with_id(app, "open", "Open Tunnel", true, None::<&str>)?;
            let history =
                MenuItem::with_id(app, "history", "Transfer history", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Tunnel", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &history, &quit])?;
            TrayIconBuilder::new()
                .tooltip("Tunnel · your private passage")
                .icon(app.default_window_icon().ok_or("Missing app icon")?.clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "history" => show_history(app),
                    _ => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;
            if let Err(e) = app.global_shortcut().register("Control+Shift+Space") {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    handle.state::<TunnelState>().inner.lock().await.error =
                        Some(format!("Shortcut unavailable: {e}"));
                });
            }
            if std::env::args().any(|a| a == "--tray") {
                if let Some(w) = app.get_webview_window("main") {
                    w.hide()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            pairing,
            send_text,
            save_attachment,
            preview_attachment,
            pick_attachments,
            preview_draft,
            copy_attachment,
            unpair,
            clear_history,
            preferences,
            rename_device
        ])
        .run(tauri::generate_context!())
        .expect("Tunnel failed to start");
}
