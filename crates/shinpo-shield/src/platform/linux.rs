use std::process::Command;
use crate::platform::PlatformInterceptor;

pub struct LinuxInterceptor;

impl LinuxInterceptor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for LinuxInterceptor {
    fn default() -> Self {
        Self::new()
    }
}

impl PlatformInterceptor for LinuxInterceptor {
    fn os_name(&self) -> &'static str {
        "Linux"
    }

    fn terminate_process(&self, pid: u32, force: bool) -> Result<(), String> {
        let signal = if force { "-9" } else { "-15" };
        let output = Command::new("kill")
            .args([signal, &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to execute kill command: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("kill failed for PID {}: {}", pid, stderr.trim()))
        }
    }

    fn notify_user(&self, title: &str, body: &str) {
        let _ = Command::new("notify-send")
            .args(["-u", "critical", "-a", "SHINPO Shield (Linux)", title, body])
            .output();
    }

    fn is_privileged(&self) -> bool {
        if let Ok(output) = Command::new("id").arg("-u").output() {
            let uid_str = String::from_utf8_lossy(&output.stdout);
            uid_str.trim() == "0"
        } else {
            false
        }
    }

    fn network_filtering_supported(&self) -> bool {
        true
    }

    fn network_filtering_status(&self) -> &'static str {
        "eBPF / cgroup2 / iptables filter available (requires CAP_BPF / root)"
    }
}
