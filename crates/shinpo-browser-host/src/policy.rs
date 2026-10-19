use std::fs;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::config::{atomic_write_json, HostPaths};
use crate::HostError;

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PolicySource {
    Desktop,
    Backend,
    LocalException,
}

#[derive(Clone, Debug)]
pub struct PolicyStore {
    paths: HostPaths,
}

impl PolicyStore {
    pub fn new(paths: HostPaths) -> Self {
        Self { paths }
    }

    pub fn apply_snapshot(
        &mut self,
        mut snapshot: Value,
        source: PolicySource,
        lease_seconds: u64,
        now_ms: u64,
    ) -> Result<Value, HostError> {
        let lease_expires_at = now_ms + (lease_seconds * 1000);
        if let Some(obj) = snapshot.as_object_mut() {
            obj.insert("_hostLeaseExpiresAtMs".to_string(), json!(lease_expires_at));
            obj.insert(
                "_policySource".to_string(),
                json!(match source {
                    PolicySource::Desktop => "desktop",
                    PolicySource::Backend => "backend",
                    PolicySource::LocalException => "local-exception",
                }),
            );
            obj.insert("_hostReceivedAtMs".to_string(), json!(now_ms));
        }

        self.paths.secure_directories()?;
        atomic_write_json(&self.paths.policy, &snapshot)?;
        Ok(snapshot)
    }

    pub fn load_valid(&self, now_ms: u64) -> Result<Value, HostError> {
        if !self.paths.policy.exists() {
            return Ok(inactive_policy("No active Focus policy configured"));
        }

        let bytes = match fs::read(&self.paths.policy) {
            Ok(b) => b,
            Err(_) => return Ok(inactive_policy("Unable to read policy cache")),
        };

        let value: Value = match serde_json::from_slice(&bytes) {
            Ok(v) => v,
            Err(_) => return Ok(inactive_policy("Malformed policy cache")),
        };

        let lease_expires_at = value.get("_hostLeaseExpiresAtMs").and_then(Value::as_u64).unwrap_or(0);
        if lease_expires_at <= now_ms {
            return Ok(inactive_policy("Policy lease expired; companion awaiting sync"));
        }

        let status = value.get("status").and_then(Value::as_str).unwrap_or("INACTIVE");
        if status != "ACTIVE" {
            return Ok(inactive_policy("Focus session is not active"));
        }

        Ok(value)
    }

    pub fn clear(&self) -> Result<(), HostError> {
        if self.paths.policy.exists() {
            let _ = fs::remove_file(&self.paths.policy);
        }
        Ok(())
    }
}

pub fn inactive_policy(reason: &str) -> Value {
    json!({
        "status": "INACTIVE",
        "inactiveReason": reason,
        "mode": "GUIDED",
        "policyVersion": 0,
        "resources": [],
        "adapterSettings": {
            "restrictYoutubeShorts": false,
            "restrictYoutubeHome": false,
            "restrictUnapprovedYoutube": false,
            "hideYoutubeRecommendations": false
        }
    })
}

pub fn add_local_exception(
    mut existing: Value,
    destination: &str,
    duration_minutes: u64,
    now_ms: u64,
) -> Result<Value, HostError> {
    let expires_at_ms = now_ms + (duration_minutes * 60 * 1000);
    let rev = existing.get("policyVersion").and_then(Value::as_u64).unwrap_or(0) + 1;

    let exception_resource = json!({
        "resourceType": "TEMPORARY_SITE",
        "matchType": "EXACT",
        "disposition": "APPROVED",
        "destination": destination,
        "canonicalDestination": destination,
        "expiresAt": expires_at_ms,
        "enabled": true
    });

    if let Some(obj) = existing.as_object_mut() {
        obj.insert("policyVersion".to_string(), json!(rev));
        let list = obj.entry("resources".to_string()).or_insert_with(|| json!([]));
        if let Some(arr) = list.as_array_mut() {
            arr.push(exception_resource);
        }
    }

    Ok(existing)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_policy_store_lease_and_expiry() {
        let dir = tempdir().unwrap();
        let paths = HostPaths {
            config: dir.path().join("config.json"),
            policy: dir.path().join("policy.json"),
            state_dir: dir.path().to_path_buf(),
        };

        let mut store = PolicyStore::new(paths.clone());
        let now = 100_000;
        let initial_snapshot = json!({
            "status": "ACTIVE",
            "sessionId": 42,
            "policyVersion": 1,
            "resources": []
        });

        // Apply snapshot with 10 second lease
        let applied = store.apply_snapshot(initial_snapshot, PolicySource::Desktop, 10, now).unwrap();
        assert_eq!(applied["_policySource"], "desktop");

        // Valid within lease
        let loaded = store.load_valid(now + 5_000).unwrap();
        assert_eq!(loaded["status"], "ACTIVE");
        assert_eq!(loaded["sessionId"], 42);

        // Expired after lease
        let expired = store.load_valid(now + 11_000).unwrap();
        assert_eq!(expired["status"], "INACTIVE");
        assert!(expired["inactiveReason"].as_str().unwrap().contains("expired"));

        // Add local exception
        let updated = add_local_exception(loaded, "https://example.com/research", 5, now).unwrap();
        assert_eq!(updated["policyVersion"], 2);
        assert_eq!(updated["resources"].as_array().unwrap().len(), 1);

        // Clear store
        store.clear().unwrap();
        let after_clear = store.load_valid(now).unwrap();
        assert_eq!(after_clear["status"], "INACTIVE");
    }
}
