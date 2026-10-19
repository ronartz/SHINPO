use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::{HostError, PROTOCOL_VERSION};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRequest {
    pub protocol_version: u8,
    pub request_id: String,
    #[serde(rename = "type")]
    pub message_type: String,
    #[serde(default)]
    pub payload: Value,
    pub auth: Option<String>,
}

impl NativeRequest {
    pub fn validate(&self) -> Result<(), HostError> {
        if self.protocol_version != PROTOCOL_VERSION {
            return Err(HostError::InvalidRequest(format!(
                "Unsupported protocol version: {}, expected {}",
                self.protocol_version, PROTOCOL_VERSION
            )));
        }
        if self.request_id.is_empty() || self.request_id.len() > 128 {
            return Err(HostError::InvalidRequest("Invalid requestId length".into()));
        }
        if !self.message_type.chars().all(|c| c.is_ascii_lowercase() || c == '_') {
            return Err(HostError::InvalidRequest("Invalid message type format".into()));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeResponse {
    pub protocol_version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ProtocolError>,
}

pub fn ok_response(request_id: String, payload: Value) -> NativeResponse {
    NativeResponse {
        protocol_version: PROTOCOL_VERSION,
        request_id: Some(request_id),
        ok: true,
        payload: Some(payload),
        error: None,
    }
}

pub fn error_response(request_id: Option<String>, code: &str, message: &str) -> NativeResponse {
    NativeResponse {
        protocol_version: PROTOCOL_VERSION,
        request_id,
        ok: false,
        payload: None,
        error: Some(ProtocolError {
            code: code.to_string(),
            message: message.to_string(),
        }),
    }
}

