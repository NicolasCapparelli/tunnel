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
  @Synchronized private fun saveRegistry(c: Context, raw: String) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, secret())
    val encrypted = Base64.encodeToString(cipher.iv + cipher.doFinal(raw.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    check(prefs(c).edit().putString("credentials", encrypted).commit()) { "Could not save pairing" }
  }
  @Synchronized private fun registry(c: Context): JSONObject? {
    val encoded = prefs(c).getString("credentials", null) ?: return null
    val data = Base64.decode(encoded, Base64.NO_WRAP)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
    return JSONObject(String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8))
  }
  @Synchronized fun configs(c: Context): JSONArray {
    val stored=registry(c) ?: return JSONArray()
    return stored.optJSONArray("devices") ?: JSONArray().put(stored)
  }
  @Synchronized fun config(c: Context, id: String? = null): JSONObject? {
    val items=configs(c); val target=id ?: destinations(c).firstOrNull()
    for(i in 0 until items.length()) if(items.getJSONObject(i).getString("serverId")==target)return items.getJSONObject(i)
    return if(id==null&&items.length()>0)items.getJSONObject(0) else null
  }
  @Synchronized fun saveConfig(c: Context, raw: String) {
    inbox(c) // Tag legacy records before adding/replacing a pairing.
    val next=JSONObject(raw); val items=configs(c); val output=JSONArray();var found=false
    for(i in 0 until items.length()){val old=items.getJSONObject(i);if(old.getString("serverId")==next.getString("serverId")){output.put(next);found=true}else output.put(old)}
    if(!found){require(output.length()<8){"Link up to eight desktops"};output.put(next)}
    saveRegistry(c,JSONObject().put("devices",output).toString())
    if(prefs(c).getString("destinations",null)==null)setDestinations(c,listOf(next.getString("serverId")))
  }
  @Synchronized fun clearConfig(c: Context,id: String) {
    inbox(c) // Preserve the source before removing the original pairing.
    val items=configs(c);val next=JSONArray();for(i in 0 until items.length())if(items.getJSONObject(i).getString("serverId")!=id)next.put(items.getJSONObject(i))
    saveRegistry(c,JSONObject().put("devices",next).toString());setDestinations(c,destinations(c).filter{it!=id})
    val queued=outgoing(c);for(i in 0 until queued.length())if(queued.getJSONObject(i).optString("serverId")==id)queued.getJSONObject(i).put("status","failed")
    check(prefs(c).edit().putString("outgoing",queued.toString()).commit())
  }
  @Synchronized fun destinations(c: Context): List<String> {
    val raw=prefs(c).getString("destinations",null)
    if(raw==null){val list=configs(c);return if(list.length()>0)listOf(list.getJSONObject(0).getString("serverId"))else emptyList()}
    val ids=JSONArray(raw);return (0 until ids.length()).map{ids.getString(it)}
  }
  @Synchronized fun setDestinations(c: Context,ids: List<String>) {
    val known=configs(c);val valid=(0 until known.length()).map{known.getJSONObject(it).getString("serverId")}.toSet()
    check(prefs(c).edit().putString("destinations",JSONArray(ids.filter{it in valid}.distinct()).toString()).commit())
  }
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
  @Synchronized fun inbox(c: Context): JSONArray {
    val items=state(c).getJSONArray("items")
    // Legacy inbox records belong to the first (original) pairing, not map iteration order.
    val peers=configs(c); val original=if(peers.length()>0)peers.getJSONObject(0) else null
    var migrated=false
    if(original!=null) for(i in 0 until items.length()) {
      val q=items.getJSONObject(i)
      if(!q.has("serverId")) { q.put("serverId",original.getString("serverId")).put("peer",original.getString("desktopName")); migrated=true }
    }
    if(migrated) { val s=state(c).put("items",items); check(prefs(c).edit().putString("inbox",s.toString()).commit()) }
    return items
  }
  @Synchronized fun clearInbox(c: Context) { check(prefs(c).edit().remove("inbox").commit()) }
  @Synchronized fun reviewDestination(c: Context,id: String?) {
    check(prefs(c).edit().putString("review-destination",id).commit())
  }
  @Synchronized fun takeReviewDestination(c: Context): String? {
    val id=prefs(c).getString("review-destination",null)
    check(prefs(c).edit().remove("review-destination").commit())
    return id?.takeIf { config(c,it)!=null }
  }
  @Synchronized fun settings(c: Context): JSONObject = JSONObject(prefs(c).getString("share-settings", """{"text":true,"image":false,"file":false}""")!!)
  @Synchronized fun setSettings(c: Context, raw: String) { val s = JSONObject(raw); listOf("text","image","file").forEach { s.getBoolean(it) }; check(prefs(c).edit().putString("share-settings", s.toString()).commit()) }
  @Synchronized fun outgoing(c: Context): JSONArray = JSONArray(prefs(c).getString("outgoing", "[]")!!)
  @Synchronized fun enqueue(c: Context, q: JSONObject, target: String? = null) {
    val ids=if(target!=null)listOf(target)else destinations(c)
    require(ids.isNotEmpty()){ "Choose a destination in Tunnel first" }
    val peers=ids.map{config(c,it) ?: error("Desktop is no longer linked")}
    val items=outgoing(c);require(items.length()+peers.size<=200){"Open Tunnel to review queued shares before adding more"}
    val stored=LinkFiles.store(c,q);val next=JSONArray()
    peers.forEach { peer -> next.put(JSONObject(stored.toString()).put("id",java.util.UUID.randomUUID().toString()).put("status","pending").put("serverId",peer.getString("serverId")).put("peer",peer.getString("desktopName"))) }
    for(i in 0 until items.length())next.put(items.getJSONObject(i))
    check(prefs(c).edit().putString("outgoing",next.toString()).commit())
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
