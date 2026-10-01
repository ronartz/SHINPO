use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use sysinfo::{ProcessesToUpdate, System};

use crate::client::{RecordQuarantineRequest, SentinelDaemonSyncResponse};
use crate::platform::{create_platform_interceptor, PlatformInterceptor};

pub struct InterceptedProcess {
    pub pid: u32,
    pub name: String,
    pub cmdline: Option<String>,
    pub policy_action: String,
    pub enforcement_mode: String,
    pub reason: String,
}

pub struct ShieldEnforcer {
    sys: System,
    debounce_map: HashMap<u32, Instant>,
    protected_system_names: HashSet<String>,
    interceptor: Box<dyn PlatformInterceptor>,
}

impl ShieldEnforcer {
    pub fn new() -> Self {
        Self::with_interceptor(create_platform_interceptor())
    }

    #[allow(dead_code)]
    pub fn with_interceptor(interceptor: Box<dyn PlatformInterceptor>) -> Self {
        let mut protected = HashSet::new();
        for name in [
            "systemd", "init", "kernel", "kthreadd", "dbus", "sshd",
            "xorg", "wayland", "mutter", "gnome-shell", "kwin", "plasma",
            "pulseaudio", "pipewire", "wireplumber", "dockerd", "containerd",
            "postgres", "postgresql", "shinpo", "cargo", "rustc",
            "bash", "zsh", "sh", "fish", "sudo", "su", "login",
            "code", "idea", "nvim", "vim", "tmux",
            "java", "jvm", "mvn", "mvnw", "node", "npm", "npx", "vite", "git",
            "docker", "ollama", "qwen", "python", "python3",
        ] {
            protected.insert(name.to_string());
        }

        Self {
            sys: System::new_all(),
            debounce_map: HashMap::new(),
            protected_system_names: protected,
            interceptor,
        }
    }

    #[allow(dead_code)]
    pub fn interceptor(&self) -> &dyn PlatformInterceptor {
        self.interceptor.as_ref()
    }

    /// Scans the running OS processes against the active policy rules and executes containment.
    pub fn scan_and_enforce(
        &mut self,
        sync_state: &SentinelDaemonSyncResponse,
        fallback_blacklist: &[String],
        dry_run: bool,
    ) -> Vec<InterceptedProcess> {
        self.sys.refresh_processes(ProcessesToUpdate::All, true);

        let my_pid = std::process::id();
        let now = Instant::now();

        // Assemble active blacklist
        let mut active_blacklist: Vec<String> = sync_state.blocked_patterns.clone();
        if active_blacklist.is_empty() {
            active_blacklist.extend_from_slice(fallback_blacklist);
        }

        // Assemble whitelist & protected sets
        let allowed: HashSet<String> = sync_state.allowed_patterns
            .iter()
            .map(|s| s.to_lowercase().trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let mut protected = self.protected_system_names.clone();
        for p in &sync_state.protected_processes {
            let p_clean = p.to_lowercase().trim().to_string();
            if !p_clean.is_empty() {
                protected.insert(p_clean);
            }
        }

        let mode = if dry_run {
            "AUDIT_ONLY"
        } else {
            sync_state.enforcement_mode.as_str()
        };

        let mut intercepted = Vec::new();

        for (pid_obj, process) in self.sys.processes() {
            let pid = pid_obj.as_u32();
            if pid == my_pid || pid <= 1 {
                continue;
            }

            let proc_name = process.name().to_string_lossy().to_lowercase();
            let raw_cmd = process.cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" ");

            if !Self::is_distraction_process(&proc_name, &raw_cmd, &active_blacklist, &allowed, &protected) {
                continue;
            }

            // 4. Debounce check (45s window per PID)
            if let Some(last_seen) = self.debounce_map.get(&pid) {
                if now.duration_since(*last_seen) < Duration::from_secs(45) {
                    continue;
                }
            }
            self.debounce_map.insert(pid, now);

            // 5. Enforce according to mode
            let os_name = self.interceptor.os_name();
            let (action, reason) = if dry_run || mode == "AUDIT_ONLY" {
                (
                    "WARNED".to_string(),
                    format!("Native Shield ({}) audit: distraction active during focus sprint (dry-run)", os_name),
                )
            } else if mode == "CONTAINMENT" {
                // Graceful containment
                let killed = self.interceptor.terminate_process(pid, false).is_ok() || process.kill();
                if killed {
                    (
                        "CONTAINED".to_string(),
                        format!("Native Shield ({}): process gracefully stopped", os_name),
                    )
                } else {
                    (
                        "PERMISSION_DENIED".to_string(),
                        format!("Native Shield ({}): insufficient privileges to terminate target process", os_name),
                    )
                }
            } else {
                // STRICT MODE: forced kill
                let killed = self.interceptor.terminate_process(pid, true).is_ok() || process.kill();
                if killed {
                    (
                        "TERMINATED".to_string(),
                        format!("Native Shield ({}): zero-tolerance distraction forcibly terminated", os_name),
                    )
                } else {
                    (
                        "PERMISSION_DENIED".to_string(),
                        format!("Native Shield ({}): process termination denied by OS security policy", os_name),
                    )
                }
            };

            intercepted.push(InterceptedProcess {
                pid,
                name: process.name().to_string_lossy().to_string(),
                cmdline: if raw_cmd.is_empty() { None } else { Some(raw_cmd) },
                policy_action: action,
                enforcement_mode: mode.to_string(),
                reason,
            });
        }

        // Clean stale debounce entries
        if self.debounce_map.len() > 500 {
            self.debounce_map.retain(|_, time| now.duration_since(*time) < Duration::from_secs(300));
        }

        intercepted
    }

    pub fn is_distraction_process(
        proc_name: &str,
        raw_cmd: &str,
        active_blacklist: &[String],
        allowed: &HashSet<String>,
        protected: &HashSet<String>,
    ) -> bool {
        let proc_lower = proc_name.to_lowercase();
        let cmd_lower = raw_cmd.to_lowercase();

        // 1. Never touch protected system processes or shinpo itself
        if proc_lower.contains("shinpo") || cmd_lower.contains("shinpo") {
            return false;
        }
        if protected.iter().any(|prot| proc_lower.contains(prot) || proc_lower.starts_with(prot)) {
            return false;
        }

        // Ignore JVM internal threads and system kernel threads
        if proc_lower.starts_with("gc thread")
            || proc_lower.starts_with("http-nio")
            || proc_lower.starts_with("catalina")
            || proc_lower.starts_with("c1 compiler")
            || proc_lower.starts_with("common-cleaner")
            || proc_lower.starts_with("vm periodic")
            || proc_lower.starts_with("service thread")
            || proc_lower.starts_with("reference handl")
            || proc_lower.starts_with("vm thread")
            || proc_lower.starts_with("finalizer")
            || proc_lower.starts_with("signal dispatch")
        {
            return false;
        }

        // 2. Never touch user-whitelisted processes
        if allowed.iter().any(|allow| proc_lower.contains(allow)) {
            return false;
        }

        // 3. Match against blacklist (strict matching to avoid substring accidents)
        active_blacklist.iter().any(|b| {
            let b_clean = b.trim().to_lowercase();
            if b_clean.is_empty() {
                return false;
            }

            if b_clean.len() <= 3 {
                // Short patterns like "obs", "vlc": exact or hyphenated prefix match
                proc_lower == b_clean
                    || proc_lower.starts_with(&(b_clean.clone() + "-"))
                    || proc_lower.starts_with(&(b_clean.clone() + "_"))
                    || proc_lower.ends_with(&("/".to_string() + &b_clean))
            } else {
                // Longer patterns like "discord", "spotify", "telegram"
                proc_lower.contains(&b_clean)
            }
        })
    }

    pub fn to_quarantine_request(item: &InterceptedProcess) -> RecordQuarantineRequest {
        RecordQuarantineRequest {
            pid: item.pid,
            process_name: item.name.clone(),
            command_line: item.cmdline.clone(),
            policy_action: item.policy_action.clone(),
            enforcement_mode: item.enforcement_mode.clone(),
            reason: item.reason.clone(),
        }
    }
}

pub fn send_desktop_notification(title: &str, message: &str) {
    let interceptor = create_platform_interceptor();
    interceptor.notify_user(title, message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distraction_detection_positive() {
        let enforcer = ShieldEnforcer::new();
        let blacklist = vec!["discord".to_string(), "steam".to_string(), "obs".to_string()];
        let allowed = HashSet::new();

        assert!(ShieldEnforcer::is_distraction_process(
            "discord", "/usr/bin/discord", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(ShieldEnforcer::is_distraction_process(
            "steam", "/usr/bin/steam", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(ShieldEnforcer::is_distraction_process(
            "obs", "/usr/bin/obs", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(ShieldEnforcer::is_distraction_process(
            "obs-studio", "/usr/bin/obs-studio", &blacklist, &allowed, &enforcer.protected_system_names
        ));
    }

    #[test]
    fn test_short_pattern_false_positive_immunity() {
        let enforcer = ShieldEnforcer::new();
        let blacklist = vec!["obs".to_string(), "vlc".to_string()];
        let allowed = HashSet::new();

        // "observer" or "jobs" should NEVER match "obs"
        assert!(!ShieldEnforcer::is_distraction_process(
            "observer", "/usr/bin/observer", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(!ShieldEnforcer::is_distraction_process(
            "jobs_worker", "/usr/bin/jobs_worker", &blacklist, &allowed, &enforcer.protected_system_names
        ));
    }

    #[test]
    fn test_protected_process_immunity() {
        let enforcer = ShieldEnforcer::new();
        let blacklist = vec!["java".to_string(), "postgres".to_string(), "shinpo".to_string()];
        let allowed = HashSet::new();

        // Even if someone put "java" or "postgres" or "shinpo" in blacklist, it must be protected!
        assert!(!ShieldEnforcer::is_distraction_process(
            "java", "java -jar target.jar", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(!ShieldEnforcer::is_distraction_process(
            "postgres", "/usr/bin/postgres", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(!ShieldEnforcer::is_distraction_process(
            "shinpo_backend", "shinpo -Ddev", &blacklist, &allowed, &enforcer.protected_system_names
        ));
    }

    #[test]
    fn test_user_whitelist_overrides_blacklist() {
        let enforcer = ShieldEnforcer::new();
        let blacklist = vec!["discord".to_string(), "slack".to_string()];
        let mut allowed = HashSet::new();
        allowed.insert("slack".to_string());

        // Discord is blocked
        assert!(ShieldEnforcer::is_distraction_process(
            "discord", "/usr/bin/discord", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        // Slack is whitelisted, so it is allowed!
        assert!(!ShieldEnforcer::is_distraction_process(
            "slack", "/usr/bin/slack", &blacklist, &allowed, &enforcer.protected_system_names
        ));
    }

    #[test]
    fn test_jvm_internal_threads_ignored() {
        let enforcer = ShieldEnforcer::new();
        let blacklist = vec!["thread".to_string(), "catalina".to_string(), "service".to_string()];
        let allowed = HashSet::new();

        assert!(!ShieldEnforcer::is_distraction_process(
            "gc thread#0", "", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(!ShieldEnforcer::is_distraction_process(
            "http-nio-8080-exec-1", "", &blacklist, &allowed, &enforcer.protected_system_names
        ));
        assert!(!ShieldEnforcer::is_distraction_process(
            "catalina-utility-1", "", &blacklist, &allowed, &enforcer.protected_system_names
        ));
    }

    #[test]
    fn test_enforcer_interceptor_binding() {
        let enforcer = ShieldEnforcer::new();
        assert!(!enforcer.interceptor().os_name().is_empty());
        assert!(enforcer.interceptor().network_filtering_supported());
    }
}

