use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct SentinelDaemonSyncResponse {
    #[serde(rename = "hasActiveSession")]
    pub has_active_session: bool,

    #[serde(rename = "activeSessionId")]
    pub active_session_id: Option<i64>,

    #[serde(rename = "activeSessionName")]
    pub active_session_name: Option<String>,

    #[serde(rename = "durationMinutes")]
    pub duration_minutes: Option<i32>,

    pub intention: Option<String>,

    #[serde(rename = "enforcementMode")]
    pub enforcement_mode: String,

    #[serde(rename = "isPolicyLocked")]
    pub is_policy_locked: bool,

    #[serde(rename = "blockedPatterns", default)]
    pub blocked_patterns: Vec<String>,

    #[serde(rename = "allowedPatterns", default)]
    pub allowed_patterns: Vec<String>,

    #[serde(rename = "protectedProcesses", default)]
    pub protected_processes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RecordQuarantineRequest {
    pub pid: u32,
    #[serde(rename = "processName")]
    pub process_name: String,
    #[serde(rename = "commandLine")]
    pub command_line: Option<String>,
    #[serde(rename = "policyAction")]
    pub policy_action: String,
    #[serde(rename = "enforcementMode")]
    pub enforcement_mode: String,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct LegacyFocusSession {
    id: i64,
    #[serde(default)]
    name: String,
    status: String,
    #[serde(rename = "durationMinutes")]
    duration_minutes: Option<i32>,
    intention: Option<String>,
}

pub struct SentinelClient {
    base_url: String,
    auth_token: Option<String>,
}

impl SentinelClient {
    pub fn new(base_url: String, auth_token: Option<String>) -> Self {
        Self {
            base_url,
            auth_token,
        }
    }

    /// Fetches the unified daemon sync contract from Spring Boot.
    /// If unauthenticated or falling back, gracefully probes legacy /api/focus-sessions.
    pub fn sync(&self) -> Result<SentinelDaemonSyncResponse, String> {
        let sync_url = format!("{}/api/device/sentinel/sync", self.base_url);
        let mut req = ureq::get(&sync_url).timeout(Duration::from_secs(3));
        if let Some(token) = &self.auth_token {
            req = req.set("Authorization", &format!("Bearer {}", token));
        }

        match req.call() {
            Ok(response) => {
                response.into_json::<SentinelDaemonSyncResponse>()
                    .map_err(|e| format!("Failed to parse sync response: {}", e))
            }
            Err(ureq::Error::Status(401, _)) => {
                Err("Authentication required. Set SHINPO_AUTH_TOKEN or pass --token <jwt>".to_string())
            }
            Err(ureq::Error::Status(404, _)) | Err(ureq::Error::Transport(_)) => {
                // Fallback attempt to public focus-sessions endpoint
                self.fallback_sync()
            }
            Err(ureq::Error::Status(code, resp)) => {
                let body = resp.into_string().unwrap_or_default();
                Err(format!("Sentinel API error (HTTP {}): {}", code, body))
            }
        }
    }

    fn fallback_sync(&self) -> Result<SentinelDaemonSyncResponse, String> {
        let legacy_url = format!("{}/api/focus-sessions", self.base_url);
        let mut req = ureq::get(&legacy_url).timeout(Duration::from_secs(3));
        if let Some(token) = &self.auth_token {
            req = req.set("Authorization", &format!("Bearer {}", token));
        }

        match req.call() {
            Ok(response) => {
                if let Ok(sessions) = response.into_json::<Vec<LegacyFocusSession>>() {
                    if let Some(active) = sessions.into_iter().find(|s| s.status == "ACTIVE") {
                        return Ok(SentinelDaemonSyncResponse {
                            has_active_session: true,
                            active_session_id: Some(active.id),
                            active_session_name: Some(if active.name.is_empty() { "Focus Sprint".to_string() } else { active.name }),
                            duration_minutes: active.duration_minutes,
                            intention: active.intention,
                            enforcement_mode: "STRICT".to_string(),
                            is_policy_locked: true,
                            blocked_patterns: Vec::new(),
                            allowed_patterns: Vec::new(),
                            protected_processes: Vec::new(),
                        });
                    }
                }
                Ok(SentinelDaemonSyncResponse {
                    has_active_session: false,
                    active_session_id: None,
                    active_session_name: None,
                    duration_minutes: None,
                    intention: None,
                    enforcement_mode: "AUDIT_ONLY".to_string(),
                    is_policy_locked: false,
                    blocked_patterns: Vec::new(),
                    allowed_patterns: Vec::new(),
                    protected_processes: Vec::new(),
                })
            }
            Err(e) => Err(format!("Backend unreachable at {}: {}", self.base_url, e)),
        }
    }

    /// Records an intercepted quarantine event to the backend for audit & telemetry.
    pub fn report_quarantine(&self, record: &RecordQuarantineRequest) -> Result<(), String> {
        let quarantine_url = format!("{}/api/device/sentinel/quarantines", self.base_url);
        let mut req = ureq::post(&quarantine_url).timeout(Duration::from_secs(3));
        if let Some(token) = &self.auth_token {
            req = req.set("Authorization", &format!("Bearer {}", token));
        }

        match req.send_json(record) {
            Ok(_) => Ok(()),
            Err(ureq::Error::Status(code, resp)) => {
                let err_msg = resp.into_string().unwrap_or_default();
                Err(format!("Server returned HTTP {}: {}", code, err_msg))
            }
            Err(e) => Err(format!("Failed to send quarantine telemetry: {}", e)),
        }
    }
}
