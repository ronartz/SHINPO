use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use shinpo_shield::client::SentinelClient;
use shinpo_shield::config::ShieldConfig;
use shinpo_shield::enforcer::ShieldEnforcer;
use shinpo_shield::spooler::OfflineSpooler;

static SHIELD_ACTIVE: AtomicBool = AtomicBool::new(false);
static BACKEND_CONNECTED: AtomicBool = AtomicBool::new(false);
static LAST_MODE: Mutex<Option<String>> = Mutex::new(None);
static LAST_SESSION_ID: Mutex<Option<i64>> = Mutex::new(None);
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);

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
fn start_shield_service(api_url: Option<String>, token: Option<String>) -> Result<String, String> {
    if SHIELD_ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok("Shield is already active".to_string());
    }

    let url = api_url.unwrap_or_else(|| "http://localhost:8080".to_string());

    thread::spawn(move || {
        log::info!("[SHINPO Desktop Shield] Starting native enforcement thread against: {}", url);
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
                                client.evaluate_candidate(&shinpo_shield::client::CandidateProcessRequest {
                                    process_name: name.to_string(),
                                    command_line: cmd.map(|s| s.to_string()),
                                    pid: Some(pid),
                                })
                            }),
                        );
                        for p in &intercepted {
                            log::warn!("[SHINPO Desktop Shield] Intercepted distraction: PID {} ({})", p.pid, p.name);
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
            start_shield_service,
            stop_shield_service,
            get_shield_status
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
