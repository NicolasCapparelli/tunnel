use crate::protocol::{self, Attachment, Quanta, Wire};
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
static THUMBNAILS: std::sync::LazyLock<Arc<Semaphore>> =
    std::sync::LazyLock::new(|| Arc::new(Semaphore::new(2)));
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
        let previous: Option<Disk> = std::fs::read(&self.path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok());
        let data = serde_json::to_vec(&self.disk).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("tmp");
        std::fs::write(&tmp, data).map_err(|e| format!("Could not save history: {e}"))?;
        std::fs::rename(tmp, &self.path).map_err(|e| format!("Could not save history: {e}"))?;
        let root = self.path.parent().unwrap().join("attachments");
        if let Some(previous) = previous {
            for item in previous.history {
                if !self
                    .disk
                    .history
                    .iter()
                    .any(|t| t.quanta.id == item.quanta.id)
                {
                    let target = root.join(&item.quanta.id);
                    if target.parent() == Some(root.as_path())
                        && item
                            .quanta
                            .id
                            .bytes()
                            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
                    {
                        let _ = std::fs::remove_dir_all(target);
                    }
                }
            }
        }
        Ok(())
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
    attachments: Option<Vec<Attachment>>,
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let mut q = Quanta {
        id: id.clone(),
        text,
        created_at: now(),
        attachments: attachments.unwrap_or_default(),
    };
    if !protocol::valid_quanta(&q) {
        return Err("Add text or files, up to 64 KB text and 250 MB attachments.".into());
    }
    let (sender, receipt, directory) = {
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
            q = item.quanta.clone();
            item.status = "pending".into();
        } else {
            let peer = s.disk.peer_name.clone().unwrap_or_else(|| "Phone".into());
            let stored = store_files(&s.path, &q)?;
            q = stored.clone();
            s.add(Transfer {
                quanta: stored,
                direction: "sent".into(),
                status: "pending".into(),
                peer,
            });
        }

        s.save()?;
        let (tx, rx) = oneshot::channel();
        s.pending.insert(id.clone(), tx);
        (sender, rx, s.path.parent().unwrap().to_path_buf())
    };
    let _ = app.emit("tunnel-changed", ());
    let sent = send_files(&sender, &q, &directory).await.is_ok();
    let received = sent
        && matches!(
            tokio::time::timeout(Duration::from_secs(300), receipt).await,
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
        "Quanta received. Click to open Tunnel."
    };
    let _ = app.run_on_main_thread(move || {
        #[cfg(windows)]
        let result = {
            use tauri_winrt_notification::Toast;
            // Standalone release executables have no installer-created identity.
            let app_id = if crate::notifications::register_identity().is_ok() {
                "app.tunnel.desktop"
            } else {
                Toast::POWERSHELL_APP_ID
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
async fn receive(
    app: &tauri::AppHandle,
    state: &TunnelState,
    q: Quanta,
    streamed: bool,
) -> Result<(), String> {
    if !protocol::valid_quanta(&q) {
        return Err("Invalid quanta".into());
    }
    let mut s = state.inner.lock().await;
    if s.disk.seen.contains(&q.id) {
        return Ok(());
    }
    if !streamed && q.attachments.iter().any(|a| a.data.is_none()) {
        return Err("Missing file data".into());
    }
    let q = if streamed {
        q
    } else {
        store_files(&s.path, &q)?
    };
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
    let copied = if auto_copy
        && q.attachments.len() == 1
        && q.attachments[0].mime_type.starts_with("image/")
    {
        let path = {
            let s = state.inner.lock().await;
            s.path
                .parent()
                .unwrap()
                .join(format!("attachments/{}/0", q.id))
        };
        match copy_file(app, &path, &q.attachments[0].mime_type) {
            Ok(()) => true,
            Err(e) => {
                state.inner.lock().await.error =
                    Some(format!("Received; image clipboard failed: {e}"));
                false
            }
        }
    } else if auto_copy && !q.text.trim().is_empty() {
        app.clipboard().write_text(q.text).is_ok()
    } else {
        false
    };
    if notices {
        notification(app, &peer, copied);
    }
    let _ = app.emit("tunnel-arrived", ());
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
        .max_message_size(Some(protocol::MAX_FRAME))
        .max_frame_size(Some(protocol::MAX_FRAME));
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
                s.disk.peer_id = Some(device_id.clone());
                s.disk.peer_name = Some(device_name.clone());
                s.session = None;
                s.save()?;
            }
        }
        s.disk.peer_name = Some(device_name);
        s.save()?;
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
        let directory=state.inner.lock().await.path.parent().unwrap().to_path_buf();
        let mut inbound:Option<crate::stream::Incoming>=None;
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
                            Wire::Text{quanta}=>{let id=quanta.id.clone();receive(&app,&state,quanta,false).await?;ws.send(Message::Text(protocol::seal(&Wire::Ack{id},&key)?.into())).await.map_err(|e|e.to_string())?;},
                            Wire::Begin{quanta}=>{if inbound.is_some(){return Err("A file transfer is already active".into());}inbound=Some(crate::stream::Incoming::begin(quanta,&directory)?);},
                            Wire::Chunk{id,index,offset,data}=>{inbound.as_mut().ok_or("Missing file manifest")?.chunk(&id,index,offset,&data)?;},
                            Wire::End{id}=>{let incoming=inbound.take().ok_or("Missing file manifest")?;if incoming.q.id!=id||!incoming.complete(){return Err("Incomplete file transfer".into());}if !state.inner.lock().await.disk.seen.contains(&id){let q=incoming.finish(&directory)?;receive(&app,&state,q,true).await?;}ws.send(Message::Text(protocol::seal(&Wire::Ack{id},&key)?.into())).await.map_err(|e|e.to_string())?;},
                            Wire::Ack{id}=>{if let Some(receipt)=state.inner.lock().await.pending.remove(&id){let _=receipt.send(());}},
                            Wire::Ping=>ws.send(Message::Text(protocol::seal(&Wire::Pong,&key)?.into())).await.map_err(|e|e.to_string())?,
                            Wire::Name{name}=>{if name.trim().is_empty()||name.len()>80{return Err("Invalid device name".into());}let mut s=state.inner.lock().await;s.disk.peer_name=Some(name.trim().to_string());s.save()?;drop(s);let _=app.emit("tunnel-changed",());},
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

#[tauri::command]
pub async fn rename_device(
    name: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() || name.len() > 80 {
        return Err("Use a device name between 1 and 80 UTF-8 bytes.".into());
    }
    let mut s = state.inner.lock().await;
    let previous = s.disk.device_name.clone();
    s.disk.device_name = name.clone();
    if let Err(error) = s.save() {
        s.disk.device_name = previous;
        return Err(error);
    }
    let sender = s.sender.clone();
    drop(s);
    if let Some(sender) = sender {
        let _ = sender.try_send(Wire::Name { name });
    }
    let _ = app.emit("tunnel-changed", ());
    Ok(())
}

fn store_files(path: &std::path::Path, q: &Quanta) -> Result<Quanta, String> {
    let mut stored = q.clone();
    for (index, a) in stored.attachments.iter_mut().enumerate() {
        let relative = format!("attachments/{}/{index}", q.id);
        let dir = path.parent().ok_or("Missing data directory")?;
        let target = dir.join(&relative);
        std::fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
        if a.data.is_some() {
            std::fs::write(&target, protocol::attachment_bytes(a)?).map_err(|e| e.to_string())?;
        } else {
            let source = owned_path(dir, a.uri.as_deref().ok_or("Missing attachment")?)?;
            if std::fs::metadata(&source).map_err(|e| e.to_string())?.len() != a.size as u64 {
                return Err("Attachment size changed".into());
            }
            if source != target {
                std::fs::copy(source, &target).map_err(|e| e.to_string())?;
            }
        }
        a.data = None;
        a.uri = Some(relative);
    }
    Ok(stored)
}
#[tauri::command]
pub async fn save_attachment(
    id: String,
    index: usize,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let (source, name) = {
        let s = state.inner.lock().await;
        let q = &s
            .disk
            .history
            .iter()
            .find(|t| t.quanta.id == id)
            .ok_or("Transfer not found")?
            .quanta;
        let a = q.attachments.get(index).ok_or("Attachment not found")?;
        (
            s.path
                .parent()
                .unwrap()
                .join(format!("attachments/{}/{index}", q.id)),
            a.name.clone(),
        )
    };
    let chosen = rfd::AsyncFileDialog::new()
        .set_file_name(&name)
        .save_file()
        .await;
    if let Some(file) = chosen {
        tokio::task::spawn_blocking(move || {
            std::fs::copy(source, file.path())
                .map(|_| ())
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;
    }
    Ok(())
}

#[tauri::command]
pub async fn preview_attachment(
    id: String,
    index: usize,
    state: tauri::State<'_, TunnelState>,
) -> Result<String, String> {
    let source = {
        let s = state.inner.lock().await;
        let q = &s
            .disk
            .history
            .iter()
            .find(|t| t.quanta.id == id)
            .ok_or("Transfer not found")?
            .quanta;
        let a = q.attachments.get(index).ok_or("Attachment not found")?;
        if !a.mime_type.starts_with("image/") {
            return Err("This file is not an image".into());
        }
        s.path
            .parent()
            .unwrap()
            .join(format!("attachments/{}/{index}", q.id))
    };
    let permit = THUMBNAILS
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        thumbnail(&source)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn owned_path(dir: &std::path::Path, relative: &str) -> Result<PathBuf, String> {
    let path = std::path::Path::new(relative);
    if !(relative.starts_with("drafts/") || relative.starts_with("attachments/"))
        || path
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err("Invalid private file".into());
    }
    let target = dir.join(path).canonicalize().map_err(|e| e.to_string())?;
    if !target.starts_with(dir.canonicalize().map_err(|e| e.to_string())?) {
        return Err("Invalid private file".into());
    }
    Ok(target)
}
fn read_image(path: &std::path::Path) -> Result<image::DynamicImage, String> {
    let mut reader = image::ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(16384);
    limits.max_image_height = Some(16384);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    reader.decode().map_err(|e| e.to_string())
}
fn thumbnail(path: &std::path::Path) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let img = read_image(path)?.thumbnail(640, 480);
    let mut bytes = std::io::Cursor::new(Vec::new());
    img.write_to(&mut bytes, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(bytes.into_inner())
    ))
}
fn copy_file(app: &tauri::AppHandle, path: &std::path::Path, mime: &str) -> Result<(), String> {
    if mime.starts_with("image/") {
        let img = read_image(path)?.to_rgba8();
        let (w, h) = img.dimensions();
        app.clipboard()
            .write_image(&tauri::image::Image::new_owned(img.into_raw(), w, h))
            .map_err(|e| e.to_string())
    } else {
        #[cfg(windows)]
        {
            let _guard = clipboard_win::Clipboard::new_attempts(10).map_err(|e| e.to_string())?;
            use clipboard_win::Setter;
            clipboard_win::formats::FileList
                .write_clipboard(&[path.to_string_lossy().to_string()])
                .map_err(|e| e.to_string())
        }
        #[cfg(not(windows))]
        {
            app.clipboard()
                .write_text(path.to_string_lossy())
                .map_err(|e| e.to_string())
        }
    }
}
#[tauri::command]
pub async fn copy_attachment(
    id: String,
    index: usize,
    app: tauri::AppHandle,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    let (path, mime, name) = {
        let s = state.inner.lock().await;
        let q = &s
            .disk
            .history
            .iter()
            .find(|t| t.quanta.id == id)
            .ok_or("Transfer not found")?
            .quanta;
        let a = q.attachments.get(index).ok_or("File not found")?;
        (
            s.path
                .parent()
                .unwrap()
                .join(format!("attachments/{}/{index}", q.id)),
            a.mime_type.clone(),
            a.name.clone(),
        )
    };
    tokio::task::spawn_blocking(move || {
        if mime.starts_with("image/") {
            return copy_file(&app, &path, &mime);
        }
        // CF_HDROP exposes the file's actual basename to receiving applications.
        let safe_name: String = name
            .chars()
            .map(|c| {
                if c.is_control() || "<>:\"/\\|?*".contains(c) {
                    '_'
                } else {
                    c
                }
            })
            .collect();
        let safe_name = safe_name.trim_end_matches(['.', ' ']);
        let safe_name = if safe_name.is_empty() {
            "attachment"
        } else {
            safe_name
        };
        let directory = path
            .parent()
            .ok_or("File directory missing")?
            .join("clipboard")
            .join(index.to_string());
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let exported = directory.join(safe_name);
        if !exported.exists() {
            if std::fs::hard_link(&path, &exported).is_err() {
                std::fs::copy(&path, &exported).map_err(|e| e.to_string())?;
            }
        }
        copy_file(&app, &exported, &mime)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn preview_draft(
    uri: String,
    state: tauri::State<'_, TunnelState>,
) -> Result<String, String> {
    let path = {
        let s = state.inner.lock().await;
        owned_path(s.path.parent().unwrap(), &uri)?
    };
    let permit = THUMBNAILS
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        thumbnail(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn pick_attachments(
    state: tauri::State<'_, TunnelState>,
) -> Result<Vec<Attachment>, String> {
    let Some(files) = rfd::AsyncFileDialog::new().pick_files().await else {
        return Ok(vec![]);
    };
    if files.len() > 32 {
        return Err("Choose up to 32 files".into());
    }
    let directory = state
        .inner
        .lock()
        .await
        .path
        .parent()
        .unwrap()
        .to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut total = 0u64;
        let mut items = vec![];
        let folder = format!("drafts/{}", uuid::Uuid::new_v4());
        std::fs::create_dir_all(directory.join(&folder)).map_err(|e| e.to_string())?;
        for (i, file) in files.iter().enumerate() {
            let size = std::fs::metadata(file.path())
                .map_err(|e| e.to_string())?
                .len();
            total = total.checked_add(size).ok_or("Files too large")?;
            if total > protocol::MAX_ATTACHMENT_BYTES as u64 {
                return Err("Keep attachments under 250 MB per quanta".into());
            }
            let uri = format!("{folder}/{i}");
            std::fs::copy(file.path(), directory.join(&uri)).map_err(|e| e.to_string())?;
            items.push(Attachment {
                name: file.file_name(),
                mime_type: mime_guess::from_path(file.path())
                    .first_or_octet_stream()
                    .to_string(),
                size: size as usize,
                data: None,
                uri: Some(uri),
            });
        }
        Ok(items)
    })
    .await
    .map_err(|e| e.to_string())?
}
async fn send_files(
    sender: &mpsc::Sender<Wire>,
    q: &Quanta,
    dir: &std::path::Path,
) -> Result<(), String> {
    if q.attachments.is_empty() {
        return sender
            .send(Wire::Text { quanta: q.clone() })
            .await
            .map_err(|e| e.to_string());
    }
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::io::Read;
    let mut manifest = q.clone();
    for a in &mut manifest.attachments {
        a.uri = None;
        a.data = None;
    }
    sender
        .send(Wire::Begin { quanta: manifest })
        .await
        .map_err(|e| e.to_string())?;
    for (index, a) in q.attachments.iter().enumerate() {
        let mut file =
            std::fs::File::open(owned_path(dir, a.uri.as_deref().ok_or("Missing file")?)?)
                .map_err(|e| e.to_string())?;
        let mut buffer = vec![0; 49152];
        let mut offset = 0;
        loop {
            let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if count == 0 {
                break;
            }
            sender
                .send(Wire::Chunk {
                    id: q.id.clone(),
                    index,
                    offset,
                    data: STANDARD.encode(&buffer[..count]),
                })
                .await
                .map_err(|e| e.to_string())?;
            offset += count;
        }
        if offset != a.size {
            return Err("File size changed".into());
        }
    }
    sender
        .send(Wire::End { id: q.id.clone() })
        .await
        .map_err(|e| e.to_string())
}
