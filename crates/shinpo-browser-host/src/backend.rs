use crate::config::{HostConfig, HostPaths};
use crate::HostError;
use serde_json::{json, Value};
use std::time::Duration;

pub struct BackendClient<'a> {
    paths: &'a HostPaths,
    config: &'a mut HostConfig,
    agent: ureq::Agent,
}

impl<'a> BackendClient<'a> {
    pub fn new(paths: &'a HostPaths, config: &'a mut HostConfig) -> Self {
        let agent = ureq::AgentBuilder::new()
            .redirects(0)
            .timeout_connect(Duration::from_secs(3))
            .timeout_read(Duration::from_secs(5))
            .timeout_write(Duration::from_secs(5))
            .build();
        Self { paths, config, agent }
    }

    pub fn fetch_active_policy(&mut self) -> Result<Value, HostError> {
        let backend = self.config.backend.as_ref()
            .ok_or_else(|| HostError::Backend("Backend not configured".into()))?;
        let url = format!("{}/api/contextual-focus/policy/active", backend.base_url);
        let token = backend.access_token.clone();

        match self.get_with_token(&url, &token) {
            Ok(val) => Ok(val),
            Err(HostError::Backend(err)) if err.contains("401") || err.contains("Unauthorized") => {
                if self.try_refresh_token()? {
                    let new_token = self.config.backend.as_ref().unwrap().access_token.clone();
                    self.get_with_token(&url, &new_token)
                } else {
                    Err(HostError::Backend(err))
                }
            }
            Err(e) => Err(e),
        }
    }

    pub fn send_heartbeat(&mut self, _current_policy: &Value) -> Result<(), HostError> {
        let backend = self.config.backend.as_ref()
            .ok_or_else(|| HostError::Backend("Backend not configured".into()))?;
        let url = format!("{}/api/contextual-focus/companion/heartbeat", backend.base_url);
        let token = backend.access_token.clone();

        let payload = json!({
            "adapterName": "shinpo-browser-host",
            "version": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
            "adapterCoverage": "FULL"
        });

        match self.post_with_token(&url, &token, &payload) {
            Ok(_) => Ok(()),
            Err(HostError::Backend(err)) if err.contains("401") || err.contains("Unauthorized") => {
                if self.try_refresh_token()? {
                    let new_token = self.config.backend.as_ref().unwrap().access_token.clone();
                    self.post_with_token(&url, &new_token, &payload).map(|_| ())
                } else {
                    Err(HostError::Backend(err))
                }
            }
            Err(e) => Err(e),
        }
    }

    pub fn request_exception(
        &mut self,
        session_id: &str,
        destination: &str,
        duration_minutes: u64,
    ) -> Result<Value, HostError> {
        let backend = self.config.backend.as_ref()
            .ok_or_else(|| HostError::Backend("Backend not configured".into()))?;
        
        let url = if !session_id.is_empty() && session_id != "null" {
            format!("{}/api/contextual-focus/sessions/{}/temporary-exceptions", backend.base_url, session_id)
        } else {
            format!("{}/api/contextual-focus/exceptions", backend.base_url)
        };
        let token = backend.access_token.clone();

        let payload = json!({
            "destination": destination,
            "durationMinutes": duration_minutes,
            "reason": "Temporary research exception requested from browser",
            "expectedPolicyVersion": null
        });

        match self.post_with_token(&url, &token, &payload) {
            Ok(val) => Ok(val),
            Err(HostError::Backend(err)) if err.contains("401") || err.contains("Unauthorized") => {
                if self.try_refresh_token()? {
                    let new_token = self.config.backend.as_ref().unwrap().access_token.clone();
                    self.post_with_token(&url, &new_token, &payload)
                } else {
                    Err(HostError::Backend(err))
                }
            }
            Err(e) => Err(e),
        }
    }

    fn get_with_token(&self, url: &str, token: &str) -> Result<Value, HostError> {
        let response = self.agent.get(url)
            .set("Authorization", &format!("Bearer {}", token))
            .set("Accept", "application/json")
            .call()
            .map_err(|e| HostError::Backend(format!("GET request failed: {e}")))?;
        
        let value: Value = response.into_json()
            .map_err(|e| HostError::Backend(format!("Failed to parse JSON response: {e}")))?;
        Ok(value)
    }

    fn post_with_token(&self, url: &str, token: &str, body: &Value) -> Result<Value, HostError> {
        let response = self.agent.post(url)
            .set("Authorization", &format!("Bearer {}", token))
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send_json(body)
            .map_err(|e| HostError::Backend(format!("POST request failed: {e}")))?;
        
        let value: Value = response.into_json()
            .map_err(|e| HostError::Backend(format!("Failed to parse JSON response: {e}")))?;
        Ok(value)
    }

    fn try_refresh_token(&mut self) -> Result<bool, HostError> {
        let (base_url, refresh_token) = match &self.config.backend {
            Some(b) if b.refresh_token.is_some() => {
                (b.base_url.clone(), b.refresh_token.as_ref().unwrap().clone())
            }
            _ => return Ok(false),
        };

        let url = format!("{}/api/auth/refresh", base_url);
        let payload = json!({ "refreshToken": refresh_token });

        let res = self.agent.post(&url)
            .set("Content-Type", "application/json")
            .send_json(&payload);

        match res {
            Ok(resp) => {
                let body: Value = resp.into_json()
                    .map_err(|e| HostError::Backend(format!("Invalid refresh response: {e}")))?;
                if let Some(new_access_token) = body.get("accessToken").and_then(Value::as_str) {
                    let new_refresh = body.get("refreshToken").and_then(Value::as_str).map(String::from);
                    if let Some(backend) = &mut self.config.backend {
                        backend.access_token = new_access_token.to_string();
                        if let Some(nr) = new_refresh {
                            backend.refresh_token = Some(nr);
                        }
                    }
                    self.config.save(self.paths)?;
                    return Ok(true);
                }
                Ok(false)
            }
            Err(_) => Ok(false),
        }
    }
}

