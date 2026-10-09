package app.tunnel.link
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object LinkFiles {
  const val MAX_BYTES = 250 * 1024 * 1024
  fun validate(q: JSONObject, wire: Boolean = false) {
    val text = q.getString("text"); val time = q.getLong("createdAt")
    val files = q.optJSONArray("attachments") ?: JSONArray()
    require((text.trim().isNotEmpty() || files.length() > 0) && text.toByteArray(Charsets.UTF_8).size <= 65536 && q.getString("id").matches(Regex("[a-zA-Z0-9-]{8,64}")) && time > 0 && time <= 9007199254740991L) { "Invalid quanta" }
    require(files.length() <= 32) { "Attach up to 32 files" }; var total = 0L
    for (i in 0 until files.length()) {
      val a = files.getJSONObject(i); val name = a.getString("name"); val size = a.getLong("size")
      require(name.trim().isNotEmpty() && name.toByteArray(Charsets.UTF_8).size <= 255 && name.none { it == '/' || it == '\\' || it.code < 32 } && a.getString("mimeType").length <= 127 && a.getString("mimeType").matches(Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+")) && size in 0..MAX_BYTES) { "Invalid attachment" }
      total += size; require(total <= MAX_BYTES) { "Keep attachments under 250 MB per quanta" }
      if (a.has("data")) {
        val data = a.getString("data")
        require(data.length == 4 * ((size + 2) / 3).toInt() && data.dropLastWhile { it == '=' }.all { it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it == '+' || it == '/' } && data.takeLastWhile { it == '=' }.length <= 2)
        require(Base64.decode(data, Base64.NO_WRAP).size.toLong() == size)
      } else require(!wire && a.optString("uri").isNotEmpty()) { "Missing attachment data" }
    }
  }
  fun store(c: Context, raw: JSONObject): JSONObject {
    validate(raw); val q = JSONObject(raw.toString()); val files = q.optJSONArray("attachments") ?: return q
    for (i in 0 until files.length()) {
      val a = files.getJSONObject(i); val target = File(c.filesDir, "attachments/${q.getString("id")}/$i")
      target.parentFile!!.mkdirs()
      if(a.has("data")) target.writeBytes(Base64.decode(a.getString("data"), Base64.NO_WRAP))
      else {val source=owned(c,a.getString("uri"));require(source.length()==a.getLong("size"));if(source.canonicalFile!=target.canonicalFile)source.inputStream().use { input -> target.outputStream().use { input.copyTo(it) } }}
      a.remove("data"); a.put("uri", Uri.fromFile(target).toString())
    }; return q
  }
  fun wire(c: Context, raw: JSONObject): JSONObject {
    val q = JSONObject(raw.toString()); validate(q); val files = q.optJSONArray("attachments") ?: return q
    for (i in 0 until files.length()) {
      val a = files.getJSONObject(i)
      if (!a.has("data")) {
        val expected = File(c.filesDir, "attachments/${q.getString("id")}/$i")
        require(a.getString("uri") == Uri.fromFile(expected).toString()) { "Invalid local attachment" }
        val bytes = expected.readBytes(); require(bytes.size.toLong() == a.getLong("size"))
        a.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
      }; a.remove("uri")
    }; validate(q, true); return q
  }
  fun owned(c:Context, uri:String):File {
    val parsed=Uri.parse(uri); require(parsed.scheme=="file") {"Invalid private file"}
    val file=File(parsed.path!!).canonicalFile; val root=c.filesDir.canonicalFile
    require(file.toPath().startsWith(root.toPath()) && file!=root) {"Invalid private file"}; return file
  }
  fun import(c: Context, uri: Uri): JSONObject {
    require(uri.scheme=="content") {"Share files using a content provider"}
    var name="attachment";var size=-1L
    c.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use { cursor -> if(cursor.moveToFirst()){name=cursor.getString(0)?:name;size=cursor.getLong(1)} }
    require(size<=MAX_BYTES) {"Keep attachments under 250 MB per quanta"}
    name=name.replace(Regex("[\\\\/\u0000-\u001f]"),"_").take(80)
    val target=File(c.filesDir,"imports/${java.util.UUID.randomUUID()}/file");target.parentFile!!.mkdirs()
    var total=0L
    try { c.contentResolver.openInputStream(uri)!!.use { input -> target.outputStream().use { out -> val buffer=ByteArray(49152);while(true){val count=input.read(buffer);if(count<0)break;total+=count;require(total<=MAX_BYTES) {"Keep attachments under 250 MB per quanta"};out.write(buffer,0,count)} } }}catch(e:Exception){target.delete();throw e}
    return JSONObject().put("name",name).put("size",total).put("mimeType",c.contentResolver.getType(uri)?:"application/octet-stream").put("uri",Uri.fromFile(target).toString())
  }
}
