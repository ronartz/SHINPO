use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::thread::sleep;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sysinfo::{ProcessesToUpdate, System};

#[derive(Debug, Serialize, Deserialize)]
struct ShieldConfig {
    #[serde(default = "default_api_url")]
    api_url: String,

    #[serde(default = "default_poll_seconds")]
    poll_interval_seconds: u64,

    #[serde(default = "default_blacklist")]
    blacklist: Vec<String>,

    #[serde(default = "default_true")]
    auto_kill: bool,

    #[serde(default = "default_true")]
    notify_desktop: bool,
}

fn default_api_url() -> String {
    "http://localhost:8080/api/focus-sessions?userId=1".to_string()
}
fn default_poll_seconds() -> u64 {
    2
}
fn default_true() -> bool {
    true
}
fn default_blacklist() -> Vec<String> {
    vec![
        "discord".to_string(),
        "steam".to_string(),
        "spotify".to_string(),
        "telegram-desktop".to_string(),
        "vlc".to_string(),
        "obs".to_string(),
        "epicgameslauncher".to_string(),
        "riotclientux".to_string(),
        "battlenet".to_string(),
    ]
}

impl Default for ShieldConfig {
    fn default() -> Self {
        Self {
            api_url: default_api_url(),
            poll_interval_seconds: default_poll_seconds(),
            blacklist: default_blacklist(),
            auto_kill: true,
            notify_desktop: true,
        }
    }
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FocusSession {
    id: i64,
    #[serde(default)]
    name: String,
    status: String,
    #[serde(rename = "durationMinutes")]
    duration_minutes: Option<i32>,
    intention: Option<String>,
}

fn send_desktop_notification(title: &str, message: &str) {
    let _ = Command::new("notify-send")
        .args(["-u", "critical", "-a", "SHINPO Shield (Rust)", title, message])
        .output();
}

fn load_config() -> ShieldConfig {
    let candidates = [
        "daemon/shield_config.json",
        "shield_config.json",
        "../daemon/shield_config.json",
        "/etc/shinpo/shield_config.json",
    ];

    for candidate in &candidates {
        if Path::new(candidate).exists() {
            if let Ok(content) = fs::read_to_string(candidate) {
                if let Ok(cfg) = serde_json::from_str::<ShieldConfig>(&content) {
                    println!("  [CONFIG] Loaded configuration from: {}", candidate);
                    return cfg;
                }
            }
        }
    }

    println!("  [CONFIG] Using compiled default configuration.");
    ShieldConfig::default()
}

fn fetch_active_session(api_url: &str) -> Option<FocusSession> {
    match ureq::get(api_url).timeout(Duration::from_secs(3)).call() {
        Ok(response) => {
            if let Ok(sessions) = response.into_json::<Vec<FocusSession>>() {
                return sessions.into_iter().find(|s| s.status == "ACTIVE");
            }
        }
        Err(_) => {
            // Spring Boot backend offline or busy
        }
    }
    None
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let dry_run = args.iter().any(|a| a == "--dry-run");

    println!("=================================================================");
    println!("  進歩 (SHINPO) RUST FOCUS ENFORCEMENT SHIELD ONLINE");
    println!("  Engine: Native Rust 1.98 • Zero-Overhead Process Sentinel");
    println!("  Mode: {}", if dry_run { "DRY-RUN (audit only)" } else { "ACTIVE ENFORCEMENT (SIGKILL)" });

    let config = load_config();
    println!("  Monitoring API: {}", config.api_url);
    println!("  Blacklist: {}", config.blacklist.join(", "));
    println!("=================================================================\n");

    let mut sys = System::new_all();
    let mut in_lockdown = false;

    loop {
        if let Some(session) = fetch_active_session(&config.api_url) {
            let session_name = if session.name.is_empty() {
                "Focus Sprint".to_string()
            } else {
                session.name
            };
            let duration = session.duration_minutes.unwrap_or(25);
            let intention = session.intention.unwrap_or_else(|| "Deep Flow Sprint".to_string());

            if !in_lockdown {
                in_lockdown = true;
                println!(
                    "\n🛡️  [LOCKDOWN ENGAGED] Active Sprint: '{}' ({}m)",
                    session_name, duration
                );
                println!("    Intention: {}", intention);
                if config.notify_desktop {
                    send_desktop_notification(
                        "🛡️ SHINPO Focus Shield Engaged",
                        &format!("Lockdown active for {}m: {}", duration, intention),
                    );
                }
            }

            // Refresh processes
            sys.refresh_processes(ProcessesToUpdate::All, true);

            let my_pid = std::process::id();
            let mut terminated_count = 0;

            for (pid, process) in sys.processes() {
                if pid.as_u32() == my_pid {
                    continue;
                }

                let proc_name = process.name().to_string_lossy().to_lowercase();
                
                // Match against blacklist
                let is_blacklisted = config.blacklist.iter().any(|b| {
                    let b_clean = b.trim().to_lowercase();
                    !b_clean.is_empty() && proc_name.contains(&b_clean)
                });

                if is_blacklisted {
                    if dry_run {
                        println!(
                            "  [DRY-RUN] Would terminate: PID {} ({})",
                            pid,
                            process.name().to_string_lossy()
                        );
                        terminated_count += 1;
                    } else if config.auto_kill {
                        if process.kill() {
                            println!(
                                "  🚫 [ENFORCED] Terminated: PID {} ({})",
                                pid,
                                process.name().to_string_lossy()
                            );
                            terminated_count += 1;
                        } else {
                            println!(
                                "  ⚠️ [PERMISSION REQUIRED] Failed to kill PID {} ({}). Try running with 'sudo'.",
                                pid,
                                process.name().to_string_lossy()
                            );
                        }
                    }
                }
            }

            if terminated_count > 0 && config.notify_desktop && !dry_run {
                send_desktop_notification(
                    "🚫 Distraction Neutralized",
                    &format!("SHINPO Shield eliminated {} distracting process(es).", terminated_count),
                );
            }
        } else if in_lockdown {
            in_lockdown = false;
            println!(
                "\n✅  [LOCKDOWN RELEASED] Focus session concluded. Normal OS access restored."
            );
            if config.notify_desktop {
                send_desktop_notification(
                    "✅ SHINPO Focus Session Concluded",
                    "Distraction enforcement released. High-velocity session recorded.",
                );
            }
        }

        sleep(Duration::from_secs(config.poll_interval_seconds));
    }
}
