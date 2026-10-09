package app.tunnel.link
import org.junit.Test
import org.junit.Assert.*

class LinkCryptoTest {
  private val key = "1111111111111111111111111111111111111111111111111111111111111111"
  private val frame = "222222222222222222222222fe57a1674df58f4dff1694848f20e64d568820f62fb3f0cc057f468597ae88312351d60da6c966b4f3ffbb2a893135c714e22be006b13aaa46c1d3e9146a28b3c04ece86ee6d6ff911302a180e239edd9764c3e6815b6c30b0f81059dce732e0dd5ea71c5e7c71bacafe580a916d20b78efd9a7ccefb6f2abf2915273eef841f3d9e1ddc70a44bed3da59d671761070cf405ff79"
  private val message = """{"type":"text","quanta":{"id":"fixture-quanta-001","text":"Hello from the other side 🌀\nSecond line.","createdAt":1791475200000}}"""
  @Test fun readsAndWritesAttachmentFixture() {
    val raw = """{"type":"text","quanta":{"id":"fixture-file-001","text":"Photo note","createdAt":1791475200000,"attachments":[{"name":"photo.png","mimeType":"image/png","size":3,"data":"AAEC"}]}}"""
    val encoded = "222222222222222222222222fe57a1674df58f4dff1694848f20e64d568820f62fb3f0cc057f468597ae88312351d60da6c966a3eff2b073d82c34d509e273a70aa060e446ab99ce056964b28f5cd9cbaf6f78e311713109020798dfde3c90ba909fc48902944e3a89b471acd80abf14537132fd88a8485ace572ff084dd833bd6f07a63e672567d22afda482f8242ccce41e689730dd2a2a5176657d0de8c29d8aa3184067230d43c1ebeba3e4b778daf1585278224f3a64089b220285568033151638a901d14a200278cb370d57d"
    assertEquals(raw, LinkCrypto.open(encoded, key)); assertEquals(encoded, LinkCrypto.seal(raw,key,ByteArray(12) {0x22}))
  }
  @Test fun readsJavaScriptFixture() { assertEquals(message, LinkCrypto.open(frame, key)) }
  @Test fun writesSameFrameAsJavaScript() { assertEquals(frame, LinkCrypto.seal(message, key, ByteArray(12) { 0x22 })) }
  @Test fun rejectsTamperingAndWrongKey() {
    try { LinkCrypto.open(frame.dropLast(1) + "0", key); fail("Tampering accepted") } catch (_: javax.crypto.AEADBadTagException) {}
    try { LinkCrypto.open(frame, "33".repeat(32)); fail("Wrong key accepted") } catch (_: javax.crypto.AEADBadTagException) {}
  }
}
