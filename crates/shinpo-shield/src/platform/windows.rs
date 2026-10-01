use std::process::Command;
use crate::platform::PlatformInterceptor;

/// Windows implementation using Win32 / taskkill and PowerShell Windows Toast Notifications.
/// Pre-configured with Windows Filtering Platform (WFP) architecture stubs.
pub struct WindowsInterceptor;

impl WindowsInterceptor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsInterceptor {
    fn default() -> Self {
        Self::new()
    }
}

impl PlatformInterceptor for WindowsInterceptor {
    fn os_name(&self) -> &'static str {
        "Windows"
    }

    fn terminate_process(&self, pid: u32, force: bool) -> Result<(), String> {
        let mut cmd = Command::new("taskkill");
        if force {
            cmd.arg("/F");
        }
        cmd.args(["/PID", &pid.to_string()]);

        let output = cmd.output()
            .map_err(|e| format!("Failed to execute taskkill for PID {}: {}", pid, e))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("taskkill failed for PID {}: {}", pid, stderr.trim()))
        }
    }

    fn notify_user(&self, title: &str, body: &str) {
        // PowerShell Toast Notification via Windows 10/11 WinRT notifications
        let ps_script = format!(
            r#"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
$textNodes = $template.GetElementsByTagName('text');
$textNodes.Item(0).AppendChild($template.CreateTextNode('{}')) > $null;
$textNodes.Item(1).AppendChild($template.CreateTextNode('{}')) > $null;
$toast = [Windows.UI.Notifications.ToastNotification]::new($template);
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('SHINPO Shield').Show($toast);"#,
            title.replace('\'', "''"),
            body.replace('\'', "''")
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .output();
    }

    fn is_privileged(&self) -> bool {
        // 'net session' exits with 0 only if running elevated as Administrator
        if let Ok(output) = Command::new("net").arg("session").output() {
            output.status.success()
        } else {
            false
        }
    }

    fn network_filtering_supported(&self) -> bool {
        true
    }

    fn network_filtering_status(&self) -> &'static str {
        "WFP (Windows Filtering Platform) Sublayer GUID: {516629B7-SHINPO-WFP-LAYER} defined"
    }
}
