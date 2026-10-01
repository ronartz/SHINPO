mod client;
mod config;
mod enforcer;

use std::thread::sleep;
use std::time::Duration;

use client::SentinelClient;
use config::{load_config, CliOptions, ShieldCommand};
use enforcer::{send_desktop_notification, ShieldEnforcer};

fn main() {
    let opts = CliOptions::parse();
    let config = load_config(&opts);

    let client = SentinelClient::new(config.api_url.clone(), config.auth_token.clone());

    println!("=================================================================");
    println!("  進歩 (SHINPO) RUST FOCUS ENFORCEMENT SHIELD DAEMON");
    println!("  Engine: Native Rust 1.98 • Zero-Overhead Process Sentinel");
    println!("  Target API: {}", config.api_url);
    println!("  Authentication: {}", if config.auth_token.is_some() { "BEARER JWT CONFIGURED" } else { "ANONYMOUS / FALLBACK" });
    println!("  Execution Mode: {}", if opts.dry_run { "AUDIT-ONLY (DRY-RUN)" } else { "DYNAMIC AUTONOMOUS (BACKEND DRIVEN)" });
    println!("=================================================================\n");

    match opts.command {
        ShieldCommand::Status => handle_status(&client),
        ShieldCommand::Sweep => handle_sweep(&client, &config, opts.dry_run),
        ShieldCommand::Run => handle_run(&client, &config, opts.dry_run),
    }
}

fn handle_status(client: &SentinelClient) {
    println!("📡 Probing Sentinel Daemon Sync endpoint...\n");
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

fn handle_sweep(client: &SentinelClient, config: &config::ShieldConfig, dry_run: bool) {
    println!("🔍 Performing one-shot Sentinel process sweep...\n");
    let mut enforcer = ShieldEnforcer::new();

    let sync = client.sync().unwrap_or_else(|err| {
        eprintln!("⚠️ Sync failed ({}), using fallback configuration.", err);
        client::SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: None,
            active_session_name: Some("Manual Sweep".to_string()),
            duration_minutes: None,
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: false,
            blocked_patterns: config.fallback_blacklist.clone(),
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
        }
    });

    let intercepted = enforcer.scan_and_enforce(&sync, &config.fallback_blacklist, dry_run);

    if intercepted.is_empty() {
        println!("✨ Sentinel sweep clean: No distracting processes detected.");
    } else {
        println!("🚫 Intercepted {} distraction process(es):", intercepted.len());
        for p in &intercepted {
            println!(
                "  - PID {}: {} -> [{}] ({})",
                p.pid, p.name, p.policy_action, p.reason
            );

            // Report telemetry to backend
            let req = ShieldEnforcer::to_quarantine_request(p);
            if let Err(e) = client.report_quarantine(&req) {
                eprintln!("    (Telemetry reporting warning: {})", e);
            }
        }
    }
}

fn handle_run(client: &SentinelClient, config: &config::ShieldConfig, dry_run: bool) {
    println!("🛡️  Shield daemon monitoring loop active (polling every {}s). Press Ctrl+C to stop.\n", config.poll_interval_seconds);

    let mut enforcer = ShieldEnforcer::new();
    let mut in_lockdown = false;

    loop {
        match client.sync() {
            Ok(sync) => {
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
                    let intercepted = enforcer.scan_and_enforce(&sync, &config.fallback_blacklist, dry_run);

                    for p in &intercepted {
                        println!(
                            "  🚫 [{}] PID {} ({}) - {}",
                            p.policy_action, p.pid, p.name, p.reason
                        );

                        // Forward telemetry to Spring Boot database
                        let req = ShieldEnforcer::to_quarantine_request(p);
                        if let Err(e) = client.report_quarantine(&req) {
                            eprintln!("     ⚠️ Telemetry reporting failed: {}", e);
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
