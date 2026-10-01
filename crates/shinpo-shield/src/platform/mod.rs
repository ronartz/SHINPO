pub mod linux;
pub mod macos;
pub mod windows;

pub use linux::LinuxInterceptor;
pub use macos::MacOsInterceptor;
pub use windows::WindowsInterceptor;

/// Cross-platform abstraction for OS-level process management, notifications, and telemetry.
pub trait PlatformInterceptor: Send + Sync {
    /// Friendly OS family name (e.g., "Linux", "Windows", "macOS").
    fn os_name(&self) -> &'static str;

    /// Terminates a target process by PID.
    /// If `force` is false, sends a graceful termination signal (SIGTERM, taskkill).
    /// If `force` is true, forcibly terminates the process (SIGKILL, taskkill /F).
    fn terminate_process(&self, pid: u32, force: bool) -> Result<(), String>;

    /// Dispatches a high-priority native desktop notification to the user.
    fn notify_user(&self, title: &str, body: &str);

    /// Checks if the running daemon process has elevated privileges (root / Administrator).
    fn is_privileged(&self) -> bool;

    /// Whether kernel-level network/socket filtering is architecturally supported.
    fn network_filtering_supported(&self) -> bool;

    /// Status of the platform's kernel network interception driver or subsystem.
    fn network_filtering_status(&self) -> &'static str;
}

/// Factory that constructs the native interceptor matching the current compile target OS.
pub fn create_platform_interceptor() -> Box<dyn PlatformInterceptor> {
    #[cfg(target_os = "windows")]
    {
        Box::new(WindowsInterceptor::new())
    }
    #[cfg(target_os = "macos")]
    {
        Box::new(MacOsInterceptor::new())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Box::new(LinuxInterceptor::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_interceptor_instantiation() {
        let interceptor = create_platform_interceptor();
        assert!(!interceptor.os_name().is_empty());
        assert!(!interceptor.network_filtering_status().is_empty());

        let win = WindowsInterceptor::new();
        assert_eq!(win.os_name(), "Windows");
        assert!(win.network_filtering_supported());
        assert!(win.network_filtering_status().contains("WFP"));

        let mac = MacOsInterceptor::new();
        assert_eq!(mac.os_name(), "macOS");
        assert!(mac.network_filtering_supported());
        assert!(mac.network_filtering_status().contains("EndpointSecurity"));

        let lin = LinuxInterceptor::new();
        assert_eq!(lin.os_name(), "Linux");
        assert!(lin.network_filtering_supported());
        assert!(lin.network_filtering_status().contains("eBPF"));
    }
}
