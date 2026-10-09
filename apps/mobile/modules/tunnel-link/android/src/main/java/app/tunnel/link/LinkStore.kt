package app.tunnel.link

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object LinkStore {
  private fun prefs(c: Context) = c.getSharedPreferences("tunnel-native", Context.MODE_PRIVATE)
  private fun secret(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = "tunnel-link-storage"
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  @Synchronized fun saveConfig(c: Context, raw: String) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, secret())
    val encrypted = Base64.encodeToString(cipher.iv + cipher.doFinal(raw.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    check(prefs(c).edit().putString("credentials", encrypted).commit()) { "Could not save pairing" }
  }
  @Synchronized fun config(c: Context): JSONObject? {
    val encoded = prefs(c).getString("credentials", null) ?: return null
    val data = Base64.decode(encoded, Base64.NO_WRAP)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
    return JSONObject(String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8))
  }
  @Synchronized fun clearConfig(c: Context) { check(prefs(c).edit().remove("credentials").commit()) }
  @Synchronized private fun state(c: Context) = JSONObject(prefs(c).getString("inbox", """{"items":[],"seen":[]}""")!!)
  @Synchronized fun seen(c:Context,id:String):Boolean {val ids=state(c).getJSONArray("seen");return (0 until ids.length()).any{ids.getString(it)==id}}
  @Synchronized fun receive(c: Context, q: JSONObject): Boolean {
    val id = q.getString("id"); val s = state(c); val seen = s.getJSONArray("seen")
    for (i in 0 until seen.length()) if (seen.getString(i) == id) return false
    val prior = s.getJSONArray("items"); val items = JSONArray().put(LinkFiles.store(c, q))
    for (i in 0 until minOf(199, prior.length())) items.put(prior.getJSONObject(i))
    val ids = JSONArray(); for (i in maxOf(0, seen.length() - 1999) until seen.length()) ids.put(seen.getString(i)); ids.put(id)
    s.put("items", items).put("seen", ids)
    check(prefs(c).edit().putString("inbox", s.toString()).commit()) { "Could not persist received text" }
    return true
  }
  @Synchronized fun consume(c: Context, ids: List<String>) {
    val s = state(c); val old = s.getJSONArray("items"); val items = JSONArray()
    for (i in 0 until old.length()) { val q = old.getJSONObject(i); if (!ids.contains(q.getString("id"))) items.put(q) }
    s.put("items", items); check(prefs(c).edit().putString("inbox", s.toString()).commit())
  }
  @Synchronized fun inbox(c: Context): JSONArray = state(c).getJSONArray("items")
  @Synchronized fun clearInbox(c: Context) { check(prefs(c).edit().remove("inbox").commit()) }
  @Synchronized fun settings(c: Context): JSONObject = JSONObject(prefs(c).getString("share-settings", """{"text":true,"image":false,"file":false}""")!!)
  @Synchronized fun setSettings(c: Context, raw: String) { val s = JSONObject(raw); listOf("text","image","file").forEach { s.getBoolean(it) }; check(prefs(c).edit().putString("share-settings", s.toString()).commit()) }
  @Synchronized fun outgoing(c: Context): JSONArray = JSONArray(prefs(c).getString("outgoing", "[]")!!)
  @Synchronized fun enqueue(c: Context, q: JSONObject) {
    val items = outgoing(c); require(items.length() < 200) { "Open Tunnel to review queued shares before adding more" }; val next = JSONArray().put(LinkFiles.store(c, q).put("status", "pending").put("serverId", config(c)!!.getString("serverId")))
    for (i in 0 until minOf(199, items.length())) next.put(items.getJSONObject(i))
    check(prefs(c).edit().putString("outgoing", next.toString()).commit())
  }
  @Synchronized fun mark(c: Context, id: String, status: String) {
    val items = outgoing(c); for (i in 0 until items.length()) if (items.getJSONObject(i).getString("id") == id) items.getJSONObject(i).put("status", status)
    check(prefs(c).edit().putString("outgoing", items.toString()).commit())
  }
  @Synchronized fun consumeOutgoing(c: Context, ids: List<String>) {
    val items = outgoing(c); val next = JSONArray()
    for (i in 0 until items.length()) if (!ids.contains(items.getJSONObject(i).getString("id"))) next.put(items.getJSONObject(i))
    check(prefs(c).edit().putString("outgoing", next.toString()).commit())
  }
}
