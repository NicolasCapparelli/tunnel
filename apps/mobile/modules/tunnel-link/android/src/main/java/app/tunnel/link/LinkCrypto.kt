package app.tunnel.link
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object LinkCrypto {
  private fun decode(value: String): ByteArray { require(value.length % 2 == 0 && value.matches(Regex("[a-f0-9]+"))); return ByteArray(value.length / 2) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() } }
  private fun hex(value: ByteArray): String { val chars = CharArray(value.size * 2); val alphabet = "0123456789abcdef"; value.forEachIndexed { i, b -> val n = b.toInt() and 255; chars[i*2] = alphabet[n ushr 4]; chars[i*2+1] = alphabet[n and 15] }; return String(chars) }
  fun seal(message: String, key: String, nonce: ByteArray = ByteArray(12).also { SecureRandom().nextBytes(it) }): String {
    require(nonce.size == 12)
    val cipher = Cipher.getInstance("ChaCha20-Poly1305")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(decode(key), "ChaCha20"), IvParameterSpec(nonce))
    return hex(nonce + cipher.doFinal(message.toByteArray(Charsets.UTF_8)))
  }
  fun open(frame: String, key: String): String {
    require(frame.length in 56..1000000)
    val bytes = decode(frame); val cipher = Cipher.getInstance("ChaCha20-Poly1305")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(decode(key), "ChaCha20"), IvParameterSpec(bytes.copyOfRange(0, 12)))
    return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }
}
