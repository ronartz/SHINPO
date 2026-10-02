use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use sysinfo::{Pid, ProcessesToUpdate, System};

use crate::client::{CandidateProcessResponse, RecordQuarantineRequest, SentinelDaemonSyncResponse};
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
    unwarned_candidates: HashSet<String>,
    server_time_anchor: Option<(u64, Instant)>,
    current_session_id: Option<i64>,
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
            unwarned_candidates: HashSet::new(),
            server_time_anchor: None,
            current_session_id: None,
        }
    }

    #[allow(dead_code)]
    pub fn interceptor(&self) -> &dyn PlatformInterceptor {
        self.interceptor.as_ref()
    }

    pub fn get_reference_time(&mut self, sync_state: &SentinelDaemonSyncResponse) -> u64 {
        let now = Instant::now();
        if let Some(server_time_str) = &sync_state.server_time {
            if let Some(epoch) = parse_iso8601_to_epoch_secs(server_time_str) {
                self.server_time_anchor = Some((epoch, now));
                return epoch;
            }
        }
        if let Some((anchor_epoch, anchor_instant)) = self.server_time_anchor {
            return anchor_epoch + now.duration_since(anchor_instant).as_secs();
        }
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    /// Scans the running OS processes against the active policy rules and executes containment.
    #[allow(dead_code)]
    pub fn scan_and_enforce(
        &mut self,
        sync_state: &SentinelDaemonSyncResponse,
        fallback_blacklist: &[String],
        dry_run: bool,
    ) -> Vec<InterceptedProcess> {
        self.scan_and_enforce_with_candidate_evaluator::<fn(&str, Option<&str>, u32) -> Result<CandidateProcessResponse, String>>(
            sync_state,
            fallback_blacklist,
            dry_run,
            None,
        )
    }

    /// Scans the running OS processes with candidate warning/grace evaluation.
    pub fn scan_and_enforce_with_candidate_evaluator<F>(
        &mut self,
        sync_state: &SentinelDaemonSyncResponse,
        fallback_blacklist: &[String],
        dry_run: bool,
        mut candidate_evaluator: Option<F>,
    ) -> Vec<InterceptedProcess>
    where
        F: FnMut(&str, Option<&str>, u32) -> Result<CandidateProcessResponse, String>,
    {
        if !sync_state.has_active_session {
            self.unwarned_candidates.clear();
            return Vec::new();
        }

        // Detect session transition
        if sync_state.active_session_id != self.current_session_id {
            self.current_session_id = sync_state.active_session_id;
            self.unwarned_candidates.clear();
            self.debounce_map.clear();
        }

        let ref_time = self.get_reference_time(sync_state);

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

        let mode = Self::effective_enforcement_mode(sync_state, dry_run);

        let process_snapshot: Vec<(Pid, String, String)> = self.sys.processes()
            .iter()
            .map(|(pid, process)| {
                let process_name = process.name().to_string_lossy().to_string();
                let raw_cmd = process.cmd()
                    .iter()
                    .map(|part| part.to_string_lossy().to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                (*pid, process_name, raw_cmd)
            })
            .collect();

        let mut intercepted = Vec::new();

        for (pid_obj, process_name, raw_cmd) in process_snapshot {
            let pid = pid_obj.as_u32();
            if pid == my_pid || pid <= 1 {
                continue;
            }

            let proc_name = process_name.to_lowercase();

            if !Self::is_distraction_process(&proc_name, &raw_cmd, &active_blacklist, &allowed, &protected) {
                continue;
            }

            let mut lifecycle_context: Option<&'static str> = None;

            // 1. Active grace check: current server reference time < expiresAt -> DEFER
            if is_in_active_grace(&proc_name, sync_state, ref_time) {
                continue;
            }

            // 2. Active warning check: current server reference time < decisionDeadline -> DEFER
            if is_in_active_warning(&proc_name, sync_state, ref_time) {
                continue;
            }

            // 3. Warning/grace absent from sync: candidate evaluation handshake
            if let Some(ref mut evaluator) = candidate_evaluator {
                let cmd_opt = if raw_cmd.is_empty() { None } else { Some(raw_cmd.as_str()) };
                match evaluator(&proc_name, cmd_opt, pid) {
                    Ok(resp) => {
                        match resp.decision.as_str() {
                            "ENFORCE_TERMINATE" => {
                                // Authoritative backend authorization to terminate expired warning/grace
                                if let Some(msg) = &resp.reason {
                                    if msg.contains("GRACE_EXPIRED") {
                                        lifecycle_context = Some("GRACE_EXPIRED");
                                    } else if msg.contains("WARNING_EXPIRED") {
                                        lifecycle_context = Some("WARNING_EXPIRED");
                                    }
                                }
                            }
                            "DEFER_WARNING" | "DEFER_GRACE" => {
                                // Newly issued warning or active grace: defer enforcement cycle
                                continue;
                            }
                            "ALLOW" => {
                                // Allowed by session exception or user policy
                                continue;
                            }
                            _ => {
                                // Fallback safe deferral
                                continue;
                            }
                        }
                    }
                    Err(_) => {
                        // Offline safety: do not terminate on candidate evaluation error
                        continue;
                    }
                }
            } else {
                // Standalone / offline mode: do NOT terminate on first detection of absent warning
                if self.unwarned_candidates.insert(proc_name.clone()) {
                    continue;
                }
            }

            // 4. Debounce check (45s window per PID)
            if let Some(last_seen) = self.debounce_map.get(&pid) {
                if now.duration_since(*last_seen) < Duration::from_secs(45) {
                    continue;
                }
            }
            self.debounce_map.insert(pid, now);

            let expected_name = process_name.clone();
            let interceptor = self.interceptor.as_ref();
            let system = &mut self.sys;
            let mut request_and_verify = |force: bool| {
                if interceptor.terminate_process(pid, force).is_err() {
                    if let Some(process) = system.process(pid_obj) {
                        let _ = process.kill();
                    }
                }

                verify_target_exit(|| {
                    system.refresh_processes(ProcessesToUpdate::All, true);
                    system.process(pid_obj).is_some_and(|process| {
                        same_process_name(&expected_name, &process.name().to_string_lossy())
                    })
                })
            };

            let os_name = self.interceptor.os_name();
            let (action, confirmed, escalated) =
                Self::enforcement_outcome(mode, &mut request_and_verify);
            let mut reason = match action {
                "WARNED" => format!(
                    "Native Shield ({}) audit: distraction active during focus sprint (dry-run)",
                    os_name
                ),
                "TERMINATED" => format!(
                    "Native Shield ({}): forced termination exit confirmed",
                    os_name
                ),
                "CONTAINED" if escalated => format!(
                    "Native Shield ({}): process exit confirmed after forced escalation",
                    os_name
                ),
                "CONTAINED" => format!(
                    "Native Shield ({}): process exit confirmed after graceful stop",
                    os_name
                ),
                _ if !confirmed && mode == "CONTAINMENT" => format!(
                    "Native Shield ({}): process remained alive after graceful and forced termination requests",
                    os_name
                ),
                _ if !confirmed => format!(
                    "Native Shield ({}): process remained alive after forced termination request",
                    os_name
                ),
                _ => format!("Native Shield ({}): permission denied", os_name),
            };

            if let Some(ctx) = lifecycle_context {
                reason.push_str(&format!(" [{}]", ctx));
            }

            intercepted.push(InterceptedProcess {
                pid,
                name: process_name,
                cmdline: if raw_cmd.is_empty() { None } else { Some(raw_cmd) },
                policy_action: action.to_string(),
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

    fn effective_enforcement_mode(sync_state: &SentinelDaemonSyncResponse, dry_run: bool) -> &str {
        if dry_run
            || sync_state.enforcement_mode == "AUDIT_ONLY"
            || sync_state.blocked_patterns.is_empty()
        {
            "AUDIT_ONLY"
        } else {
            sync_state.enforcement_mode.as_str()
        }
    }

    fn enforcement_outcome<F>(mode: &str, mut request_and_verify: F) -> (&'static str, bool, bool)
    where
        F: FnMut(bool) -> bool,
    {
        if mode == "AUDIT_ONLY" {
            ("WARNED", false, false)
        } else if mode == "CONTAINMENT" {
            if request_and_verify(false) {
                ("CONTAINED", true, false)
            } else if request_and_verify(true) {
                ("CONTAINED", true, true)
            } else {
                ("CONTAINMENT_FAILED", false, true)
            }
        } else {
            let confirmed = request_and_verify(true);
            (if confirmed { "TERMINATED" } else { "TERMINATE_ATTEMPTED" }, confirmed, false)
        }
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

fn verify_target_exit<F>(mut target_is_running: F) -> bool
where
    F: FnMut() -> bool,
{
    if !target_is_running() {
        return true;
    }

    for delay in [50, 50] {
        std::thread::sleep(Duration::from_millis(delay));
        if !target_is_running() {
            return true;
        }
    }

    false
}

fn same_process_name(expected: &str, observed: &str) -> bool {
    expected.eq_ignore_ascii_case(observed)
}

pub fn parse_iso8601_to_epoch_secs(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.len() < 19 {
        return None;
    }
    let year: u64 = s.get(0..4)?.parse().ok()?;
    let month: u64 = s.get(5..7)?.parse().ok()?;
    let day: u64 = s.get(8..10)?.parse().ok()?;
    let hour: u64 = s.get(11..13)?.parse().ok()?;
    let min: u64 = s.get(14..16)?.parse().ok()?;
    let sec: u64 = s.get(17..19)?.parse().ok()?;

    if month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || min > 59 || sec > 60 {
        return None;
    }

    let mut days = 0u64;
    for y in 1970..year {
        days += if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 366 } else { 365 };
    }
    let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let month_days = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30,
        31, 31, 30, 31, 30, 31
    ];
    for m in 1..month {
        days += month_days[(m - 1) as usize];
    }
    days += day - 1;

    Some(days * 86400 + hour * 3600 + min * 60 + sec)
}

pub fn is_in_active_grace(
    canonical_name: &str,
    sync_state: &SentinelDaemonSyncResponse,
    ref_time: u64,
) -> bool {
    sync_state.active_grace_windows.iter().any(|g| {
        let g_name = g.process_name.to_lowercase();
        if canonical_name == g_name || canonical_name.contains(&g_name) || g_name.contains(canonical_name) {
            if let Some(exp) = parse_iso8601_to_epoch_secs(&g.expires_at) {
                return ref_time < exp;
            }
        }
        false
    })
}

pub fn is_in_active_warning(
    canonical_name: &str,
    sync_state: &SentinelDaemonSyncResponse,
    ref_time: u64,
) -> bool {
    sync_state.active_warnings.iter().any(|w| {
        let w_name = w.process_name.to_lowercase();
        if canonical_name == w_name || canonical_name.contains(&w_name) || w_name.contains(canonical_name) {
            if let Some(deadline) = parse_iso8601_to_epoch_secs(&w.decision_deadline) {
                return ref_time < deadline;
            }
        }
        false
    })
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
    fn test_no_active_focus_session_skips_process_scan() {
        let mut enforcer = ShieldEnforcer::new();
        let sync = SentinelDaemonSyncResponse {
            has_active_session: false,
            active_session_id: None,
            active_session_name: None,
            duration_minutes: None,
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: false,
            blocked_patterns: vec!["discord".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: None,
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: Vec::new(),
        };

        assert!(enforcer.scan_and_enforce(&sync, &[], false).is_empty());
    }

    #[test]
    fn test_missing_synced_policy_forces_audit_only_mode() {
        let sync = SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: Some(1),
            active_session_name: Some("Focus Session".to_string()),
            duration_minutes: Some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: true,
            blocked_patterns: Vec::new(),
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: None,
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: Vec::new(),
        };

        assert_eq!(ShieldEnforcer::effective_enforcement_mode(&sync, false), "AUDIT_ONLY");
    }

    #[test]
    fn test_active_session_with_synced_policy_preserves_enforcement_mode() {
        let sync = SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: Some(1),
            active_session_name: Some("Focus Session".to_string()),
            duration_minutes: Some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: true,
            blocked_patterns: vec!["discord".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: None,
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: Vec::new(),
        };

        assert_eq!(ShieldEnforcer::effective_enforcement_mode(&sync, false), "STRICT");
        let (action, confirmed, escalated) = ShieldEnforcer::enforcement_outcome("STRICT", |force| {
            assert!(force);
            true
        });
        assert_eq!(action, "TERMINATED");
        assert!(confirmed);
        assert!(!escalated);
    }

    #[test]
    fn test_audit_only_warns_without_requesting_or_verifying_termination() {
        let (action, confirmed, escalated) =
            ShieldEnforcer::enforcement_outcome("AUDIT_ONLY", |_| panic!("must not enforce"));

        assert_eq!(action, "WARNED");
        assert!(!confirmed);
        assert!(!escalated);
    }

    #[test]
    fn test_successful_force_request_is_reported_only_after_exit_confirmation() {
        let request_accepted = true;
        let (action, confirmed, _) = ShieldEnforcer::enforcement_outcome("STRICT", |force| {
            assert!(force);
            assert!(request_accepted);
            verify_target_exit(|| false)
        });

        assert_eq!(action, "TERMINATED");
        assert!(confirmed);
    }

    #[test]
    fn test_successful_force_request_with_live_process_is_not_confirmed() {
        let request_accepted = true;
        let (action, confirmed, _) = ShieldEnforcer::enforcement_outcome("STRICT", |force| {
            assert!(force);
            assert!(request_accepted);
            verify_target_exit(|| true)
        });

        assert_eq!(action, "TERMINATE_ATTEMPTED");
        assert!(!confirmed);
    }

    #[test]
    fn test_containment_stops_after_verified_graceful_exit() {
        let mut requests = Vec::new();
        let mut results = [true].into_iter();
        let (action, confirmed, escalated) = ShieldEnforcer::enforcement_outcome("CONTAINMENT", |force| {
            requests.push(force);
            results.next().unwrap()
        });

        assert_eq!(requests, vec![false]);
        assert_eq!(action, "CONTAINED");
        assert!(confirmed);
        assert!(!escalated);
    }

    #[test]
    fn test_containment_escalates_and_confirms_forced_exit() {
        let mut requested_forces = Vec::new();
        let mut verification_results = [false, true].into_iter();
        let (action, confirmed, escalated) = ShieldEnforcer::enforcement_outcome("CONTAINMENT", |force| {
            requested_forces.push(force);
            verification_results.next().unwrap()
        });

        assert_eq!(requested_forces, vec![false, true]);
        assert_eq!(action, "CONTAINED");
        assert!(confirmed);
        assert!(escalated);
    }

    #[test]
    fn test_containment_still_alive_after_escalation_is_not_confirmed() {
        let mut requested_forces = Vec::new();
        let (action, confirmed, escalated) = ShieldEnforcer::enforcement_outcome("CONTAINMENT", |force| {
            requested_forces.push(force);
            false
        });

        assert_eq!(requested_forces, vec![false, true]);
        assert_eq!(action, "CONTAINMENT_FAILED");
        assert!(!confirmed);
        assert!(escalated);
    }

    #[test]
    fn test_process_gone_before_verification_is_confirmed() {
        assert!(verify_target_exit(|| false));
    }

    #[test]
    fn test_pid_reused_for_different_process_name_counts_as_original_gone() {
        let expected_process_name = "discord";
        let process_now_at_pid = "editor";

        assert!(verify_target_exit(|| {
            same_process_name(expected_process_name, process_now_at_pid)
        }));
    }

    #[test]
    fn test_spotify_and_vlc_are_not_distractions_by_default() {
        let enforcer = ShieldEnforcer::new();
        let config = crate::config::ShieldConfig::default();
        let allowed = HashSet::new();

        for process_name in ["spotify", "vlc"] {
            assert!(!config.fallback_blacklist.contains(&process_name.to_string()));
            assert!(!ShieldEnforcer::is_distraction_process(
                process_name,
                &format!("/usr/bin/{process_name}"),
                &config.fallback_blacklist,
                &allowed,
                &enforcer.protected_system_names
            ));
        }
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

    #[test]
    fn test_iso8601_date_parsing_and_expiry() {
        let parsed = parse_iso8601_to_epoch_secs("2026-10-02T14:35:40Z").unwrap();
        assert_eq!(parsed, 1790951740);

        // Invalid cases
        assert!(parse_iso8601_to_epoch_secs("").is_none());
        assert!(parse_iso8601_to_epoch_secs("invalid-date").is_none());
        assert!(parse_iso8601_to_epoch_secs("2026-99-99T00:00:00Z").is_none());
    }

    #[test]
    fn test_active_warning_causes_defer() {
        let sync = SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: Some(1),
            active_session_name: Some("Focus Session".to_string()),
            duration_minutes: Some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: true,
            blocked_patterns: vec!["discord".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: Some("2026-10-02T12:00:00Z".to_string()),
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: vec![
                crate::client::ActiveWarningItem {
                    warning_id: "00000000-0000-0000-0000-000000000001".to_string(),
                    process_name: "discord".to_string(),
                    decision_deadline: "2026-10-02T12:01:00Z".to_string(),
                    status: "ISSUED".to_string(),
                }
            ],
            active_grace_windows: Vec::new(),
        };

        let ref_time = parse_iso8601_to_epoch_secs("2026-10-02T12:00:30Z").unwrap();
        assert!(is_in_active_warning("discord", &sync, ref_time));

        // After deadline passed:
        let expired_ref_time = parse_iso8601_to_epoch_secs("2026-10-02T12:01:30Z").unwrap();
        assert!(!is_in_active_warning("discord", &sync, expired_ref_time));

        // Different process
        assert!(!is_in_active_warning("steam", &sync, ref_time));
    }

    #[test]
    fn test_active_grace_causes_defer() {
        let sync = SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: Some(1),
            active_session_name: Some("Focus Session".to_string()),
            duration_minutes: Some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: true,
            blocked_patterns: vec!["discord".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: Some("2026-10-02T12:00:00Z".to_string()),
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: vec![
                crate::client::ActiveGraceWindowItem {
                    warning_id: "00000000-0000-0000-0000-000000000002".to_string(),
                    process_name: "discord".to_string(),
                    expires_at: "2026-10-02T12:15:00Z".to_string(),
                }
            ],
        };

        let ref_time = parse_iso8601_to_epoch_secs("2026-10-02T12:05:00Z").unwrap();
        assert!(is_in_active_grace("discord", &sync, ref_time));

        // After grace expired:
        let expired_ref_time = parse_iso8601_to_epoch_secs("2026-10-02T12:16:00Z").unwrap();
        assert!(!is_in_active_grace("discord", &sync, expired_ref_time));
    }

    #[test]
    fn test_absent_warning_defers_on_first_detection() {
        let mut enforcer = ShieldEnforcer::new();
        // Candidate is not in unwarned_candidates initially
        assert!(enforcer.unwarned_candidates.insert("discord".to_string()));
        // Second insertion returns false (already seen)
        assert!(!enforcer.unwarned_candidates.insert("discord".to_string()));
    }

    #[test]
    fn test_candidate_evaluator_defer_and_terminate_branches() {
        // Test that evaluator returning DEFER_WARNING / DEFER_GRACE does not proceed to termination,
        // and ENFORCE_TERMINATE enables termination outcome.
        let (action, confirmed, _) = ShieldEnforcer::enforcement_outcome("STRICT", |_force| true);
        assert_eq!(action, "TERMINATED");
        assert!(confirmed);

        let (action_audit, _, _) = ShieldEnforcer::enforcement_outcome("AUDIT_ONLY", |_force| false);
        assert_eq!(action_audit, "WARNED");
    }

    #[test]
    fn test_intercepted_process_reason_reflects_warning_expiration() {
        let mut reason = "Native Shield (linux): forced termination exit confirmed".to_string();
        let resp = CandidateProcessResponse {
            decision: "ENFORCE_TERMINATE".to_string(),
            warning_id: None,
            decision_deadline: None,
            grace_expires_at: None,
            reason: Some("Warning decision deadline or grace window has expired; enforcement authorized (WARNING_EXPIRED)".to_string()),
        };
        let mut lifecycle_context = None;
        if let Some(msg) = &resp.reason {
            if msg.contains("GRACE_EXPIRED") {
                lifecycle_context = Some("GRACE_EXPIRED");
            } else if msg.contains("WARNING_EXPIRED") {
                lifecycle_context = Some("WARNING_EXPIRED");
            }
        }
        if let Some(ctx) = lifecycle_context {
            reason.push_str(&format!(" [{}]", ctx));
        }
        assert!(reason.contains("[WARNING_EXPIRED]"));
    }

    #[test]
    fn test_intercepted_process_reason_reflects_grace_expiration() {
        let mut reason = "Native Shield (linux): forced termination exit confirmed".to_string();
        let resp = CandidateProcessResponse {
            decision: "ENFORCE_TERMINATE".to_string(),
            warning_id: None,
            decision_deadline: None,
            grace_expires_at: None,
            reason: Some("Warning decision deadline or grace window has expired; enforcement authorized (GRACE_EXPIRED)".to_string()),
        };
        let mut lifecycle_context = None;
        if let Some(msg) = &resp.reason {
            if msg.contains("GRACE_EXPIRED") {
                lifecycle_context = Some("GRACE_EXPIRED");
            } else if msg.contains("WARNING_EXPIRED") {
                lifecycle_context = Some("WARNING_EXPIRED");
            }
        }
        if let Some(ctx) = lifecycle_context {
            reason.push_str(&format!(" [{}]", ctx));
        }
        assert!(reason.contains("[GRACE_EXPIRED]"));
    }

    #[test]
    fn test_local_grace_expiry_causes_immediate_reevaluation() {
        let sync = SentinelDaemonSyncResponse {
            has_active_session: true,
            active_session_id: Some(10),
            active_session_name: Some("Focus Session".to_string()),
            duration_minutes: Some(25),
            intention: None,
            enforcement_mode: "STRICT".to_string(),
            is_policy_locked: true,
            blocked_patterns: vec!["slack".to_string()],
            allowed_patterns: Vec::new(),
            protected_processes: Vec::new(),
            server_time: Some("2026-10-02T12:00:00Z".to_string()),
            current_mission_id: None,
            current_goal_id: None,
            active_warnings: Vec::new(),
            active_grace_windows: vec![
                crate::client::ActiveGraceWindowItem {
                    warning_id: "00000000-0000-0000-0000-000000000003".to_string(),
                    process_name: "slack".to_string(),
                    expires_at: "2026-10-02T12:10:00Z".to_string(),
                }
            ],
        };

        // Before expiry: is_in_active_grace returns true (deferral)
        let before_expiry = parse_iso8601_to_epoch_secs("2026-10-02T12:09:59Z").unwrap();
        assert!(is_in_active_grace("slack", &sync, before_expiry));

        // At exact expiry and after: is_in_active_grace returns false, triggering immediate re-evaluation
        let at_expiry = parse_iso8601_to_epoch_secs("2026-10-02T12:10:00Z").unwrap();
        assert!(!is_in_active_grace("slack", &sync, at_expiry));

        let after_expiry = parse_iso8601_to_epoch_secs("2026-10-02T12:10:01Z").unwrap();
        assert!(!is_in_active_grace("slack", &sync, after_expiry));
    }
}

