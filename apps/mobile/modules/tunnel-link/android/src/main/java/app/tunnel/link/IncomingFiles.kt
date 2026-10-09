package app.tunnel.link
import android.content.Context
import android.net.Uri
import android.util.Base64
import org.json.JSONObject
import java.io.File
class IncomingFiles(private val c:Context,raw:JSONObject) {
 val q=JSONObject(raw.toString());private val files=q.getJSONArray("attachments");private val offsets=LongArray(files.length());private val root:File
 init {
  require(files.length()>0)
  for(i in 0 until files.length()){val a=files.getJSONObject(i);require(!a.has("data")&&!a.has("uri"));a.put("uri","staging")}
  LinkFiles.validate(q);root=File(c.filesDir,"incoming/${q.getString("id")}-${java.util.UUID.randomUUID()}");root.mkdirs()
  for(i in 0 until files.length())File(root,i.toString()).writeBytes(byteArrayOf())
 }
 fun chunk(id:String,index:Int,offset:Long,data:String) {
  require(id==q.getString("id")&&index in offsets.indices&&offset==offsets[index]&&data.length<=65536) {"Invalid chunk order"}
  val bytes=Base64.decode(data,Base64.NO_WRAP);require(bytes.isNotEmpty()&&bytes.size<=49152&&offset+bytes.size<=files.getJSONObject(index).getLong("size")) {"Invalid chunk length"}
  File(root,index.toString()).appendBytes(bytes);offsets[index]+=bytes.size
 }
 fun complete():Boolean=(offsets.indices).all{offsets[it]==files.getJSONObject(it).getLong("size")}
 fun finish():JSONObject {require(complete());val destination=File(c.filesDir,"attachments/${q.getString("id")}");destination.mkdirs();for(i in offsets.indices){val target=File(destination,i.toString());require(File(root,i.toString()).renameTo(target));files.getJSONObject(i).put("uri",Uri.fromFile(target).toString())};close();return q}
 fun close(){root.deleteRecursively()}
}
