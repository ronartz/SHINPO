use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use crate::client::{RecordQuarantineRequest, SentinelClient};

#[derive(Debug, Clone)]
pub struct OfflineSpooler {
    spool_path: PathBuf,
}

impl OfflineSpooler {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            spool_path: path.into(),
        }
    }

    pub fn default_path() -> PathBuf {
        let candidates = [
            "daemon/quarantine_spool.jsonl",
            "quarantine_spool.jsonl",
            "../daemon/quarantine_spool.jsonl",
            "/var/log/shinpo/quarantine_spool.jsonl",
        ];

        for candidate in &candidates {
            if Path::new(candidate).exists() {
                return PathBuf::from(candidate);
            }
        }

        // Default to daemon/quarantine_spool.jsonl
        PathBuf::from("daemon/quarantine_spool.jsonl")
    }

    pub fn path(&self) -> &Path {
        &self.spool_path
    }

    /// Appends a single quarantine event to the local spool file in JSONL format.
    pub fn append(&self, record: &RecordQuarantineRequest) -> Result<(), String> {
        if let Some(parent) = self.spool_path.parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create spool directory {:?}: {}", parent, e))?;
            }
        }

        let serialized = serde_json::to_string(record)
            .map_err(|e| format!("Failed to serialize quarantine record for spooling: {}", e))?;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.spool_path)
            .map_err(|e| format!("Failed to open spool file {:?}: {}", self.spool_path, e))?;

        writeln!(file, "{}", serialized)
            .map_err(|e| format!("Failed to write to spool file: {}", e))?;

        file.flush()
            .map_err(|e| format!("Failed to flush spool file: {}", e))?;

        Ok(())
    }

    /// Reads all buffered quarantine records from the local spool.
    pub fn peek_all(&self) -> Result<Vec<RecordQuarantineRequest>, String> {
        if !self.spool_path.exists() {
            return Ok(Vec::new());
        }

        let file = OpenOptions::new()
            .read(true)
            .open(&self.spool_path)
            .map_err(|e| format!("Failed to open spool file {:?}: {}", self.spool_path, e))?;

        let reader = BufReader::new(file);
        let mut records = Vec::new();

        for (idx, line_res) in reader.lines().enumerate() {
            let line = line_res.map_err(|e| format!("Error reading line {} from spool: {}", idx + 1, e))?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            match serde_json::from_str::<RecordQuarantineRequest>(trimmed) {
                Ok(rec) => records.push(rec),
                Err(err) => {
                    eprintln!("⚠️ Corrupted spool line {}: {} (Skipping)", idx + 1, err);
                }
            }
        }

        Ok(records)
    }

    /// Clears/truncates the spool file once telemetry is successfully synced.
    pub fn clear(&self) -> Result<(), String> {
        if self.spool_path.exists() {
            fs::remove_file(&self.spool_path)
                .map_err(|e| format!("Failed to remove synced spool file {:?}: {}", self.spool_path, e))?;
        }
        Ok(())
    }

    /// Number of queued offline records.
    pub fn len(&self) -> usize {
        self.peek_all().map(|v| v.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Flushes all pending spooled records to the Sentinel backend in a single batch.
    /// On HTTP 200/201 success, automatically truncates the local spool.
    pub fn flush_to_client(&self, client: &SentinelClient) -> Result<usize, String> {
        let records = self.peek_all()?;
        if records.is_empty() {
            return Ok(0);
        }

        let resp = client.report_quarantines_batch(&records)?;
        self.clear()?;
        Ok(resp.saved_count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_spool_path() -> PathBuf {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("shinpo_test_spool_{}.jsonl", ts))
    }

    #[test]
    fn test_spooler_lifecycle() {
        let path = temp_spool_path();
        let spooler = OfflineSpooler::new(&path);

        assert_eq!(spooler.len(), 0);
        assert!(spooler.is_empty());
        assert_eq!(spooler.peek_all().unwrap().len(), 0);

        let rec1 = RecordQuarantineRequest {
            pid: 1234,
            process_name: "distraction_game".to_string(),
            command_line: Some("/opt/distraction".to_string()),
            policy_action: "TERMINATED".to_string(),
            enforcement_mode: "STRICT".to_string(),
            reason: "Focus session active".to_string(),
        };

        let rec2 = RecordQuarantineRequest {
            pid: 5678,
            process_name: "chat_app".to_string(),
            command_line: None,
            policy_action: "CONTAINED".to_string(),
            enforcement_mode: "CONTAINMENT".to_string(),
            reason: "Non-whitelisted communication app".to_string(),
        };

        spooler.append(&rec1).expect("Failed to append rec1");
        assert_eq!(spooler.len(), 1);
        assert!(!spooler.is_empty());

        spooler.append(&rec2).expect("Failed to append rec2");
        assert_eq!(spooler.len(), 2);

        let all = spooler.peek_all().expect("Failed to peek records");
        assert_eq!(all.len(), 2);
        assert_eq!(all[0], rec1);
        assert_eq!(all[1], rec2);

        // Clear spooler
        spooler.clear().expect("Failed to clear spooler");
        assert_eq!(spooler.len(), 0);
        assert!(spooler.is_empty());
        assert_eq!(spooler.peek_all().unwrap().len(), 0);

        // Cleanup
        let _ = fs::remove_file(&path);
    }
}
