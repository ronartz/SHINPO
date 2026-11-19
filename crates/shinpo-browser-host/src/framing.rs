use crate::HostError;
use std::io::{self, Read, Write};

/// Reads a single native messaging frame (4-byte length prefix in native endianness, followed by JSON payload).
pub fn read_message<R: Read>(
    reader: &mut R,
    max_bytes: usize,
) -> Result<Option<Vec<u8>>, HostError> {
    let mut len_bytes = [0u8; 4];
    match reader.read_exact(&mut len_bytes) {
        Ok(()) => {}
        Err(err) if err.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(err) => return Err(HostError::Io(err)),
    }

    let raw_len = u32::from_le_bytes(len_bytes);
    if raw_len == 0 {
        return Err(HostError::InvalidRequest(
            "Native message length is zero".into(),
        ));
    }
    const MAX_ALLOWED: u32 = 1_048_576; // 1MB native messaging limit
    let max_u32 = std::cmp::min(max_bytes as u32, MAX_ALLOWED);
    if raw_len > max_u32 {
        return Err(HostError::InvalidRequest(format!(
            "Native message length {raw_len} exceeds limit of {max_u32} bytes"
        )));
    }

    let len = raw_len as usize;
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).map_err(HostError::Io)?;
    Ok(Some(buf))
}

/// Writes a single native messaging frame (4-byte length prefix in native endianness, followed by JSON payload).
pub fn write_message<W: Write>(
    writer: &mut W,
    bytes: &[u8],
    max_bytes: usize,
) -> Result<(), HostError> {
    let len = bytes.len();
    if len > max_bytes {
        return Err(HostError::InvalidRequest(format!(
            "Outgoing message size {len} exceeds limit of {max_bytes} bytes"
        )));
    }

    let len_bytes = (len as u32).to_ne_bytes();
    writer.write_all(&len_bytes).map_err(HostError::Io)?;
    writer.write_all(bytes).map_err(HostError::Io)?;
    writer.flush().map_err(HostError::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_framing_round_trip() {
        let payload = b"{\"hello\":\"world\"}";
        let mut sink = Vec::new();
        write_message(&mut sink, payload, 1024).expect("write failed");

        let mut source = Cursor::new(sink);
        let read = read_message(&mut source, 1024)
            .expect("read failed")
            .expect("eof");
        assert_eq!(read, payload);
    }

    #[test]
    fn test_framing_eof_handling() {
        let mut source = Cursor::new(Vec::new());
        let read = read_message(&mut source, 1024).expect("read failed");
        assert!(read.is_none());
    }

    #[test]
    fn test_oversized_frame_rejected_before_usize_cast() {
        // Frame exceeding 1MB (1_048_576 bytes) must reject immediately on u32 check
        let oversized: u32 = 2_000_000;
        let mut bytes = oversized.to_le_bytes().to_vec();
        bytes.extend_from_slice(&[0u8; 16]);
        let mut source = Cursor::new(bytes);
        let res = read_message(&mut source, 10_000_000);
        assert!(res.is_err(), "Must reject oversized message before allocating buffer");
        let err = res.unwrap_err().to_string();
        assert!(err.contains("exceeds limit"), "Expected bounds error: {err}");
    }
}
