package app.tunnel.link

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import expo.modules.kotlin.Promise

/** One foreground lifecycle, independent authenticated sessions per desktop. */
class TunnelService : Service() {
  companion object { @Volatile var instance: TunnelService? = null; @Volatile var listener: (() -> Unit)? = null }
  private val sessions = java.util.concurrent.ConcurrentHashMap<String, PeerSession>()
  private val failedPeers = java.util.concurrent.ConcurrentHashMap<String, JSONObject>()
  override fun onBind(intent: Intent?) = null
  fun changed() { listener?.invoke() }
  fun notice(channel: String, title: String, text: String): Notification.Builder {
    val launch = packageManager.getLaunchIntentForPackage(packageName)!!.apply { flags=Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP }
    return Notification.Builder(this,channel).setSmallIcon(R.drawable.tunnel_notification).setContentTitle(title).setContentText(text).setContentIntent(PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).setCategory(Notification.CATEGORY_MESSAGE).setAutoCancel(true)
  }
  override fun onCreate() {
    super.onCreate(); instance=this
    val manager=getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("tunnel-link","Tunnel connection",NotificationManager.IMPORTANCE_LOW))
    manager.createNotificationChannel(NotificationChannel("tunnel-receipts-v2","Quanta receipts",NotificationManager.IMPORTANCE_HIGH))
    val notification=notice("tunnel-link","Tunnel is available","Ready to receive from your linked desktops.").setOngoing(true).build()
    if(Build.VERSION.SDK_INT>=34) startForeground(53177,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING) else startForeground(53177,notification)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val configs=LinkStore.configs(this)
      val keep=(0 until configs.length()).map { configs.getJSONObject(it).getString("serverId") }.toSet()
      sessions.keys.filter { it !in keep }.toList().forEach { sessions.remove(it)?.close() }
      failedPeers.clear()
      for(i in 0 until configs.length()) {
        val c=configs.getJSONObject(i); val id=c.getString("serverId")
        try { val existing=sessions[id]; if(existing==null) sessions[id]=PeerSession(this,c) else existing.update(c) }
        catch(e:Exception) { failedPeers[id]=JSONObject().put("serverId",id).put("status","offline").put("desktopName",c.optString("desktopName")).put("error",e.message) }
      }
      if(configs.length()==0) { stopSelf();return START_NOT_STICKY }
      changed()
    } catch(e:Exception) { changed();stopSelf();return START_NOT_STICKY }
    return START_STICKY
  }
  fun snapshot(): JSONArray {
    val result=JSONArray()
    sessions.forEach { (id,s) -> result.put(JSONObject().put("serverId",id).put("status",s.status).put("desktopName",s.desktopName).put("error",s.error)) }
    failedPeers.values.forEach { result.put(it) }
    return result
  }
  fun sendQuanta(raw: JSONObject,promise: Promise) {
    val id=raw.optString("serverId")
    val session=sessions[id]
    if(session==null)promise.reject("OFFLINE","Selected desktop is offline. Your draft is safe.",null) else session.sendQuanta(raw,promise)
  }
  override fun onDestroy() { sessions.values.toList().forEach { it.close() };sessions.clear();instance=null;changed();super.onDestroy() }
}
