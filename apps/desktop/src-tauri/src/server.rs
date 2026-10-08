use crate::protocol::{self, Quanta, Wire};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::{
    net::TcpListener,
    sync::{mpsc, oneshot, Mutex, Semaphore},
};
use tokio_tungstenite::tungstenite::{protocol::WebSocketConfig, Message};
const PORT: u16 = 53177;
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transfer {
    #[serde(flatten)]
    pub quanta: Quanta,
    pub direction: String,
    pub status: String,
    pub peer: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Disk {
    server_id: String,
    device_name: String,
    key: String,
    peer_id: Option<String>,
    peer_name: Option<String>,
    history: Vec<Transfer>,
    seen: VecDeque<String>,
    auto_copy: bool,
    notifications: bool,
}
pub struct Runtime {
    disk: Disk,
    path: PathBuf,
    sender: Option<mpsc::Sender<Wire>>,
    session: Option<(String, u64)>,
    pending: HashMap<String, oneshot::Sender<()>>,
    generation: u64,
    pub error: Option<String>,
}
#[derive(Clone)]
pub struct TunnelState {
    pub inner: Arc<Mutex<Runtime>>,
}
impl TunnelState {
    pub fn load(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let dir = app.path().app_data_dir()?;
        #[cfg(debug_assertions)]
        let dir = std::env::var_os("TUNNEL_TEST_DATA")
            .map(PathBuf::from)
            .unwrap_or(dir);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("tunnel.json");
        let mut disk: Disk = if path.exists() {
            serde_json::from_slice(&std::fs::read(&path)?)?
        } else {
            Disk {
                server_id: uuid::Uuid::new_v4().to_string(),
                device_name: std::env::var("COMPUTERNAME")
                    .or_else(|_| std::env::var("HOSTNAME"))
                    .unwrap_or_else(|_| "My desktop".into()),
                key: protocol::random_hex(32),
                peer_id: None,
                peer_name: None,
                history: vec![],
                seen: VecDeque::new(),
                auto_copy: true,
                notifications: true,
            }
        };
        for item in &mut disk.history {
            if item.status == "pending" {
                item.status = "failed".into();
            }
        }
        #[cfg(not(debug_assertions))]
        let session = None;
        #[cfg(debug_assertions)]
        let session = std::env::var("TUNNEL_TEST_TOKEN")
            .ok()
            .map(|token| (token, now() + 300000));
        let runtime = Runtime {
            disk,
            path,
            sender: None,
            session,
            pending: HashMap::new(),
            generation: 0,
            error: None,
        };
        runtime.save()?;
        Ok(Self {
            inner: Arc::new(Mutex::new(runtime)),
        })
    }
}
impl Runtime {
    fn save(&self) -> Result<(), String> {
        let data = serde_json::to_vec(&self.disk).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("tmp");
        std::fs::write(&tmp, data).map_err(|e| format!("Could not save history: {e}"))?;
        std::fs::rename(tmp, &self.path).map_err(|e| format!("Could not save history: {e}"))
    }
    fn add(&mut self, item: Transfer) {
        self.disk.history.insert(0, item);
        self.disk.history.truncate(200);
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    device_name: String,
    peer_name: Option<String>,
    connected: bool,
    addresses: Vec<String>,
    history: Vec<Transfer>,
    auto_copy: bool,
    notifications: bool,
    startup: bool,
    error: Option<String>,
}
fn addresses() -> Vec<String> {
    let mut list: Vec<String> = local_ip_address::list_afinet_netifas()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|(_, ip)| match ip {
            std::net::IpAddr::V4(ip) if ip.is_private() => Some(ip.to_string()),
            _ => None,
        })
        .collect();
    list.sort();
    list.dedup();
    if let Ok(ip) = local_ip_address::local_ip() {
        if let Some(index) = list.iter().position(|x| x == &ip.to_string()) {
            list.swap(0, index);
        }
    }
    list
}
#[tauri::command]
pub async fn snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<Snapshot, String> {
    let s = state.inner.lock().await;
    Ok(Snapshot {
        device_name: s.disk.device_name.clone(),
        peer_name: s.disk.peer_name.clone(),
        connected: s.sender.is_some(),
        addresses: addresses(),
        history: s.disk.history.clone(),
        auto_copy: s.disk.auto_copy,
        notifications: s.disk.notifications,
        startup: app.autolaunch().is_enabled().map_err(|e| e.to_string())?,
        error: s.error.clone(),
    })
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pairing {
    v: u8,
    endpoint: String,
    key: String,
    token: String,
    expires: u64,
    server_id: String,
    desktop_name: String,
}
#[tauri::command]
pub async fn pairing(
    address: String,
    state: tauri::State<'_, TunnelState>,
) -> Result<Pairing, String> {
    if !addresses().contains(&address) {
        return Err("Choose a current local network address.".into());
    }
    let mut s = state.inner.lock().await;
    if s.disk.peer_id.is_some() {
        return Err("Unlink the current device before pairing another.".into());
    }
    let token = protocol::random_hex(16);
    let expires = now() + 300000;
    s.session = Some((token.clone(), expires));
    Ok(Pairing {
        v: 1,
        endpoint: format!("ws://{address}:{PORT}/tunnel"),
        key: s.disk.key.clone(),
        token,
        expires,
        server_id: s.disk.server_id.clone(),
        desktop_name: s.disk.device_name.clone(),
    })
}
#[tauri::command]
pub async fn send_text(
    text: String,
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let q = Quanta {
        id: id.clone(),
        text,
        created_at: now(),
    };
    if !protocol::valid_quanta(&q) {
        return Err("Add text, up to 64 KB per quanta.".into());
    }
    let (sender, receipt) = {
        let mut s = state.inner.lock().await;
        let sender = s
            .sender
            .clone()
            .ok_or("Phone is offline. Your draft is safe.")?;
        if s.pending.contains_key(&id) {
            return Err("This quanta is already sending.".into());
        }
        if let Some(item) = s.disk.history.iter_mut().find(|t| t.quanta.id == id) {
            if item.direction != "sent" || item.quanta.text != q.text {
                return Err("Transfer identity mismatch.".into());
            }
            if item.status == "delivered" {
                return Ok(());
            }
            item.status = "pending".into();
        } else {
            let peer = s.disk.peer_name.clone().unwrap_or_else(|| "Phone".into());
            s.add(Transfer {
                quanta: q.clone(),
                direction: "sent".into(),
                status: "pending".into(),
                peer,
            });
        }
        s.save()?;
        let (tx, rx) = oneshot::channel();
        s.pending.insert(id.clone(), tx);
        (sender, rx)
    };
    let _ = app.emit("tunnel-changed", ());
    let sent = sender.send(Wire::Text { quanta: q }).await.is_ok();
    let received = sent
        && matches!(
            tokio::time::timeout(Duration::from_secs(8), receipt).await,
            Ok(Ok(()))
        );
    let mut s = state.inner.lock().await;
    s.pending.remove(&id);
    if let Some(item) = s.disk.history.iter_mut().find(|t| t.quanta.id == id) {
        item.status = if received { "delivered" } else { "failed" }.into();
    }
    s.save()?;
    drop(s);
    let _ = app.emit("tunnel-changed", ());
    if received {
        Ok(())
    } else {
        Err("Receipt unconfirmed. Retry from transfer history.".into())
    }
}
#[tauri::command]
pub async fn clear_history(
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let mut s = state.inner.lock().await;
    if !s.pending.is_empty() {
        return Err("Wait for the current transfer to finish.".into());
    }
    s.disk.history.clear();
    s.save()?;
    drop(s);
    let _ = app.emit("tunnel-changed", ());
    Ok(())
}
#[tauri::command]
pub async fn unpair(
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let mut s = state.inner.lock().await;
    s.sender = None;
    s.pending.clear();
    s.generation += 1;
    s.session = None;
    s.disk.peer_id = None;
    s.disk.peer_name = None;
    s.disk.key = protocol::random_hex(32);
    s.disk.seen.clear();
    s.save()?;
    drop(s);
    let _ = app.emit("tunnel-changed", ());
    Ok(())
}
#[tauri::command]
pub async fn preferences(
    auto_copy: bool,
    notifications: bool,
    startup: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    if startup {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|e| e.to_string())?;
    let mut s = state.inner.lock().await;
    s.disk.auto_copy = auto_copy;
    s.disk.notifications = notifications;
    s.save()?;
    drop(s);
    let _ = app.emit("tunnel-changed", ());
    Ok(())
}

fn notification(app: &tauri::AppHandle, peer: &str, copied: bool) {
    let handle = app.clone();
    let title = format!("Quanta from {peer}");
    let body = if copied {
        "Received and copied. Click to open Tunnel."
    } else {
        "Text received. Click to open Tunnel."
    };
    let _ = app.run_on_main_thread(move || {
        #[cfg(windows)]
        let result = {
            use tauri_winrt_notification::Toast;
            let app_id = if cfg!(debug_assertions) {
                Toast::POWERSHELL_APP_ID
            } else {
                "app.tunnel.desktop"
            };
            let clicked = handle.clone();
            Toast::new(app_id)
                .title(&title)
                .text1(body)
                .on_activated(move |_| {
                    crate::show_history(&clicked);
                    Ok(())
                })
                .show()
                .map_err(|e| e.to_string())
        };
        #[cfg(not(windows))]
        let result = {
            use tauri_plugin_notification::NotificationExt;
            handle
                .notification()
                .builder()
                .title(&title)
                .body(body)
                .show()
                .map_err(|e| e.to_string())
        };
        if let Err(e) = result {
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<TunnelState>();
                state.inner.lock().await.error =
                    Some(format!("Received, but notification failed: {e}"));
                let _ = handle.emit("tunnel-changed", ());
            });
        }
    });
}
async fn receive(app: &tauri::AppHandle, state: &TunnelState, q: Quanta) -> Result<(), String> {
    if !protocol::valid_quanta(&q) {
        return Err("Invalid quanta".into());
    }
    let mut s = state.inner.lock().await;
    if s.disk.seen.contains(&q.id) {
        return Ok(());
    }
    let peer = s.disk.peer_name.clone().unwrap_or_else(|| "Phone".into());
    let old = s.disk.clone();
    s.disk.seen.push_back(q.id.clone());
    while s.disk.seen.len() > 2000 {
        s.disk.seen.pop_front();
    }
    s.add(Transfer {
        quanta: q.clone(),
        direction: "received".into(),
        status: "delivered".into(),
        peer: peer.clone(),
    });
    if let Err(e) = s.save() {
        s.disk = old;
        return Err(e);
    }
    let auto_copy = s.disk.auto_copy;
    let notices = s.disk.notifications;
    drop(s);
    let copied = auto_copy
        && match app.clipboard().write_text(q.text) {
            Ok(()) => true,
            Err(e) => {
                state.inner.lock().await.error = Some(format!(
                    "Text received, but clipboard is busy: {e}. Copy it from history."
                ));
                false
            }
        };
    if notices {
        notification(app, &peer, copied);
    }
    let _ = app.emit("tunnel-changed", ());
    Ok(())
}
pub async fn serve(app: tauri::AppHandle, state: TunnelState) -> Result<(), String> {
    let listener = TcpListener::bind(("0.0.0.0", PORT))
        .await
        .map_err(|e| format!("Could not open local tunnel on port {PORT}: {e}"))?;
    let permits = Arc::new(Semaphore::new(8));
    loop {
        let (stream, addr) = listener.accept().await.map_err(|e| e.to_string())?;
        match addr.ip() {
            std::net::IpAddr::V4(ip) if ip.is_private() || ip.is_loopback() => {}
            _ => continue,
        }
        let Ok(permit) = permits.clone().try_acquire_owned() else {
            continue;
        };
        let app = app.clone();
        let state = state.clone();
        tokio::spawn(async move {
            let _permit = permit;
            let _ = connection(stream, app, state).await;
        });
    }
}
async fn connection(
    stream: tokio::net::TcpStream,
    app: tauri::AppHandle,
    state: TunnelState,
) -> Result<(), String> {
    stream.set_nodelay(true).map_err(|e| e.to_string())?;
    let config = WebSocketConfig::default()
        .max_message_size(Some(270000))
        .max_frame_size(Some(270000));
    let mut ws = tokio::time::timeout(
        Duration::from_secs(5),
        tokio_tungstenite::accept_async_with_config(stream, Some(config)),
    )
    .await
    .map_err(|_| "Handshake timeout")?
    .map_err(|e| e.to_string())?;
    let key = state.inner.lock().await.disk.key.clone();
    let first = tokio::time::timeout(Duration::from_secs(5), ws.next())
        .await
        .map_err(|_| "Pairing timeout")?
        .ok_or("Closed")?
        .map_err(|e| e.to_string())?;
    let Wire::Hello {
        device_id,
        device_name,
        token,
    } = protocol::open(first.to_text().map_err(|_| "Invalid hello")?, &key)?
    else {
        return Err("Hello required".into());
    };
    if device_id.len() < 8
        || device_id.len() > 64
        || device_name.trim().is_empty()
        || device_name.len() > 80
    {
        return Err("Invalid device".into());
    }
    let (mut receiver, generation, welcome) = {
        let mut s = state.inner.lock().await;
        if key != s.disk.key {
            return Err("Pairing changed".into());
        }
        match &s.disk.peer_id {
            Some(id) if id == &device_id => {}
            Some(_) => return Err("Another device is paired".into()),
            None => {
                if !matches!(&s.session,Some((t,expires)) if t==&token&&*expires>now()) {
                    return Err("Expired pairing code".into());
                }
                s.disk.peer_id = Some(device_id);
                s.disk.peer_name = Some(device_name);
                s.session = None;
                s.save()?;
            }
        }
        s.generation += 1;
        let generation = s.generation;
        let (tx, rx) = mpsc::channel(32);
        s.sender = Some(tx);
        (
            rx,
            generation,
            Wire::Welcome {
                server_id: s.disk.server_id.clone(),
                desktop_name: s.disk.device_name.clone(),
            },
        )
    };
    let _ = app.emit("tunnel-changed", ());
    let result=async{
        ws.send(Message::Text(protocol::seal(&welcome,&key)?.into())).await.map_err(|e|e.to_string())?;
        let mut heartbeat=tokio::time::interval(Duration::from_secs(10));let mut last=tokio::time::Instant::now();
        loop{
            tokio::select!{
                outgoing=receiver.recv()=>{
                    let Some(message)=outgoing else{break;};
                    ws.send(Message::Text(protocol::seal(&message,&key)?.into())).await.map_err(|e|e.to_string())?;
                },
                incoming=ws.next()=>{
                    if state.inner.lock().await.generation!=generation{break;}
                    let Some(frame)=incoming else{break;};let frame=frame.map_err(|e|e.to_string())?;
                    match frame{
                        Message::Text(raw)=>{last=tokio::time::Instant::now();match protocol::open(raw.as_str(),&key)?{
                            Wire::Text{quanta}=>{let id=quanta.id.clone();receive(&app,&state,quanta).await?;ws.send(Message::Text(protocol::seal(&Wire::Ack{id},&key)?.into())).await.map_err(|e|e.to_string())?;},
                            Wire::Ack{id}=>{if let Some(receipt)=state.inner.lock().await.pending.remove(&id){let _=receipt.send(());}},
                            Wire::Ping=>ws.send(Message::Text(protocol::seal(&Wire::Pong,&key)?.into())).await.map_err(|e|e.to_string())?,
                            Wire::Pong=>{},_=>return Err("Unexpected message".into())
                        }},
                        Message::Close(_)=>break,Message::Ping(bytes)=>{ws.send(Message::Pong(bytes)).await.map_err(|e|e.to_string())?;},_=>return Err("Invalid frame type".into())
                    }
                },
                _=heartbeat.tick()=>{if last.elapsed()>Duration::from_secs(30){break;}ws.send(Message::Text(protocol::seal(&Wire::Ping,&key)?.into())).await.map_err(|e|e.to_string())?;}
            }
        }
        Ok::<(),String>(())
    }.await;
    let mut s = state.inner.lock().await;
    if s.generation == generation {
        s.sender = None;
        s.pending.clear();
    }
    drop(s);
    let _ = app.emit("tunnel-changed", ());
    result
}
