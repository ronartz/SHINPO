use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;

use shinpo_shield::client::SentinelClient;
use shinpo_shield::config::ShieldConfig;
use shinpo_shield::enforcer::ShieldEnforcer;
use shinpo_shield::spooler::OfflineSpooler;

static SHIELD_ACTIVE: AtomicBool = AtomicBool::new(false);
static BACKEND_CONNECTED: AtomicBool = AtomicBool::new(false);
static LAST_MODE: Mutex<Option<String>> = Mutex::new(None);
static LAST_SESSION_ID: Mutex<Option<i64>> = Mutex::new(None);
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
const CREDENTIAL_SERVICE: &str = "com.shinpo.app";
const REFRESH_TOKEN_ACCOUNT: &str = "refresh_token";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserCompanionLocalStatus {
    paired: bool,
    state: &'static str,
    detail: &'static str,
}

#[tauri::command]
fn browser_companion_pairing_code(
    state: tauri::State<'_, native_vault::VaultManager>,
) -> Result<String, String> {
    let paths = shinpo_browser_host::config::HostPaths::default();
    shinpo_browser_host::initialize_installation(&paths)
        .map_err(|_| "Could not initialize the Browser Companion host".to_string())?;
    shinpo_browser_host::clear_credentials(&paths)
        .map_err(|_| "Could not switch Browser Companion to local-only credentials".to_string())?;
    let code = shinpo_browser_host::rotate_pairing(&paths)
        .map_err(|_| "Could not create a pairing challenge".to_string())?;
    native_vault::local_sync_browser_policy(state)?;
    Ok(code)
}

#[tauri::command]
fn browser_companion_local_status() -> BrowserCompanionLocalStatus {
    let paths = shinpo_browser_host::config::HostPaths::default();
    let paired = shinpo_browser_host::config::HostConfig::load(&paths)
        .ok()
        .is_some_and(|config| config.browser_token_hash.is_some());
    BrowserCompanionLocalStatus {
        paired,
        state: if paired { "PAIRED" } else { "UNPAIRED" },
        detail: if paired {
            "Pairing is saved locally. Open the extension to verify its live connection."
        } else {
            "Pair the installed extension using a short-lived code from SHINPO."
        },
    }
}

#[tauri::command]
fn browser_companion_revoke() -> Result<(), String> {
    shinpo_browser_host::disconnect_installation(&shinpo_browser_host::config::HostPaths::default())
        .map_err(|_| "Could not revoke the Browser Companion pairing".to_string())
}

fn refresh_token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, REFRESH_TOKEN_ACCOUNT)
        .map_err(|_| "OS credential storage is unavailable".to_string())
}

fn validate_refresh_token(token: &str) -> Result<(), String> {
    if token.is_empty() || token.len() > 8192 || token.chars().any(char::is_control) {
        return Err("Invalid refresh token".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_secure_refresh_token() -> Result<Option<String>, String> {
    match refresh_token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read the saved session from OS credential storage".to_string()),
    }
}

#[tauri::command]
fn set_secure_refresh_token(token: String) -> Result<(), String> {
    validate_refresh_token(&token)?;
    refresh_token_entry()?
        .set_password(&token)
        .map_err(|_| "Could not save the session in OS credential storage".to_string())
}

#[cfg(test)]
mod credential_tests {
    use super::validate_refresh_token;

    #[test]
    fn refresh_token_validation_rejects_empty_control_and_oversized_values() {
        assert!(validate_refresh_token("").is_err());
        assert!(validate_refresh_token("token\nwith-control").is_err());
        assert!(validate_refresh_token(&"x".repeat(8193)).is_err());
        assert!(validate_refresh_token("opaque-refresh-token").is_ok());
    }
}

#[tauri::command]
fn delete_secure_refresh_token() -> Result<(), String> {
    match refresh_token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove the saved session from OS credential storage".to_string()),
    }
}

#[derive(serde::Serialize, Clone)]
struct ShieldStatusDto {
    is_active: bool,
    is_connected: bool,
    enforcement_mode: Option<String>,
    active_session_id: Option<i64>,
    last_error: Option<String>,
}

#[tauri::command]
fn get_shield_status() -> Result<ShieldStatusDto, String> {
    Ok(ShieldStatusDto {
        is_active: SHIELD_ACTIVE.load(Ordering::SeqCst),
        is_connected: BACKEND_CONNECTED.load(Ordering::SeqCst),
        enforcement_mode: LAST_MODE.lock().ok().and_then(|g| g.clone()),
        active_session_id: LAST_SESSION_ID.lock().ok().and_then(|g| *g),
        last_error: LAST_ERROR.lock().ok().and_then(|g| g.clone()),
    })
}

#[tauri::command]
fn start_shield_service(
    state: tauri::State<'_, native_vault::VaultManager>,
    api_url: Option<String>,
    token: Option<String>,
) -> Result<String, String> {
    if !state.is_unlocked()? {
        return Err("Unlock the local vault before starting Sentinel".to_string());
    }
    let url = shinpo_shield::config::validate_backend_url(
        &api_url.unwrap_or_else(|| "http://localhost:8080".to_string()),
    )?;
    if let Some(ref t) = token {
        if t.contains(|c: char| c.is_control() || c == '\r' || c == '\n') {
            return Err("Invalid auth token: contains illegal control characters".to_string());
        }
    }

    if SHIELD_ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok("Shield is already active".to_string());
    }

    thread::spawn(move || {
        log::info!(
            "[SHINPO Desktop Shield] Starting native enforcement thread against: {}",
            url
        );
        let client = SentinelClient::new(url, token);
        let mut enforcer = ShieldEnforcer::new();
        let spooler = OfflineSpooler::new(OfflineSpooler::default_path());
        let config = ShieldConfig::default();

        while SHIELD_ACTIVE.load(Ordering::SeqCst) {
            match client.sync() {
                Ok(sync) => {
                    BACKEND_CONNECTED.store(true, Ordering::SeqCst);
                    if let Ok(mut mode_guard) = LAST_MODE.lock() {
                        *mode_guard = Some(sync.enforcement_mode.clone());
                    }
                    if let Ok(mut sess_guard) = LAST_SESSION_ID.lock() {
                        *sess_guard = sync.active_session_id;
                    }
                    if let Ok(mut err_guard) = LAST_ERROR.lock() {
                        *err_guard = None;
                    }

                    if !spooler.is_empty() {
                        let _ = spooler.flush_to_client(&client);
                    }

                    if sync.has_active_session {
                        let intercepted = enforcer.scan_and_enforce_with_candidate_evaluator(
                            &sync,
                            &config.fallback_blacklist,
                            false,
                            Some(|name: &str, cmd: Option<&str>, pid: u32| {
                                client.evaluate_candidate(
                                    &shinpo_shield::client::CandidateProcessRequest {
                                        process_name: name.to_string(),
                                        command_line: cmd.map(|s| s.to_string()),
                                        pid: Some(pid),
                                    },
                                )
                            }),
                        );
                        for p in &intercepted {
                            log::warn!(
                                "[SHINPO Desktop Shield] Intercepted distraction: PID {} ({})",
                                p.pid,
                                p.name
                            );
                            let req = ShieldEnforcer::to_quarantine_request(p);
                            if client.report_quarantine(&req).is_err() {
                                let _ = spooler.append(&req);
                            }
                        }
                    }
                }
                Err(e) => {
                    BACKEND_CONNECTED.store(false, Ordering::SeqCst);
                    if let Ok(mut err_guard) = LAST_ERROR.lock() {
                        *err_guard = Some(e.to_string());
                    }
                    log::debug!("[SHINPO Desktop Shield] Backend polling idle: {}", e);
                }
            }
            thread::sleep(Duration::from_secs(config.poll_interval_seconds));
        }
        BACKEND_CONNECTED.store(false, Ordering::SeqCst);
        log::info!("[SHINPO Desktop Shield] Native enforcement thread stopped.");
    });

    Ok("Shield enforcement thread launched".to_string())
}

pub(crate) fn halt_shield_for_vault_lock() {
    SHIELD_ACTIVE.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn stop_shield_service() -> Result<String, String> {
    SHIELD_ACTIVE.store(false, Ordering::SeqCst);
    BACKEND_CONNECTED.store(false, Ordering::SeqCst);
    Ok("Shield enforcement thread signaled to stop".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let vault_dir = app.path().app_data_dir()?.join("vaults");
            app.manage(native_vault::VaultManager::new(vault_dir));
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            log::info!("[SHINPO Desktop] Tauri shell initialized.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_vault::create_local_account,
            native_vault::unlock_local_account,
            native_vault::recover_local_account,
            native_vault::lock_local_account,
            native_vault::local_vault_status,
            native_vault::local_get_goals,
            native_vault::local_create_goal,
            native_vault::local_update_goal,
            native_vault::local_delete_goal,
            native_vault::local_delete_all_goals,
            native_vault::local_get_tasks,
            native_vault::local_create_task,
            native_vault::local_update_task,
            native_vault::local_complete_task,
            native_vault::local_delete_task,
            native_vault::local_delete_all_tasks,
            native_vault::local_get_progress,
            native_vault::local_claim_onboarding_reward,
            native_vault::local_create_focus_session,
            native_vault::local_get_focus_sessions,
            native_vault::local_get_focus_sessions_by_date,
            native_vault::local_update_focus_session,
            native_vault::local_start_focus_session,
            native_vault::local_pause_focus_session,
            native_vault::local_resume_focus_session,
            native_vault::local_complete_focus_session,
            native_vault::local_cancel_focus_session,
            native_vault::local_delete_focus_session,
            native_vault::local_get_study_resources,
            native_vault::local_create_study_resource,
            native_vault::local_delete_study_resource,
            native_vault::local_sync_browser_policy,
            native_vault::local_set_browser_focus_mode,
            browser_companion_pairing_code,
            browser_companion_local_status,
            browser_companion_revoke,
            start_shield_service,
            stop_shield_service,
            get_shield_status,
            get_secure_refresh_token,
            set_secure_refresh_token,
            delete_secure_refresh_token
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

mod native_vault;
