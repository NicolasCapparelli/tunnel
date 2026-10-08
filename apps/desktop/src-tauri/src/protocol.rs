use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Quanta {
    pub id: String,
    pub text: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Wire {
    #[serde(rename_all = "camelCase")]
    Hello {
        device_id: String,
        device_name: String,
        token: String,
    },
    #[serde(rename_all = "camelCase")]
    Welcome {
        server_id: String,
        desktop_name: String,
    },
    Text {
        quanta: Quanta,
    },
    Ack {
        id: String,
    },
    Ping,
    Pong,
}

pub fn valid_quanta(q: &Quanta) -> bool {
    !q.text.trim().is_empty()
        && q.text.len() <= 65536
        && q.id.len() >= 8
        && q.id.len() <= 64
        && q.id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
        && q.created_at > 0
        && q.created_at <= 9007199254740991
}
pub fn random_hex(size: usize) -> String {
    let mut bytes = vec![0; size];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}
pub fn seal_with_nonce(message: &Wire, key: &str, nonce: &[u8; 12]) -> Result<String, String> {
    let key = hex::decode(key).map_err(|_| "Invalid key")?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|_| "Invalid key")?;
    let payload = serde_json::to_vec(message).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(nonce), payload.as_ref())
        .map_err(|_| "Encryption failed")?;
    Ok(format!("{}{}", hex::encode(nonce), hex::encode(ciphertext)))
}
pub fn seal(message: &Wire, key: &str) -> Result<String, String> {
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    seal_with_nonce(message, key, &nonce)
}
pub fn open(frame: &str, key: &str) -> Result<Wire, String> {
    if frame.len() < 56 || frame.len() > 270000 {
        return Err("Invalid frame".into());
    }
    let bytes = hex::decode(frame).map_err(|_| "Invalid frame")?;
    let key = hex::decode(key).map_err(|_| "Invalid key")?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|_| "Invalid key")?;
    let payload = cipher
        .decrypt(Nonce::from_slice(&bytes[..12]), &bytes[12..])
        .map_err(|_| "Authentication failed")?;
    serde_json::from_slice(&payload).map_err(|_| "Invalid message".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_tampering_and_wrong_keys() {
        let frame = seal(&Wire::Ping, &"11".repeat(32)).unwrap();
        assert!(matches!(
            open(&frame, &"11".repeat(32)).unwrap(),
            Wire::Ping
        ));
        assert!(open(&frame, &"22".repeat(32)).is_err());
        let tampered = format!("{}00", &frame[..frame.len() - 2]);
        assert!(open(&tampered, &"11".repeat(32)).is_err());
    }
    #[test]
    fn unicode_byte_limit() {
        let mut q = Quanta {
            id: "valid-id-123".into(),
            text: "🌀".repeat(16384),
            created_at: 1,
        };
        assert!(valid_quanta(&q));
        q.text.push('x');
        assert!(!valid_quanta(&q));
    }
    #[test]
    fn javascript_fixture() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../../tests/fixtures/crypto.json")).unwrap();
        let key = fixture["key"].as_str().unwrap();
        let frame = fixture["frame"].as_str().unwrap();
        let nonce: [u8; 12] = hex::decode(fixture["nonce"].as_str().unwrap())
            .unwrap()
            .try_into()
            .unwrap();
        let message: Wire = serde_json::from_value(fixture["message"].clone()).unwrap();
        assert_eq!(seal_with_nonce(&message, key, &nonce).unwrap(), frame);
        assert!(matches!(open(frame, key).unwrap(), Wire::Text { .. }));
    }
}
