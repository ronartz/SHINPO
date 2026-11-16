use crate::config::{atomic_write_json, HostPaths};
use crate::HostError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;

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
        if matches!(source, PolicySource::Desktop) {
            validate_desktop_snapshot(&snapshot, now_ms)?;
            if let Ok(bytes) = fs::read(&self.paths.policy) {
                if let Ok(previous) = serde_json::from_slice::<Value>(&bytes) {
                    let same_session = previous.get("sessionId") == snapshot.get("sessionId");
                    let old_revision = previous
                        .get("policyVersion")
                        .and_then(Value::as_u64)
                        .unwrap_or(0);
                    let new_revision = snapshot
                        .get("policyVersion")
                        .and_then(Value::as_u64)
                        .unwrap_or(0);
                    if same_session && new_revision < old_revision {
                        return Err(HostError::Policy("stale desktop policy revision".into()));
                    }
                }
            }
        }
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

        let lease_expires_at = value
            .get("_hostLeaseExpiresAtMs")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        if lease_expires_at <= now_ms {
            return Ok(inactive_policy(
                "Policy lease expired; companion awaiting sync",
            ));
        }

        let status = value
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("INACTIVE");
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

fn validate_desktop_snapshot(snapshot: &Value, now_ms: u64) -> Result<(), HostError> {
    let invalid = |message: &str| HostError::Policy(message.to_string());
    let object = snapshot
        .as_object()
        .ok_or_else(|| invalid("desktop policy must be an object"))?;
    let status = object
        .get("status")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("desktop policy status is required"))?;
    if !matches!(status, "ACTIVE" | "INACTIVE") {
        return Err(invalid("desktop policy status is invalid"));
    }
    if object
        .get("policyVersion")
        .and_then(Value::as_u64)
        .filter(|v| *v > 0)
        .is_none()
    {
        return Err(invalid("desktop policy revision is invalid"));
    }
    let resources = object
        .get("resources")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("desktop policy resources must be an array"))?;
    if resources.len() > 256 {
        return Err(invalid("desktop policy contains too many resources"));
    }
    if status == "INACTIVE" {
        return Ok(());
    }
    let session = object.get("sessionId").filter(|value| match value {
        Value::String(s) => !s.is_empty() && s.len() <= 128,
        Value::Number(n) => n.as_i64().is_some_and(|id| id > 0),
        _ => false,
    });
    if session.is_none() {
        return Err(invalid("active desktop policy needs a valid session ID"));
    }
    if !matches!(
        object.get("mode").and_then(Value::as_str),
        Some("GUIDED" | "PROTECTED" | "STRICT")
    ) {
        return Err(invalid("active desktop policy mode is invalid"));
    }
    let phase = object
        .get("currentPhase")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("active desktop policy phase is required"))?;
    if !matches!(
        phase,
        "FOCUS" | "SHORT_BREAK" | "LONG_BREAK" | "BREAK" | "GRACE" | "RETURN_REQUIRED"
    ) {
        return Err(invalid("active desktop policy phase is invalid"));
    }
    let issued_at = object.get("issuedAt").and_then(Value::as_u64);
    if issued_at.is_none_or(|time| time > now_ms.saturating_add(30_000)) {
        return Err(invalid("desktop policy issue time is invalid"));
    }
    if matches!(phase, "SHORT_BREAK" | "LONG_BREAK" | "BREAK" | "GRACE")
        && object
            .get("phaseDeadlineAt")
            .and_then(Value::as_u64)
            .is_none_or(|deadline| deadline <= now_ms || deadline > now_ms + 60 * 60 * 1000)
    {
        return Err(invalid("break policy needs a valid authoritative deadline"));
    }
    for resource in resources {
        let resource = resource
            .as_object()
            .ok_or_else(|| invalid("desktop policy resource must be an object"))?;
        if !matches!(
            resource.get("resourceType").and_then(Value::as_str),
            Some(
                "WEBSITE"
                    | "YOUTUBE_VIDEO"
                    | "YOUTUBE_PLAYLIST"
                    | "DISCORD_CHANNEL"
                    | "TEMPORARY_SITE"
            )
        ) || !matches!(
            resource.get("matchType").and_then(Value::as_str),
            Some("EXACT" | "DOMAIN" | "URL_PATTERN" | "BROWSER_CHANNEL")
        ) || !matches!(
            resource.get("disposition").and_then(Value::as_str),
            Some("APPROVED" | "BLOCKED")
        ) || !resource.get("breakOnly").is_some_and(Value::is_boolean)
        {
            return Err(invalid("desktop policy resource fields are invalid"));
        }
        let destination = resource
            .get("canonicalDestination")
            .or_else(|| resource.get("destination"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty() && value.len() <= 2048)
            .ok_or_else(|| invalid("desktop policy resource destination is invalid"))?;
        let candidate = if destination.contains("://") {
            destination.to_string()
        } else {
            format!("https://{destination}")
        };
        let parsed = url::Url::parse(&candidate)
            .map_err(|_| invalid("desktop policy resource destination is invalid"))?;
        if !matches!(parsed.scheme(), "http" | "https")
            || parsed.host_str().is_none()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || parsed.host_str().is_some_and(|host| host.contains('*'))
        {
            return Err(invalid(
                "desktop policy resource must be a safe HTTP(S) destination",
            ));
        }
    }
    Ok(())
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
    let rev = existing
        .get("policyVersion")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        + 1;

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
        let list = obj
            .entry("resources".to_string())
            .or_insert_with(|| json!([]));
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
    fn desktop_snapshot_rejects_unbounded_breaks_and_unsafe_resources() {
        let now = 1_000_000;
        let mut policy = json!({
            "status":"ACTIVE", "sessionId":42, "policyVersion":1,
            "currentPhase":"BREAK", "mode":"PROTECTED", "issuedAt":now,
            "resources":[]
        });
        assert!(validate_desktop_snapshot(&policy, now).is_err());
        policy["phaseDeadlineAt"] = json!(now + 60_000);
        assert!(validate_desktop_snapshot(&policy, now).is_ok());
        policy["resources"] = json!([{
            "resourceType":"WEBSITE", "matchType":"DOMAIN", "disposition":"BLOCKED",
            "breakOnly":false, "destination":"javascript:alert(1)"
        }]);
        assert!(validate_desktop_snapshot(&policy, now).is_err());
    }

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
            "currentPhase": "FOCUS",
            "mode": "PROTECTED",
            "issuedAt": now,
            "resources": []
        });

        // Apply snapshot with 10 second lease
        let applied = store
            .apply_snapshot(initial_snapshot, PolicySource::Desktop, 10, now)
            .unwrap();
        assert_eq!(applied["_policySource"], "desktop");

        // Valid within lease
        let loaded = store.load_valid(now + 5_000).unwrap();
        assert_eq!(loaded["status"], "ACTIVE");
        assert_eq!(loaded["sessionId"], 42);

        let next = json!({"status":"ACTIVE","sessionId":42,"policyVersion":2,"currentPhase":"FOCUS","mode":"PROTECTED","issuedAt":now,"resources":[]});
        store
            .apply_snapshot(next, PolicySource::Desktop, 10, now)
            .unwrap();
        let stale = json!({"status":"ACTIVE","sessionId":42,"policyVersion":1,"currentPhase":"FOCUS","mode":"PROTECTED","issuedAt":now,"resources":[]});
        assert!(store
            .apply_snapshot(stale, PolicySource::Desktop, 10, now)
            .is_err());

        // Expired after lease
        let expired = store.load_valid(now + 11_000).unwrap();
        assert_eq!(expired["status"], "INACTIVE");
        assert!(expired["inactiveReason"]
            .as_str()
            .unwrap()
            .contains("expired"));

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
