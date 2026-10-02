mod client;
mod config;
mod enforcer;
pub mod platform;
pub mod spooler;

use std::thread::sleep;
use std::time::Duration;

use client::SentinelClient;
use config::{load_config, CliOptions, ShieldCommand};
use enforcer::{send_desktop_notification, ShieldEnforcer};
use platform::create_platform_interceptor;
use spooler::OfflineSpooler;

fn main() {
    let opts = CliOptions::parse();
    let config = load_config(&opts);

    let client = SentinelClient::new(config.api_url.clone(), config.auth_token.clone());
    let platform = create_platform_interceptor();

    println!("=================================================================");
    println!("  進歩 (SHINPO) RUST FOCUS ENFORCEMENT SHIELD DAEMON");
    println!("  Engine: Native Rust 1.98 • Zero-Overhead Process Sentinel");
    println!("  Platform: {} (Elevated/Root: {})", platform.os_name(), platform.is_privileged());
    println!("  Kernel Interceptor: {}", platform.network_filtering_status());
    println!("  Target API: {}", config.api_url);
    println!("  Authentication: {}", if config.auth_token.is_some() { "BEARER JWT CONFIGURED" } else { "ANONYMOUS / FALLBACK" });
    println!("  Execution Mode: {}", if opts.dry_run { "AUDIT-ONLY (DRY-RUN)" } else { "DYNAMIC AUTONOMOUS (BACKEND DRIVEN)" });
    println!("=================================================================\n");

    match opts.command {
        ShieldCommand::Status => handle_status(&client),
        ShieldCommand::Sweep => handle_sweep(&client, &config, opts.dry_run),
        ShieldCommand::Spool => handle_spool(&client, opts.flush_spool),
        ShieldCommand::Run => handle_run(&client, &config, opts.dry_run),
    }
}

fn handle_status(client: &SentinelClient) {
    println!("📡 Probing Sentinel Daemon Sync endpoint...\n");
    let spooler = OfflineSpooler::new(OfflineSpooler::default_path());
    println!("📦 Offline Spool Buffer: {} pending record(s) in {:?}", spooler.len(), spooler.path());

    match client.sync() {
        Ok(sync) => {
            println!("✅ Sentinel Backend Connection: OPERATIONAL");
            println!("  Active Focus Session: {}", if sync.has_active_session {
                format!(
                    "\"{}\" ({}m) [ID: {}]",
                    sync.active_session_name.as_deref().unwrap_or("Focus Sprint"),
                    sync.duration_minutes.unwrap_or(25),
                    sync.active_session_id.unwrap_or(0)
                )
            } else {
                "NONE (Standby)".to_string()
            });
            if let Some(intention) = sync.intention {
                println!("  Intention: {}", intention);
            }
            println!("  Enforcement Mode: {}", sync.enforcement_mode);
            println!("  Policy Gate Locked: {}", if sync.is_policy_locked { "YES (🔒 NON-NEGOTIABLE)" } else { "NO (UNRESTRICTED)" });
            println!("\n🛡️ Active Policy Blacklist ({} rules):", sync.blocked_patterns.len());
            for b in &sync.blocked_patterns {
                println!("  - [BLOCKED] {}", b);
            }
            println!("\n✨ Active Policy Whitelist ({} rules):", sync.allowed_patterns.len());
            for a in &sync.allowed_patterns {
                println!("  - [ALLOWED] {}", a);
            }
            println!("\n🛡️ Protected Core Systems ({} entries):", sync.protected_processes.len());
            let preview = sync.protected_processes.iter().take(8).cloned().collect::<Vec<_>>().join(", ");
            println!("  {}", preview);
        }
        Err(err) => {
            eprintln!("❌ Failed to sync with Sentinel API: {}", err);
            std::process::exit(1);
        }
    }
}

fn handle_spool(client: &SentinelClient, flush: bool) {
    let spooler = OfflineSpooler::new(OfflineSpooler::default_path());
    println!("📦 Offline Telemetry Spooler Status:");
    println!("  Spool Path: {:?}", spooler.path());
    let count = spooler.len();
    println!("  Queued Records: {}", count);

    if count > 0 {
        match spooler.peek_all() {
            Ok(records) => {
                println!("\n--- Queued Quarantine Records ---");
                for (idx, r) in records.iter().enumerate() {
                    println!(
                        "  [{}] PID {} ({}) -> [{}] Mode: {} | Reason: {}",
                        idx + 1, r.pid, r.process_name, r.policy_action, r.enforcement_mode, r.reason
                    );
                }
            }
            Err(e) => eprintln!("⚠️ Error inspecting spool records: {}", e),
        }

        if flush {
            println!("\n🔄 Flushing spool records to Sentinel API batch endpoint...");
            match spooler.flush_to_client(client) {
                Ok(synced) => {
                    println!("✅ Successfully flushed and synchronized {} quarantine records. Spool cleared.", synced);
                }
                Err(e) => {
                    eprintln!("❌ Batch flush failed: {}", e);
                    std::process::exit(1);
                }
            }
        } else {
            println!("\n💡 Run `shinpo-shield spool --flush` to synchronize these records immediately.");
        }
    } else {
        println!("✨ Spool is empty. No offline telemetry queued.");
    }
}

fn confirmed_active_sync(
    sync_result: Result<client::SentinelDaemonSyncResponse, String>,
) -> Option<client::SentinelDaemonSyncResponse> {
    sync_result.ok().filter(|sync| sync.has_active_session)
}

fn handle_sweep(client: &SentinelClient, config: &config::ShieldConfig, dry_run: bool) {
    println!("🔍 Performing one-shot Sentinel process sweep...\n");
    let mut enforcer = ShieldEnforcer::new();
    let spooler = OfflineSpooler::new(OfflineSpooler::default_path());

    let sync_result = client.sync();
    let sync_error = sync_result.as_ref().err().cloned();
    if let Ok(sync) = &sync_result {
        if !spooler.is_empty() {
            println!("🔄 Found {} offline buffered quarantine event(s). Flushing in batch...", spooler.len());
            match spooler.flush_to_client(client) {
                Ok(synced) => println!("✅ Synchronized {} buffered offline records to Sentinel API.", synced),
                Err(e) => eprintln!("⚠️ Spool synchronization warning: {}", e),
            }
        }
        if !sync.has_active_session {
            println!("No active Focus Session confirmed; skipping process enforcement.");
            return;
        }
    }

    let sync = match confirmed_active_sync(sync_result) {
        Some(sync) => sync,
        None => {
            eprintln!("⚠️ Sync failed ({}); skipping process enforcement.", sync_error.unwrap_or_default());
            return;
        }
    };

    let intercepted = enforcer.scan_and_enforce_with_candidate_evaluator(
        &sync,
        &config.fallback_blacklist,
        dry_run,
        Some(|name: &str, cmd: Option<&str>, pid: u32| {
            client.evaluate_candidate(&client::CandidateProcessRequest {
                process_name: name.to_string(),
                command_line: cmd.map(|s| s.to_string()),
                pid: Some(pid),
            })
        }),
    );

    if intercepted.is_empty() {
        println!("✨ Sentinel sweep clean: No distracting processes detected.");
    } else {
        println!("🚫 Intercepted {} distraction process(es):", intercepted.len());
        for p in &intercepted {
            println!(
                "  - PID {}: {} -> [{}] ({})",
                p.pid, p.name, p.policy_action, p.reason
            );

            // Report telemetry to the backend, fallback to local spool on network failure
            let req = ShieldEnforcer::to_quarantine_request(p);
            if let Err(e) = client.report_quarantine(&req) {
                eprintln!("    ⚠️ Direct telemetry reporting failed: {}. Buffering offline...", e);
                if let Err(spool_err) = spooler.append(&req) {
                    eprintln!("    ❌ Failed to buffer to offline spool: {}", spool_err);
                } else {
                    println!("    📦 Buffered to offline spool file ({} queued)", spooler.len());
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::confirmed_active_sync;
    use crate::client::SentinelDaemonSyncResponse;

    fn sync_state(has_active_session: bool) -> SentinelDaemonSyncResponse {
        SentinelDaemonSyncResponse {
            has_active_session,
            active_session_id: has_active_session.then_some(42),
            active_session_name: has_active_session.then(|| "Focus Session".to_string()),
            duration_minutes: has_active_session.then_some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: has_active_session,
            blocked_patterns: vec!["discord".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: None,
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: Vec::new(),
        }
    }

    #[test]
    fn manual_sweep_requires_successful_sync_with_active_session() {
        assert!(confirmed_active_sync(Err("backend unavailable".to_string())).is_none());
        assert!(confirmed_active_sync(Ok(sync_state(false))).is_none());

        let active_sync = confirmed_active_sync(Ok(sync_state(true))).unwrap();
        assert!(active_sync.has_active_session);
        assert_eq!(active_sync.enforcement_mode, "STRICT");
        assert_eq!(active_sync.blocked_patterns, vec!["discord"]);
    }
}

fn handle_run(client: &SentinelClient, config: &config::ShieldConfig, dry_run: bool) {
    println!("🛡️  Shield daemon monitoring loop active (polling every {}s). Press Ctrl+C to stop.\n", config.poll_interval_seconds);

    let mut enforcer = ShieldEnforcer::new();
    let spooler = OfflineSpooler::new(OfflineSpooler::default_path());
    let mut in_lockdown = false;

    loop {
        match client.sync() {
            Ok(sync) => {
                // If we have spooled offline records and backend is now responsive, flush in batch
                if !spooler.is_empty() {
                    match spooler.flush_to_client(client) {
                        Ok(synced) => {
                            println!("🔄 [SPOOL SYNC] Synchronized {} queued offline quarantine records to backend", synced);
                        }
                        Err(e) => {
                            eprintln!("⚠️ [SPOOL SYNC] Failed to flush offline spool: {}", e);
                        }
                    }
                }

                if sync.has_active_session {
                    let sprint_name = sync.active_session_name.as_deref().unwrap_or("Focus Sprint");
                    let duration = sync.duration_minutes.unwrap_or(25);
                    let intention = sync.intention.as_deref().unwrap_or("Deep Work Sprint");

                    if !in_lockdown {
                        in_lockdown = true;
                        println!(
                            "\n🔒 [LOCKDOWN ENGAGED] Active Sprint: '{}' ({}m)",
                            sprint_name, duration
                        );
                        println!("   Intention: {}", intention);
                        println!("   Enforcement Mode: {} (Locked: {})", sync.enforcement_mode, sync.is_policy_locked);
                        if config.notify_desktop {
                            send_desktop_notification(
                                "🛡️ SHINPO Focus Shield Engaged",
                                &format!("Lockdown active for {}m: {}", duration, intention),
                            );
                        }
                    }

                    // Enforce processes
                    let intercepted = enforcer.scan_and_enforce_with_candidate_evaluator(
                        &sync,
                        &config.fallback_blacklist,
                        dry_run,
                        Some(|name: &str, cmd: Option<&str>, pid: u32| {
                            client.evaluate_candidate(&client::CandidateProcessRequest {
                                process_name: name.to_string(),
                                command_line: cmd.map(|s| s.to_string()),
                                pid: Some(pid),
                            })
                        }),
                    );

                    for p in &intercepted {
                        println!(
                            "  🚫 [{}] PID {} ({}) - {}",
                            p.policy_action, p.pid, p.name, p.reason
                        );

                        // Forward telemetry to Spring Boot database, spool locally on network failure
                        let req = ShieldEnforcer::to_quarantine_request(p);
                        if let Err(e) = client.report_quarantine(&req) {
                            eprintln!("     ⚠️ Telemetry reporting failed: {}. Buffering offline...", e);
                            if let Err(spool_err) = spooler.append(&req) {
                                eprintln!("     ❌ Failed to write to local spool: {}", spool_err);
                            } else {
                                println!("     📦 Buffered event to offline spool ({} queued)", spooler.len());
                            }
                        }
                    }

                    if !intercepted.is_empty() && config.notify_desktop && !dry_run {
                        send_desktop_notification(
                            "🚫 Distraction Neutralized",
                            &format!("SHINPO Shield intercepted {} distracting process(es).", intercepted.len()),
                        );
                    }
                } else if in_lockdown {
                    in_lockdown = false;
                    println!(
                        "\n🔓 [LOCKDOWN RELEASED] Focus sprint ended. Normal OS access restored."
                    );
                    if config.notify_desktop {
                        send_desktop_notification(
                            "✅ SHINPO Focus Session Concluded",
                            "Distraction enforcement released. High-velocity session recorded.",
                        );
                    }
                }
            }
            Err(e) => {
                // Backend offline or error, wait and retry
                eprintln!("  [SHIELD SYNC] {}", e);
            }
        }

        sleep(Duration::from_secs(config.poll_interval_seconds));
    }
}
