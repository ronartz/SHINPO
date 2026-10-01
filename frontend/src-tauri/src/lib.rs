use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::Manager;

use shinpo_shield::client::SentinelClient;
use shinpo_shield::config::ShieldConfig;
use shinpo_shield::enforcer::ShieldEnforcer;
use shinpo_shield::spooler::OfflineSpooler;

static SHIELD_ACTIVE: AtomicBool = AtomicBool::new(false);

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
                    if !spooler.is_empty() {
                        let _ = spooler.flush_to_client(&client);
                    }

                    if sync.has_active_session {
                        let intercepted = enforcer.scan_and_enforce(&sync, &config.fallback_blacklist, false);
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
                    log::debug!("[SHINPO Desktop Shield] Backend polling idle: {}", e);
                }
            }
            thread::sleep(Duration::from_secs(config.poll_interval_seconds));
        }
        log::info!("[SHINPO Desktop Shield] Native enforcement thread stopped.");
    });

    Ok("Shield enforcement thread launched".to_string())
}

#[tauri::command]
fn stop_shield_service() -> Result<String, String> {
    SHIELD_ACTIVE.store(false, Ordering::SeqCst);
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
            stop_shield_service
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
