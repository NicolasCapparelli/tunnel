package app.tunnel.link
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** A native intake keeps text sharing independent of Metro and React startup. */
class ShareActivity : Activity() {
  private var handled = false
  override fun onCreate(state: Bundle?) { super.onCreate(state) }
  override fun onResume() {
    super.onResume(); if (handled) return; handled = true
    val source = intent
    val text = (if (source.action == Intent.ACTION_PROCESS_TEXT) source.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT) else source.getCharSequenceExtra(Intent.EXTRA_TEXT))?.toString() ?: ""
    val uris = mutableListOf<Uri>()
    if (source.action == Intent.ACTION_SEND_MULTIPLE) uris.addAll(source.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: emptyList())
    else source.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.add(it) }
    if (uris.isEmpty() && source.clipData != null) for (i in 0 until source.clipData!!.itemCount) source.clipData!!.getItemAt(i).uri?.let { uris.add(it) }
    val type = if (uris.isEmpty()) "text" else if (uris.all { contentResolver.getType(it)?.startsWith("image/") == true }) "image" else "file"
    val automatic = LinkStore.settings(this).optBoolean(type, type == "text")
    if (!automatic || LinkStore.config(this) == null) {
      val target = packageManager.getLaunchIntentForPackage(packageName)!!
      target.action = if (source.action == Intent.ACTION_PROCESS_TEXT) Intent.ACTION_SEND else source.action
      target.type = source.type ?: "text/plain"; target.putExtras(source)
      if (source.action == Intent.ACTION_PROCESS_TEXT) target.putExtra(Intent.EXTRA_TEXT, text)
      target.clipData = source.clipData; target.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(target); finish(); return
    }
    Thread {
      try {
        val files = JSONArray(); require(uris.size <= 32) { "Attach up to 32 files" }
        var total=0L
        for (uri in uris){val file=LinkFiles.import(this,uri);total+=file.getLong("size");require(total<=LinkFiles.MAX_BYTES) {"Keep attachments under 250 MB per quanta"};files.put(file)}
        val q = JSONObject().put("id", UUID.randomUUID().toString()).put("text", text).put("createdAt", System.currentTimeMillis()).put("attachments", files)
        LinkStore.enqueue(this, q)
        runOnUiThread {
          startForegroundService(Intent(this, TunnelService::class.java))
          Toast.makeText(this, "Tunneling in the background", Toast.LENGTH_SHORT).show(); finish()
        }
      } catch (e: Exception) { runOnUiThread { Toast.makeText(this, e.message ?: "Could not share", Toast.LENGTH_LONG).show(); finish() } }
    }.start()
  }
}
