use crate::protocol::{self, Quanta};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    io::Write,
    path::{Path, PathBuf},
};
pub struct Incoming {
    pub q: Quanta,
    root: PathBuf,
    offsets: Vec<usize>,
}
impl Incoming {
    pub fn begin(mut q: Quanta, dir: &Path) -> Result<Self, String> {
        if q.attachments.is_empty()
            || q.attachments
                .iter()
                .any(|a| a.data.is_some() || a.uri.is_some())
        {
            return Err("Invalid file manifest".into());
        }
        for a in &mut q.attachments {
            a.uri = Some("staging".into());
        }
        if !protocol::valid_quanta(&q) {
            return Err("Invalid file manifest".into());
        }
        let root = dir
            .join("incoming")
            .join(format!("{}-{}", q.id, uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        for (i, a) in q.attachments.iter_mut().enumerate() {
            std::fs::File::create(root.join(i.to_string())).map_err(|e| e.to_string())?;
            a.uri = Some(format!("attachments/{}/{i}", q.id));
        }
        let offsets = vec![0; q.attachments.len()];
        Ok(Self { q, root, offsets })
    }
    pub fn chunk(
        &mut self,
        id: &str,
        index: usize,
        offset: usize,
        data: &str,
    ) -> Result<(), String> {
        if id != self.q.id
            || index >= self.offsets.len()
            || offset != self.offsets[index]
            || data.len() > 65536
        {
            return Err("Invalid file chunk order".into());
        }
        let bytes = STANDARD
            .decode(data)
            .map_err(|_| "Invalid chunk encoding")?;
        if bytes.is_empty()
            || bytes.len() > 49152
            || offset
                .checked_add(bytes.len())
                .filter(|n| *n <= self.q.attachments[index].size)
                .is_none()
        {
            return Err("Invalid chunk length".into());
        }
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(self.root.join(index.to_string()))
            .map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        self.offsets[index] += bytes.len();
        Ok(())
    }
    pub fn complete(&self) -> bool {
        self.q
            .attachments
            .iter()
            .zip(&self.offsets)
            .all(|(a, n)| a.size == *n)
    }
    pub fn finish(&self, dir: &Path) -> Result<Quanta, String> {
        if !self.complete() {
            return Err("Incomplete attachment".into());
        }
        let target = dir.join("attachments").join(&self.q.id);
        std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        for i in 0..self.offsets.len() {
            std::fs::rename(self.root.join(i.to_string()), target.join(i.to_string()))
                .map_err(|e| e.to_string())?;
        }
        Ok(self.q.clone())
    }
}
impl Drop for Incoming {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Attachment;
    #[test]
    fn streams_beyond_the_previous_five_megabyte_limit() {
        let root =
            std::env::temp_dir().join(format!("tunnel-large-stream-{}", uuid::Uuid::new_v4()));
        let size = 8 * 1024 * 1024;
        let q = Quanta {
            id: "large-stream-123".into(),
            text: "".into(),
            created_at: 1,
            attachments: vec![Attachment {
                name: "large.bin".into(),
                mime_type: "application/octet-stream".into(),
                size,
                data: None,
                uri: None,
            }],
        };
        let mut incoming = Incoming::begin(q, &root).unwrap();
        let bytes = vec![7u8; 49152];
        let mut offset = 0;
        while offset < size {
            let count = (size - offset).min(bytes.len());
            incoming
                .chunk(
                    "large-stream-123",
                    0,
                    offset,
                    &STANDARD.encode(&bytes[..count]),
                )
                .unwrap();
            offset += count;
        }
        let q = incoming.finish(&root).unwrap();
        let path = root.join(q.attachments[0].uri.as_ref().unwrap());
        assert_eq!(std::fs::metadata(&path).unwrap().len(), size as u64);
        let data = std::fs::read(path).unwrap();
        assert!(data.iter().all(|v| *v == 7));
        drop(incoming);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn chunked_storage_rejects_gaps_and_incomplete_files() {
        let root = std::env::temp_dir().join(format!("tunnel-stream-{}", uuid::Uuid::new_v4()));
        let q = Quanta {
            id: "stream-test-123".into(),
            text: "note".into(),
            created_at: 1,
            attachments: vec![Attachment {
                name: "file.bin".into(),
                mime_type: "application/octet-stream".into(),
                size: 4,
                data: None,
                uri: None,
            }],
        };
        let mut stream = Incoming::begin(q, &root).unwrap();
        assert!(stream.chunk("stream-test-123", 0, 1, "AAEC").is_err());
        stream.chunk("stream-test-123", 0, 0, "AAEC").unwrap();
        assert!(!stream.complete());
        assert!(stream.finish(&root).is_err());
        assert!(stream.chunk("stream-test-123", 0, 3, "AwQ=").is_err());
        stream.chunk("stream-test-123", 0, 3, "Aw==").unwrap();
        let q = stream.finish(&root).unwrap();
        assert_eq!(
            std::fs::read(root.join(q.attachments[0].uri.as_ref().unwrap())).unwrap(),
            vec![0, 1, 2, 3]
        );
        drop(stream);
        let _ = std::fs::remove_dir_all(root);
    }
}
