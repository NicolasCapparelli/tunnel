package app.tunnel.link

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*
import okhttp3.*
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import expo.modules.kotlin.Promise

class TunnelService : Service() {
  companion object { @Volatile var instance: TunnelService? = null; @Volatile var listener: (() -> Unit)? = null }
  @Volatile var status = "offline"
  @Volatile var error: String? = null
  private val handler = Handler(Looper.getMainLooper())
  private val client = OkHttpClient.Builder().pingInterval(10, TimeUnit.SECONDS).build()
  private var socket: WebSocket? = null
  private var config: JSONObject? = null
  private var attempts = 0
  @Volatile private var generation = 0
  private var stopped = false
  private var incomingFiles:IncomingFiles?=null
  private var activeShare: String? = null
  private val pending = mutableMapOf<String, Pair<() -> Unit, (String) -> Unit>>()
  override fun onBind(intent: Intent?) = null
  private fun changed() { listener?.invoke() }
  override fun onCreate() {
    super.onCreate(); instance = this
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("tunnel-link", "Tunnel connection", NotificationManager.IMPORTANCE_LOW))
    manager.createNotificationChannel(NotificationChannel("tunnel-receipts-v2", "Quanta receipts", NotificationManager.IMPORTANCE_HIGH))
    val notification = notice("tunnel-link", "Tunnel is available", "Ready to receive from your linked desktop.").setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= 34) startForeground(53177, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
    else startForeground(53177, notification)
  }
  private fun notice(channel: String, title: String, text: String): Notification.Builder {
    val launch = packageManager.getLaunchIntentForPackage(packageName)!!.apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP }
    return Notification.Builder(this, channel).setSmallIcon(R.drawable.tunnel_notification).setContentTitle(title).setContentText(text).setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).setCategory(Notification.CATEGORY_MESSAGE).setAutoCancel(true)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val next = LinkStore.config(this) ?: run { stopSelf(); return START_NOT_STICKY }
      val old = config
      config = next
      if (old == null || old.getString("key") != next.getString("key") || old.getString("endpoint") != next.getString("endpoint") || old.getString("deviceId") != next.getString("deviceId")) {
        generation++; socket?.cancel(); handler.removeCallbacksAndMessages(null); rejectPending(); connect()
      } else if (old.getString("deviceName") != next.getString("deviceName") && status == "connected") transmit(JSONObject().put("type", "name").put("name", next.getString("deviceName")))
    } catch (e: Exception) { error = e.message; changed(); stopSelf() }
    if (status == "connected") drainShares()
    return START_STICKY
  }
  private fun connect() {
    if (stopped) return
    val c = config ?: return
    val uri = java.net.URI(c.getString("endpoint"))
    val host = uri.host ?: error("Missing desktop address")
    require(uri.scheme == "ws" && uri.path == "/tunnel" && uri.port in 1..65535 && host.matches(Regex("""(?:\d{1,3}\.){3}\d{1,3}""")))
    val ip = host.split('.').map { it.toInt() }; require(ip.all { it in 0..255 } && (ip[0] == 10 || ip[0] == 127 || ip[0] == 192 && ip[1] == 168 || ip[0] == 172 && ip[1] in 16..31))
    status = "connecting"; error = null; changed()
    val version = ++generation
    socket = client.newWebSocket(Request.Builder().url(uri.toString()).build(), object : WebSocketListener() {
      override fun onOpen(ws: WebSocket, response: Response) { handler.post {
        if (version != generation) { ws.cancel(); return@post }
        socket = ws
        transmit(JSONObject().put("type", "hello").put("deviceId", c.getString("deviceId")).put("deviceName", c.getString("deviceName")).put("token", c.getString("token")))
        handler.postDelayed({ if (version == generation && status != "connected") disconnected(version) }, 8000)
      } }
      override fun onMessage(ws: WebSocket, text: String) { val completed=java.util.concurrent.CountDownLatch(1); handler.post { try {
        if (version != generation) return@post
        try {
          val message = open(text)
          if (status != "connected") {
            require(message.getString("type") == "welcome" && message.getString("serverId") == c.getString("serverId")) { "Desktop identity mismatch" }
            updatePeer(message.getString("desktopName")); status = "connected"; attempts = 0; error = null; changed(); drainShares()
          } else when (message.getString("type")) {
            "text" -> {
              val q = message.getJSONObject("quanta"); LinkFiles.validate(q, true)
              val fresh = LinkStore.receive(this@TunnelService, q)
              transmit(JSONObject().put("type", "ack").put("id", q.getString("id")))
              if (fresh) {
                runCatching { getSystemService(NotificationManager::class.java).notify(q.getString("id").hashCode(), notice("tunnel-receipts-v2", "Quanta from " + config!!.getString("desktopName"), "Received. Tap to open Tunnel.").build()) }
                changed()
              }
            }
            "begin" -> {require(incomingFiles==null);incomingFiles=IncomingFiles(this@TunnelService,message.getJSONObject("quanta"))}
            "chunk" -> incomingFiles!!.chunk(message.getString("id"),message.getInt("index"),message.getLong("offset"),message.getString("data"))
            "end" -> {val incoming=incomingFiles ?: error("Missing manifest");val id=message.getString("id");require(id==incoming.q.getString("id")&&incoming.complete());incomingFiles=null
              if(!LinkStore.seen(this@TunnelService,id)){val q=incoming.finish();LinkStore.receive(this@TunnelService,q);runCatching{getSystemService(NotificationManager::class.java).notify(id.hashCode(),notice("tunnel-receipts-v2","Quanta from "+config!!.getString("desktopName"),"Received. Tap to view your quanta.").build())};changed()}else incoming.close()
              transmit(JSONObject().put("type","ack").put("id",id))
            }
            "ack" -> pending.remove(message.getString("id"))?.first?.invoke()
            "ping" -> transmit(JSONObject().put("type", "pong"))
            "pong" -> Unit
            "name" -> { updatePeer(message.getString("name")); changed() }
            else -> error("Unexpected message")
          }
        } catch (e: Exception) { error = e.message; disconnected(version) }
      } finally {completed.countDown()} };if(!completed.await(10,TimeUnit.SECONDS))ws.cancel() }
      override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) { handler.post { disconnected(version) } }
      override fun onClosed(ws: WebSocket, code: Int, reason: String) { handler.post { disconnected(version) } }
      override fun onClosing(ws: WebSocket, code: Int, reason: String) { ws.close(code, reason) }
    })
  }
  private fun updatePeer(name: String) { require(name.trim().isNotEmpty() && name.toByteArray(Charsets.UTF_8).size <= 80); config!!.put("desktopName", name); LinkStore.saveConfig(this, config!!.toString()) }
  private fun rejectPending() { pending.values.toList().forEach { it.second("Connection lost. Retry from history.") }; pending.clear() }
  private fun disconnected(version: Int) {
    if (version != generation || stopped) return
    generation++; socket?.cancel(); socket = null; incomingFiles?.close();incomingFiles=null; status = "offline"; rejectPending(); changed()
    val delay = minOf(1500L * (1L shl minOf(attempts++, 4)), 15000L)
    handler.postDelayed({ if (!stopped) { try { connect() } catch (e: Exception) { error = e.message; changed() } } }, delay)
  }
  fun sendQuanta(q: JSONObject, promise: Promise) = send(q, { promise.resolve(); drainShares() }, { promise.reject("SEND_FAILED", it, null) })
  private fun send(raw: JSONObject, success: () -> Unit, failure: (String) -> Unit) { handler.post {
    try {
      LinkFiles.validate(raw);check(status=="connected") {"Desktop is offline. Your draft is safe."};check(pending.isEmpty()) {"Wait for the current quanta to finish."}
      val id=raw.getString("id");pending[id]=Pair(success,failure);val version=generation;val ws=socket!!;val key=config!!.getString("key")
      Thread {
        try {
          fun frame(message:JSONObject){while(ws.queueSize()>262144){check(generation==version&&status=="connected");Thread.sleep(8)};check(generation==version&&ws.send(LinkCrypto.seal(message.toString(),key))) {"Connection lost"}}
          val files=raw.optJSONArray("attachments")
          if(files==null||files.length()==0)frame(JSONObject().put("type","text").put("quanta",raw))
          else {
            val manifest=JSONObject(raw.toString());val meta=manifest.getJSONArray("attachments");for(i in 0 until meta.length()){meta.getJSONObject(i).remove("uri");meta.getJSONObject(i).remove("data")}
            frame(JSONObject().put("type","begin").put("quanta",manifest))
            for(i in 0 until files.length()) {
              val a=files.getJSONObject(i);val source=LinkFiles.owned(this@TunnelService,a.getString("uri"));require(source.length()==a.getLong("size"));var offset=0L
              source.inputStream().use { input -> val buffer=ByteArray(49152);while(true){val count=input.read(buffer);if(count<0)break;frame(JSONObject().put("type","chunk").put("id",id).put("index",i).put("offset",offset).put("data",android.util.Base64.encodeToString(buffer.copyOf(count),android.util.Base64.NO_WRAP)));offset+=count} };require(offset==a.getLong("size"))
            };frame(JSONObject().put("type","end").put("id",id))
          }
          handler.postDelayed({pending.remove(id)?.second?.invoke("No receipt yet. Retry from history.")},300000)
        } catch(e:Exception){handler.post{pending.remove(id)?.second?.invoke(e.message?:"Send failed");disconnected(version)}}
      }.start()
    }catch(e:Exception){failure(e.message?:"Send failed")}
  } }
  fun drainShares() { handler.post {
    if (status != "connected" || pending.isNotEmpty() || activeShare != null) return@post
    val items = LinkStore.outgoing(this)
    for (i in items.length() - 1 downTo 0) {
      val q = items.getJSONObject(i); val id = q.getString("id")
      if (q.getString("status") == "pending" && q.optString("serverId") != config!!.getString("serverId")) { LinkStore.mark(this, id, "failed"); changed(); continue }
      if (q.getString("status") == "pending" && !pending.containsKey(id)) {
        activeShare = id
        send(q, { activeShare = null; LinkStore.mark(this, id, "delivered"); shareNotice("Tunneled to " + config!!.getString("desktopName")); changed(); drainShares() }, { activeShare = null; LinkStore.mark(this, id, "failed"); shareNotice(it); changed(); drainShares() })
        break
      }
    }
  } }
  private fun shareNotice(text: String) { runCatching { getSystemService(NotificationManager::class.java).notify(53178, notice("tunnel-receipts-v2", "Tunnel", text).build()) } }
  private fun transmit(message: JSONObject): Boolean = socket?.send(LinkCrypto.seal(message.toString(), config!!.getString("key"))) ?: false
  private fun open(frame: String): JSONObject = JSONObject(LinkCrypto.open(frame, config!!.getString("key")))
  override fun onDestroy() { incomingFiles?.close();incomingFiles=null; stopped = true; generation++; handler.removeCallbacksAndMessages(null); socket?.cancel(); rejectPending(); status = "offline"; instance = null; changed(); super.onDestroy() }
}
