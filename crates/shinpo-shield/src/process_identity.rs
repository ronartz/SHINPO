use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessIdentity {
    pub pid: u32,
    pub process_name: String,
    pub process_start_ticks: u64,
    pub executable_path: PathBuf,
    pub executable_device: u64,
    pub executable_inode: u64,
    pub executable_size: u64,
    pub owner_id: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseResult {
    ConsentRequired,
    RequestedAndExited,
    RequestedButNotConfirmed,
}

pub fn protected_process_name(name: &str) -> bool {
    matches!(
        name.trim()
            .trim_end_matches(".exe")
            .to_ascii_lowercase()
            .as_str(),
        "systemd"
            | "init"
            | "kernel"
            | "kthreadd"
            | "dbus-daemon"
            | "dbus-broker"
            | "dbus-broker-launch"
            | "systemd-journald"
            | "systemd-udevd"
            | "systemd-logind"
            | "xorg"
            | "xwayland"
            | "wayland"
            | "sway"
            | "mutter"
            | "kwin"
            | "kwin_wayland"
            | "plasma"
            | "plasmashell"
            | "gnome-shell"
            | "pipewire"
            | "wireplumber"
            | "pulseaudio"
            | "sshd"
            | "login"
            | "system"
            | "smss"
            | "csrss"
            | "wininit"
            | "services"
            | "lsass"
            | "svchost"
            | "winlogon"
            | "dwm"
            | "explorer"
            | "fontdrvhost"
            | "audiodg"
            | "conhost"
            | "runtimebroker"
            | "taskhostw"
            | "shinpo"
            | "shinpo-shield"
            | "shinpo-desktop"
            | "postgres"
            | "postgresql"
    )
}

#[cfg(target_os = "linux")]
pub fn inspect_distraction(
    pid: u32,
    process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    inspect_process_internal(pid, process_name, false)
}

#[cfg(target_os = "linux")]
pub fn inspect_target_process(
    pid: u32,
    process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    inspect_process_internal(pid, process_name, true)
}

#[cfg(target_os = "linux")]
fn inspect_process_internal(
    pid: u32,
    process_name: &str,
    allow_custom: bool,
) -> Result<Option<ProcessIdentity>, String> {
    use std::{fs, os::unix::fs::MetadataExt};

    if pid == std::process::id() || protected_process_name(process_name) {
        return Ok(None);
    }
    if !allow_custom && !shinpo_catalog_match(process_name) {
        return Ok(None);
    }
    let proc_root = PathBuf::from(format!("/proc/{pid}"));
    let executable_path = fs::canonicalize(proc_root.join("exe"))
        .map_err(|_| "Process executable identity is unavailable".to_string())?;
    if !executable_path.is_absolute() {
        return Err("Process executable path is not absolute".into());
    }
    let executable_name = executable_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let reported_name = process_name
        .trim()
        .to_ascii_lowercase()
        .trim_end_matches(".exe")
        .to_string();
    if executable_name != reported_name {
        return Ok(None);
    }
    let metadata = fs::metadata(proc_root.join("exe"))
        .map_err(|_| "Process executable metadata is unavailable".to_string())?;
    if !metadata.is_file() {
        return Err("Process executable is not a regular file".into());
    }
    let owner_id = read_real_uid(&proc_root.join("status"))?;
    // Guardian never crosses the current user's privilege boundary.
    // SAFETY: geteuid reads the effective UID of the current process and has no pointer arguments.
    if owner_id != unsafe { libc::geteuid() } {
        return Ok(None);
    }
    let process_start_ticks = read_start_ticks(&proc_root.join("stat"))?;
    Ok(Some(ProcessIdentity {
        pid,
        process_name: process_name.to_ascii_lowercase(),
        process_start_ticks,
        executable_path,
        executable_device: metadata.dev(),
        executable_inode: metadata.ino(),
        executable_size: metadata.len(),
        owner_id,
    }))
}

#[cfg(not(target_os = "linux"))]
pub fn inspect_distraction(
    _pid: u32,
    _process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    Err("Verified process identity is unavailable on this platform".into())
}

#[cfg(not(target_os = "linux"))]
pub fn inspect_target_process(
    _pid: u32,
    _process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    Err("Verified process identity is unavailable on this platform".into())
}

#[cfg(target_os = "linux")]
pub fn request_graceful_close(
    expected: &ProcessIdentity,
    closure_consent: bool,
) -> Result<CloseResult, String> {
    use std::{
        os::fd::{AsRawFd, FromRawFd, OwnedFd},
        time::Duration,
    };

    if !closure_consent {
        return Ok(CloseResult::ConsentRequired);
    }
    if expected.pid == std::process::id() || protected_process_name(&expected.process_name) {
        return Err("Protected or unrecognized processes cannot be closed".into());
    }
    // pidfd binds the operation to this process instance; never fall back to kill(PID).
    // SAFETY: pidfd_open takes a PID and flags; expected.pid is a u32 and flags are zero.
    let raw_pidfd = unsafe { libc::syscall(libc::SYS_pidfd_open, expected.pid, 0) } as i32;
    if raw_pidfd < 0 {
        return Err(
            "Safe process handles are unsupported or unavailable on this Linux kernel".into(),
        );
    }
    // SAFETY: successful pidfd_open returned a new owned descriptor not managed elsewhere.
    let pidfd = unsafe { OwnedFd::from_raw_fd(raw_pidfd) };
    if !identity_still_matches(expected)? {
        return Err("Process identity changed before intervention; no signal was sent".into());
    }
    // SAFETY: pidfd is live, the signal is SIGTERM, and the optional siginfo pointer is null.
    let signal_result = unsafe {
        libc::syscall(
            libc::SYS_pidfd_send_signal,
            pidfd.as_raw_fd(),
            libc::SIGTERM,
            std::ptr::null::<libc::siginfo_t>(),
            0,
        )
    };
    if signal_result != 0 {
        return Err("The operating system refused the graceful-close request".into());
    }
    let mut descriptor = libc::pollfd {
        fd: pidfd.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    let timeout = Duration::from_secs(2).as_millis() as i32;
    // SAFETY: descriptor points to one initialized pollfd for the duration of the call.
    let ready = unsafe { libc::poll(&mut descriptor, 1, timeout) };
    if ready > 0 && descriptor.revents & libc::POLLIN != 0 {
        Ok(CloseResult::RequestedAndExited)
    } else {
        Ok(CloseResult::RequestedButNotConfirmed)
    }
}

#[cfg(not(target_os = "linux"))]
pub fn request_graceful_close(
    _expected: &ProcessIdentity,
    _closure_consent: bool,
) -> Result<CloseResult, String> {
    Err("Safe graceful-close intervention is unavailable on this platform".into())
}

#[cfg(target_os = "linux")]
fn identity_still_matches(expected: &ProcessIdentity) -> Result<bool, String> {
    use std::{fs, os::unix::fs::MetadataExt};
    let current = inspect_target_process(expected.pid, &expected.process_name)?;
    let Some(current) = current else {
        return Ok(false);
    };
    let metadata = fs::metadata(format!("/proc/{}/exe", expected.pid))
        .map_err(|_| "Process executable identity disappeared".to_string())?;
    Ok(current.process_start_ticks == expected.process_start_ticks
        && current.owner_id == expected.owner_id
        && current.executable_path == expected.executable_path
        && current.executable_device == expected.executable_device
        && current.executable_inode == expected.executable_inode
        && current.executable_size == expected.executable_size
        && metadata.dev() == expected.executable_device
        && metadata.ino() == expected.executable_inode)
}

#[cfg(target_os = "linux")]
fn read_real_uid(path: &std::path::Path) -> Result<u32, String> {
    let status =
        std::fs::read_to_string(path).map_err(|_| "Could not verify process owner".to_string())?;
    let uid_line = status
        .lines()
        .find(|line| line.starts_with("Uid:"))
        .ok_or_else(|| "Process owner information is missing".to_string())?;
    uid_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Process owner information is malformed".to_string())?
        .parse()
        .map_err(|_| "Process owner information is malformed".to_string())
}

#[cfg(target_os = "linux")]
fn read_start_ticks(path: &std::path::Path) -> Result<u64, String> {
    let stat = std::fs::read_to_string(path)
        .map_err(|_| "Could not verify process start time".to_string())?;
    let end_name = stat
        .rfind(')')
        .ok_or_else(|| "Process start time record is malformed".to_string())?;
    stat[end_name + 1..]
        .split_whitespace()
        .nth(19)
        .ok_or_else(|| "Process start time is missing".to_string())?
        .parse()
        .map_err(|_| "Process start time is malformed".to_string())
}

fn shinpo_catalog_match(process_name: &str) -> bool {
    crate::observer::is_known_distraction(process_name)
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::{
        fs,
        process::{Child, Command, Stdio},
        thread,
        time::Duration,
    };

    struct FixtureProcess {
        child: Child,
        directory: PathBuf,
    }

    impl FixtureProcess {
        fn start(process_name: &str) -> Option<Self> {
            let source = ["/usr/bin/sleep", "/bin/sleep"]
                .iter()
                .map(PathBuf::from)
                .find(|path| path.exists())?;
            let directory = std::env::temp_dir().join(format!(
                "shinpo-guardian-fixture-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()?
                    .as_nanos()
            ));
            fs::create_dir_all(&directory).ok()?;
            let target = directory.join(process_name);
            fs::copy(source, &target).ok()?;
            let child = Command::new(&target)
                .arg("30")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .ok()?;
            thread::sleep(Duration::from_millis(100));
            Some(Self { child, directory })
        }
    }

    impl Drop for FixtureProcess {
        fn drop(&mut self) {
            if let Some(status) = self.child.try_wait().ok().flatten() {
                let _ = status;
            } else {
                if let Ok(Some(identity)) = inspect_distraction(self.child.id(), "discord") {
                    let _ = request_graceful_close(&identity, true);
                }
                let _ = self.child.wait();
            }
            let _ = fs::remove_dir_all(&self.directory);
        }
    }

    #[test]
    fn disposable_catalog_process_requires_consent_and_pidfd_confirms_graceful_exit() {
        let Some(mut process) = FixtureProcess::start("discord") else {
            return;
        };
        let identity = inspect_distraction(process.child.id(), "discord")
            .unwrap()
            .unwrap();
        assert!(identity.executable_path.ends_with("discord"));
        assert_eq!(identity.owner_id, unsafe { libc::geteuid() });
        assert_eq!(
            request_graceful_close(&identity, false).unwrap(),
            CloseResult::ConsentRequired
        );
        assert!(process.child.try_wait().unwrap().is_none());
        assert_eq!(
            request_graceful_close(&identity, true).unwrap(),
            CloseResult::RequestedAndExited
        );
        assert!(!process.child.wait().unwrap().success());
    }

    #[test]
    fn catalog_process_name_cannot_authorize_a_differently_named_executable() {
        let Some(process) = FixtureProcess::start("discord") else {
            return;
        };
        assert!(inspect_distraction(process.child.id(), "steam")
            .unwrap()
            .is_none());
    }

    #[test]
    fn custom_target_process_requires_consent_and_pidfd_confirms_graceful_exit() {
        let Some(mut process) = FixtureProcess::start("shinpo-custom-target-app") else {
            return;
        };
        // Catalog inspection ignores non-catalog names
        assert!(
            inspect_distraction(process.child.id(), "shinpo-custom-target-app")
                .unwrap()
                .is_none()
        );
        // Target inspection recognizes and verifies user-configured target names
        let identity = inspect_target_process(process.child.id(), "shinpo-custom-target-app")
            .unwrap()
            .unwrap();
        assert!(identity
            .executable_path
            .ends_with("shinpo-custom-target-app"));
        assert_eq!(identity.owner_id, unsafe { libc::geteuid() });
        assert_eq!(
            request_graceful_close(&identity, false).unwrap(),
            CloseResult::ConsentRequired
        );
        assert!(process.child.try_wait().unwrap().is_none());
        assert_eq!(
            request_graceful_close(&identity, true).unwrap(),
            CloseResult::RequestedAndExited
        );
        assert!(!process.child.wait().unwrap().success());
    }

    #[test]
    fn unknown_and_protected_processes_are_never_eligible() {
        assert!(inspect_distraction(std::process::id(), "discord")
            .unwrap()
            .is_none());
        assert!(inspect_distraction(std::process::id(), "systemd")
            .unwrap()
            .is_none());
        assert!(inspect_distraction(1, "unknown-process").unwrap().is_none());
        assert!(protected_process_name("systemd"));
        assert!(!protected_process_name("discord"));
    }
}
