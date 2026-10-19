pub mod backend;
pub mod config;
pub mod framing;
pub mod policy;
pub mod protocol;

use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use backend::BackendClient;
use config::{HostConfig, HostPaths};
use policy::{PolicySource, PolicyStore};
use protocol::{error_response, ok_response, NativeRequest, NativeResponse};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

pub const PROTOCOL_VERSION: u8 = 1;
pub const MAX_NATIVE_MESSAGE_BYTES: usize = 1_048_576;

#[derive(Debug, Error)]
pub enum HostError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("configuration error: {0}")]
    Config(String),
    #[error("authentication failed")]
    Authentication,
    #[error("invalid request: {0}")]
    InvalidRequest(String),
    #[error("policy error: {0}")]
    Policy(String),
    #[error("backend error: {0}")]
    Backend(String),
}

impl HostError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Io(_) => "IO_ERROR",
            Self::Json(_) => "INVALID_JSON",
            Self::Config(_) => "CONFIG_ERROR",
            Self::Authentication => "AUTHENTICATION_FAILED",
            Self::InvalidRequest(_) => "INVALID_REQUEST",
            Self::Policy(_) => "POLICY_ERROR",
            Self::Backend(_) => "BACKEND_ERROR",
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializationResult {
    pub created: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pairing_code: Option<String>,
    pub config_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialUpdate {
    pub base_url: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub access_token_expires_at_ms: Option<u64>,
    pub review_url: Option<String>,
}

pub fn initialize_installation(paths: &HostPaths) -> Result<InitializationResult, HostError> {
    paths.secure_directories()?;
    if paths.config.exists() {
        HostConfig::load(paths)?;
        return Ok(InitializationResult {
            created: false,
            pairing_code: None,
            config_path: paths.config.display().to_string(),
        });
    }

    let (config, pairing_code) = HostConfig::new_installation();
    config.save(paths)?;
    PolicyStore::new(paths.clone()).clear()?;
    Ok(InitializationResult {
        created: true,
        pairing_code: Some(pairing_code),
        config_path: paths.config.display().to_string(),
    })
}

pub fn rotate_pairing(paths: &HostPaths) -> Result<String, HostError> {
    let mut config = HostConfig::load(paths)?;
    let pairing_code = config.rotate_pairing();
    config.save(paths)?;
    PolicyStore::new(paths.clone()).clear()?;
    Ok(pairing_code)
}

pub fn configure_backend(paths: &HostPaths, update: CredentialUpdate) -> Result<(), HostError> {
    let mut config = HostConfig::load(paths)?;
    config.set_backend(update)?;
    config.save(paths)
}

pub fn publish_policy(paths: &HostPaths, snapshot: Value) -> Result<Value, HostError> {
    let config = HostConfig::load(paths)?;
    PolicyStore::new(paths.clone()).apply_snapshot(
        snapshot,
        PolicySource::Desktop,
        config.max_lease_seconds,
        now_ms(),
    )
}

pub fn clear_session(paths: &HostPaths) -> Result<(), HostError> {
    PolicyStore::new(paths.clone()).clear()
}

pub fn clear_credentials(paths: &HostPaths) -> Result<(), HostError> {
    let mut config = HostConfig::load(paths)?;
    config.backend = None;
    config.save(paths)?;
    clear_session(paths)
}

/// Clears session state and credentials, then invalidates every previously paired
/// browser. The new pairing value is deliberately discarded; an explicit
/// `rotate-pairing` is required before pairing again.
pub fn disconnect_installation(paths: &HostPaths) -> Result<(), HostError> {
    let mut config = HostConfig::load(paths)?;
    config.backend = None;
    let _discarded_pairing_code = config.rotate_pairing();
    config.save(paths)?;
    clear_session(paths)
}

pub fn run_native_loop<R: Read, W: Write>(
    paths: HostPaths,
    reader: &mut R,
    writer: &mut W,
) -> Result<(), HostError> {
    let mut service = NativeHostService::load(paths)?;
    while let Some(request) = framing::read_message(reader, MAX_NATIVE_MESSAGE_BYTES)? {
        let response = match serde_json::from_slice::<NativeRequest>(&request) {
            Ok(parsed) => service.handle(parsed),
            Err(error) => error_response(None, "INVALID_JSON", &format!("Invalid native message: {error}")),
        };
        let encoded = serde_json::to_vec(&response)?;
        framing::write_message(writer, &encoded, MAX_NATIVE_MESSAGE_BYTES)?;
    }
    Ok(())
}

pub struct NativeHostService {
    paths: HostPaths,
    config: HostConfig,
    policy_store: PolicyStore,
}

impl NativeHostService {
    pub fn load(paths: HostPaths) -> Result<Self, HostError> {
        let config = HostConfig::load(&paths)?;
        let policy_store = PolicyStore::new(paths.clone());
        Ok(Self { paths, config, policy_store })
    }

    pub fn handle(&mut self, request: NativeRequest) -> NativeResponse {
        let request_id = request.request_id.clone();
        match self.handle_inner(request) {
            Ok(payload) => ok_response(request_id, payload),
            Err(error) => error_response(Some(request_id), error.code(), &error.to_string()),
        }
    }

    fn handle_inner(&mut self, request: NativeRequest) -> Result<Value, HostError> {
        request.validate()?;
        match request.message_type.as_str() {
            "hello" => Ok(json!({
                "paired": false,
                "pairingRequired": true,
                "protocolVersion": PROTOCOL_VERSION,
            })),
            "pair" => {
                self.authenticate(request.auth.as_deref())?;
                Ok(json!({
                    "paired": true,
                    "installationId": self.config.installation_id,
                }))
            }
            "get_policy" => {
                self.authenticate(request.auth.as_deref())?;
                self.get_policy()
            }
            "request_exception" => {
                self.authenticate(request.auth.as_deref())?;
                self.request_exception(request.payload)
            }
            "status" => {
                self.authenticate(request.auth.as_deref())?;
                self.status()
            }
            _ => Err(HostError::InvalidRequest("unsupported message type".into())),
        }
    }

    fn authenticate(&self, supplied: Option<&str>) -> Result<(), HostError> {
        match supplied {
            Some(token) if self.config.verify_pairing(token) => Ok(()),
            _ => Err(HostError::Authentication),
        }
    }

    fn get_policy(&mut self) -> Result<Value, HostError> {
        let now = now_ms();
        let mut connection_state = "CONNECTED";
        let mut connection_source = "local-cache";
        let mut last_error: Option<String> = None;

        let max_lease_seconds = self.config.max_lease_seconds;
        if self.config.backend.is_some() {
            let mut client = BackendClient::new(&self.paths, &mut self.config);
            match client.fetch_active_policy() {
                Ok(snapshot) => {
                    self.policy_store.apply_snapshot(
                        snapshot,
                        PolicySource::Backend,
                        max_lease_seconds,
                        now,
                    )?;
                    connection_source = "backend";
                    client.send_heartbeat(&self.policy_store.load_valid(now)?).ok();
                }
                Err(error) => {
                    connection_state = "DEGRADED";
                    last_error = Some(error.to_string());
                }
            }
        }

        let policy = self.policy_store.load_valid(now)?;
        if policy.get("status").and_then(Value::as_str) == Some("INACTIVE") && last_error.is_some() {
            connection_state = "DISCONNECTED";
        }
        Ok(json!({
            "policy": policy,
            "connection": {
                "state": connection_state,
                "source": connection_source,
                "lastError": last_error,
            },
            "reviewUrl": self.config.review_url,
        }))
    }

    fn request_exception(&mut self, payload: Value) -> Result<Value, HostError> {
        let session_id = required_scalar(&payload, "sessionId")?;
        let destination = required_string(&payload, "destination", 8192)?;
        validate_http_destination(&destination)?;
        let duration = payload.get("durationMinutes").and_then(Value::as_u64).unwrap_or(5);
        if duration != 5 {
            return Err(HostError::InvalidRequest("only a five-minute exception is supported".into()));
        }
        let expected_version = payload.get("expectedPolicyVersion").and_then(Value::as_u64);
        let now = now_ms();
        let existing = self.policy_store.load_valid(now)?;
        if scalar(&existing, "sessionId").as_deref() != Some(session_id.as_str()) {
            return Err(HostError::Policy("Focus session changed before exception approval".into()));
        }
        if let Some(expected) = expected_version {
            let current = existing.get("policyVersion").and_then(Value::as_u64).unwrap_or(0);
            if expected != current {
                return Err(HostError::Policy("policy revision changed; refresh before retrying".into()));
            }
        }

        let snapshot = if self.config.backend.is_some() {
            let mut client = BackendClient::new(&self.paths, &mut self.config);
            client.request_exception(&session_id, &destination, duration)?
        } else {
            policy::add_local_exception(existing, &destination, duration, now)?
        };
        let stored = self.policy_store.apply_snapshot(
            snapshot,
            if self.config.backend.is_some() { PolicySource::Backend } else { PolicySource::LocalException },
            self.config.max_lease_seconds,
            now,
        )?;
        Ok(json!({ "policy": stored }))
    }

    fn status(&mut self) -> Result<Value, HostError> {
        let policy = self.policy_store.load_valid(now_ms())?;
        Ok(json!({
            "paired": true,
            "backendConfigured": self.config.backend.is_some(),
            "policyVersion": policy.get("policyVersion").cloned().unwrap_or(Value::from(0)),
            "sessionId": policy.get("sessionId").cloned().unwrap_or(Value::Null),
            "status": policy.get("status").cloned().unwrap_or(Value::from("INACTIVE")),
        }))
    }
}

fn required_string(value: &Value, key: &str, max_length: usize) -> Result<String, HostError> {
    let string = value.get(key).and_then(Value::as_str)
        .ok_or_else(|| HostError::InvalidRequest(format!("{key} is required")))?;
    if string.is_empty() || string.len() > max_length {
        return Err(HostError::InvalidRequest(format!("{key} has an invalid length")));
    }
    Ok(string.to_owned())
}

fn required_scalar(value: &Value, key: &str) -> Result<String, HostError> {
    scalar(value, key).ok_or_else(|| HostError::InvalidRequest(format!("{key} is required")))
}

fn scalar(value: &Value, key: &str) -> Option<String> {
    match value.get(key) {
        Some(Value::String(value)) if !value.is_empty() && value.len() <= 128 => Some(value.clone()),
        Some(Value::Number(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn validate_http_destination(destination: &str) -> Result<(), HostError> {
    let parsed = url::Url::parse(destination)
        .map_err(|_| HostError::InvalidRequest("destination is not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() ||
        !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(HostError::InvalidRequest("destination must be an HTTP(S) URL without credentials".into()));
    }
    Ok(())
}

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

pub fn read_json_from<R: Read>(reader: &mut R) -> Result<Value, HostError> {
    let mut bytes = Vec::new();
    reader.take(MAX_NATIVE_MESSAGE_BYTES as u64).read_to_end(&mut bytes)?;
    if bytes.is_empty() {
        return Err(HostError::InvalidRequest("JSON input is empty".into()));
    }
    Ok(serde_json::from_slice(&bytes)?)
}

pub fn read_credentials_from<R: Read>(reader: &mut R) -> Result<CredentialUpdate, HostError> {
    let value = read_json_from(reader)?;
    Ok(serde_json::from_value(value)?)
}

pub fn read_json_file(path: &Path) -> Result<Value, HostError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_NATIVE_MESSAGE_BYTES as u64 {
        return Err(HostError::InvalidRequest("policy file is too large".into()));
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

pub fn write_status_json<W: Write, T: Serialize>(writer: &mut W, value: &T) -> Result<(), HostError> {
    serde_json::to_writer(&mut *writer, value)?;
    writer.write_all(b"\n")?;
    Ok(())
}
