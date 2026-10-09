package app.tunnel.link

import android.content.Intent
import android.os.Build
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.json.JSONObject

class TunnelLinkModule : Module() {
  private var savePromise:Promise?=null
  private var saveSource:java.io.File?=null

  override fun definition() = ModuleDefinition {
    Name("TunnelLink")
    Events("onState")
    OnCreate { TunnelService.listener = { sendEvent("onState", emptyMap<String, String>()) } }
    OnDestroy { TunnelService.listener = null }
    OnActivityResult { _, (requestCode,resultCode,intent) ->
      if(requestCode==53179 && savePromise!=null){val promise=savePromise!!;val source=saveSource!!;savePromise=null;saveSource=null
        if(resultCode!=android.app.Activity.RESULT_OK||intent?.data==null)promise.resolve("")
        else Thread{try{val c=appContext.reactContext!!;c.contentResolver.openOutputStream(intent.data!!)!!.use{out->source.inputStream().use{it.copyTo(out)}};promise.resolve(intent.data.toString())}catch(e:Exception){promise.reject("SAVE_FAILED",e.message,e)}}.start()
      }
    }
    AsyncFunction("saveFile") { raw:String,promise:Promise ->
      try {
        val c=appContext.reactContext?:error("Missing context");val a=JSONObject(raw);val source=LinkFiles.owned(c,a.getString("uri"))
        if(Build.VERSION.SDK_INT>=29){
          val image=a.getString("mimeType").startsWith("image/");val collection=if(image)android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI else android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI
          val values=android.content.ContentValues().apply{put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME,a.getString("name"));put(android.provider.MediaStore.MediaColumns.MIME_TYPE,a.getString("mimeType"));put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,(if(image)android.os.Environment.DIRECTORY_PICTURES else android.os.Environment.DIRECTORY_DOWNLOADS)+"/Tunnel");put(android.provider.MediaStore.MediaColumns.IS_PENDING,1)}
          val uri=c.contentResolver.insert(collection,values)?:error("Could not create saved file")
          try{c.contentResolver.openOutputStream(uri)!!.use{out->source.inputStream().use{it.copyTo(out)}};values.clear();values.put(android.provider.MediaStore.MediaColumns.IS_PENDING,0);c.contentResolver.update(uri,values,null,null);promise.resolve(uri.toString())}catch(e:Exception){c.contentResolver.delete(uri,null,null);throw e}
        }else{
          check(savePromise==null){"A save dialog is already open"};savePromise=promise;saveSource=source
          val intent=Intent(Intent.ACTION_CREATE_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);type=a.getString("mimeType");putExtra(Intent.EXTRA_TITLE,a.getString("name"))}
          appContext.throwingActivity.runOnUiThread{try{appContext.throwingActivity.startActivityForResult(intent,53179)}catch(e:Exception){savePromise=null;saveSource=null;promise.reject("SAVE_FAILED",e.message,e)}}
        }
      }catch(e:Exception){promise.reject("SAVE_FAILED",e.message,e)}
    }
    AsyncFunction("start") { raw: String ->
      val c = appContext.reactContext ?: error("Missing Android context")
      val config = JSONObject(raw)
      require(config.getString("key").matches(Regex("[a-f0-9]{64}")))
      LinkStore.saveConfig(c, raw)
      val intent = Intent(c, TunnelService::class.java)
      c.startForegroundService(intent)
      if (Build.VERSION.SDK_INT >= 29) {
        val target = c.packageManager.getLaunchIntentForPackage(c.packageName)!!
        target.setClass(c, ShareActivity::class.java)
        target.action = Intent.ACTION_SEND
        val iconId = c.applicationInfo.icon
        val shortcut = ShortcutInfo.Builder(c, "tunnel-desktop").setShortLabel("Tunnel · " + config.getString("desktopName").take(25)).setLongLabel("Tunnel to " + config.getString("desktopName")).setIcon(Icon.createWithResource(c, iconId)).setIntent(target).setCategories(setOf("app.tunnel.TEXT_SHARE")).setLongLived(true).build()
        c.getSystemService(ShortcutManager::class.java).addDynamicShortcuts(listOf(shortcut))
      }
    }
    AsyncFunction("stop") {
      val c = appContext.reactContext ?: error("Missing Android context")
      c.stopService(Intent(c, TunnelService::class.java)); LinkStore.clearConfig(c); LinkStore.clearInbox(c)
      c.getSystemService(ShortcutManager::class.java).removeDynamicShortcuts(listOf("tunnel-desktop"))
    }
    Function("snapshot") {
      val c = appContext.reactContext ?: error("Missing Android context")
      JSONObject().put("status", TunnelService.instance?.status ?: "offline").put("desktopName", LinkStore.config(c)?.optString("desktopName")).put("inbox", LinkStore.inbox(c)).put("outgoing", LinkStore.outgoing(c)).put("error", TunnelService.instance?.error).toString()
    }
    Function("shareSettings") { val c = appContext.reactContext ?: error("Missing Android context"); LinkStore.settings(c).toString() }
    AsyncFunction("setShareSettings") { raw: String -> val c = appContext.reactContext ?: error("Missing Android context"); LinkStore.setSettings(c, raw) }
    AsyncFunction("releaseFiles") { uris: List<String> ->
      val c = appContext.reactContext ?: error("Missing Android context")
      val root = java.io.File(c.filesDir, "attachments").canonicalFile
      val keep = mutableSetOf<String>()
      for (list in listOf(LinkStore.inbox(c), LinkStore.outgoing(c))) for (i in 0 until list.length()) {
        val files = list.getJSONObject(i).optJSONArray("attachments") ?: continue
        for (j in 0 until files.length()) keep.add(files.getJSONObject(j).optString("uri"))
      }
      for (uri in uris) if (!keep.contains(uri)) {
        val parsed = android.net.Uri.parse(uri)
        if (parsed.scheme == "file") {
          val file = java.io.File(parsed.path ?: "").canonicalFile
          if (file.toPath().startsWith(root.toPath()) && file != root) file.delete()
        }
      }
    }
    AsyncFunction("consumeOutgoing") { ids: List<String> -> val c = appContext.reactContext ?: error("Missing Android context"); LinkStore.consumeOutgoing(c, ids) }
    AsyncFunction("consume") { ids: List<String> -> val c = appContext.reactContext ?: error("Missing Android context"); LinkStore.consume(c, ids) }
    AsyncFunction("send") { raw: String, promise: Promise ->
      val service = TunnelService.instance
      if (service == null) promise.reject("OFFLINE", "Desktop is offline. Your draft is safe.", null)
      else service.sendQuanta(JSONObject(raw), promise)
    }
  }
}
