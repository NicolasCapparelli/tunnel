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
#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;
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
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
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
            // Standalone builds have no installer to register their callback scheme.
            #[cfg(any(windows, target_os = "linux"))]
            app.deep_link().register_all()?;
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
            rename_device,
            get_singularity_secret,
            set_singularity_secret,
            clear_singularity_secret,
            load_singularity_db, save_singularity_db, singularity_auth_request, singularity_sync_request
        ])
        .run(tauri::generate_context!())
        .expect("Tunnel failed to start");
}

#[tauri::command]
fn get_singularity_secret() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("Tunnel", "singularity").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn set_singularity_secret(value: String) -> Result<(), String> {
    keyring::Entry::new("Tunnel", "singularity").map_err(|e| e.to_string())?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_singularity_secret() -> Result<(), String> {
    let entry = keyring::Entry::new("Tunnel", "singularity").map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn singularity_db_path(app: &tauri::AppHandle, account_key: &str) -> Result<std::path::PathBuf, String> {
    if account_key.len() != 64 || !account_key.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid Singularity account key.".into());
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(format!("singularity-{account_key}.sqlite")))
}

#[tauri::command]
fn load_singularity_db(app: tauri::AppHandle, account_key: String) -> Result<Option<Vec<u8>>, String> {
    let target = singularity_db_path(&app, &account_key)?;
    match std::fs::read(&target) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            // A crash between the two save renames can leave only the backup.
            match std::fs::read(target.with_extension("sqlite.bak")) {
                Ok(bytes) => Ok(Some(bytes)),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(error) => Err(error.to_string()),
            }
        },
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_singularity_db(app: tauri::AppHandle, account_key: String, bytes: Vec<u8>) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let target = singularity_db_path(&app, &account_key)?;
    let temp = dir.join(format!("singularity-{account_key}.sqlite.tmp"));
    std::fs::write(&temp, bytes).map_err(|e| e.to_string())?;
    let backup = dir.join(format!("singularity-{account_key}.sqlite.bak"));
    if target.exists() {
        let _ = std::fs::remove_file(&backup);
        std::fs::rename(&target, &backup).map_err(|e| e.to_string())?;
    }
    if let Err(error) = std::fs::rename(&temp, &target) {
        if backup.exists() { let _ = std::fs::rename(&backup, &target); }
        return Err(error.to_string());
    }
    let _ = std::fs::remove_file(backup);
    Ok(())
}


#[derive(serde::Serialize)]
struct SingularityAuthResponse { status: u16, body: String }

// OAuth and sync use native HTTPS with separate route allowlists.
// Never forward Origin, cookies, or credentials across redirects.
#[tauri::command]
async fn singularity_auth_request(
    url: String, method: String, body: Option<String>,
    authorization: Option<String>, content_type: Option<String>,
) -> Result<SingularityAuthResponse, String> {
    let target = reqwest::Url::parse(&url).map_err(|_| "Invalid OAuth URL")?;
    let host = target.host_str().unwrap_or("");
    let allowed = target.scheme() == "https" && target.port_or_known_default() == Some(443)
        && target.username().is_empty() && target.password().is_none()
        && target.query().is_none() && target.fragment().is_none()
        && ((host.ends_with(".cloudflareaccess.com") && method == "POST"
            && matches!(target.path(), "/cdn-cgi/access/oauth/registration" | "/cdn-cgi/access/oauth/token" | "/cdn-cgi/access/oauth/revoke"))
            || (host.ends_with(".workers.dev") && method == "GET"
                && matches!(target.path(), "/.well-known/oauth-authorization-server" | "/v1/account")));
    if !allowed || body.as_ref().is_some_and(|b| b.len() > 65536) {
        return Err("OAuth request is outside the allowed scope.".into());
    }
    singularity_http_request(target, method, body, authorization, content_type, 1048576).await
}

fn allowed_sync_request(target: &reqwest::Url, method: &str) -> bool {
    if target.scheme() != "https" || target.port_or_known_default() != Some(443)
        || !target.host_str().unwrap_or("").ends_with(".workers.dev")
        || !target.username().is_empty() || target.password().is_some() || target.fragment().is_some() {
        return false;
    }
    let route = matches!((method, target.path()),
        ("GET", "/v1/head" | "/v1/commits" | "/v1/checkpoint" | "/v1/restore-points")
        | ("POST", "/v1/submit" | "/v1/checkpoint" | "/v1/restore-points" | "/v1/compact" | "/v1/hint-ticket")
        | ("DELETE", "/v1/restore-points"));
    route && target.query_pairs().all(|(key, value)| {
        method == "GET" && value.parse::<u64>().is_ok() && match target.path() {
            "/v1/commits" => matches!(key.as_ref(), "after" | "upTo" | "limit"),
            "/v1/checkpoint" => key == "atOrBefore",
            _ => false,
        }
    })
}

#[tauri::command]
async fn singularity_sync_request(
    url: String, method: String, body: Option<String>,
    authorization: Option<String>, content_type: Option<String>,
) -> Result<SingularityAuthResponse, String> {
    let target = reqwest::Url::parse(&url).map_err(|_| "Invalid sync URL")?;
    if !allowed_sync_request(&target, &method) || body.as_ref().is_some_and(|b| b.len() > 8388608) {
        return Err("Sync request is outside the allowed scope.".into());
    }
    singularity_http_request(target, method, body, authorization, content_type, 8388608).await
}

async fn singularity_http_request(
    target: reqwest::Url, method: String, body: Option<String>,
    authorization: Option<String>, content_type: Option<String>, response_limit: usize,
) -> Result<SingularityAuthResponse, String> {
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid HTTP method")?;
    let mut request = client.request(verb, target);
    if let Some(value) = authorization { request = request.header("Authorization", value); }
    if let Some(value) = content_type { request = request.header("Content-Type", value); }
    if let Some(value) = body { request = request.body(value); }
    let mut response = request.send().await.map_err(|e| e.without_url().to_string())?;
    let status = response.status().as_u16();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.without_url().to_string())? {
        if bytes.len() + chunk.len() > response_limit { return Err("Singularity response is too large.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    Ok(SingularityAuthResponse { status, body: String::from_utf8(bytes).map_err(|_| "Invalid OAuth response")? })
}

#[cfg(test)]
mod singularity_transport_tests {
    use super::allowed_sync_request;
    #[test]
    fn permits_only_sync_routes_and_numeric_history_queries() {
        for (method, path) in [("GET", "/v1/head"), ("GET", "/v1/commits?after=0&upTo=12&limit=200"),
            ("GET", "/v1/checkpoint?atOrBefore=12"), ("POST", "/v1/submit"),
            ("POST", "/v1/hint-ticket"), ("DELETE", "/v1/restore-points")] {
            assert!(allowed_sync_request(&format!("https://example.workers.dev{path}").parse().unwrap(), method));
        }
        for url in ["http://example.workers.dev/v1/head", "https://example.com/v1/head",
            "https://example.workers.dev:444/v1/head", "https://user@example.workers.dev/v1/head",
            "https://example.workers.dev/v1/head#secret", "https://example.workers.dev/oauth/callback",
            "https://example.workers.dev/v1/commits?token=secret", "https://example.workers.dev/v1/commits?after=-1"] {
            assert!(!allowed_sync_request(&url.parse().unwrap(), "GET"));
        }
        assert!(!allowed_sync_request(&"https://example.workers.dev/v1/head".parse().unwrap(), "POST"));
    }
}
