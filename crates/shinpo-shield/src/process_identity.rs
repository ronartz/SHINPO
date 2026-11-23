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
    ExitedAfterCloseRequest,
    ExitedAfterForcedTermination,
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
    let executable_path = fs::read_link(proc_root.join("exe"))
        .or_else(|_| fs::canonicalize(proc_root.join("exe")))
        .map_err(|_| "Process executable identity is unavailable".to_string())?;
    if !executable_path.is_absolute() {
        return Err("Process executable path is not absolute".into());
    }
    let reported_name = process_name
        .trim()
        .to_ascii_lowercase()
        .trim_end_matches(".exe")
        .to_string();
    // sysinfo reports Linux's process command name (comm), which can legitimately
    // differ from the executable basename (for example python3 vs python3.13).
    // Match that observed command exactly, while independently binding identity to
    // the absolute executable path and file metadata below.
    let observed_name = fs::read_to_string(proc_root.join("comm"))
        .map_err(|_| "Process command identity is unavailable".to_string())?
        .trim()
        .to_ascii_lowercase();
    let executable_name = executable_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let name_matches = observed_name.trim_end_matches(".exe") == reported_name
        || executable_name.trim_end_matches(".exe") == reported_name;
    if !name_matches {
        return Ok(None);
    }
    let metadata = fs::metadata(proc_root.join("exe"))
        .or_else(|_| {
            let rel = executable_path
                .strip_prefix("/")
                .unwrap_or(&executable_path);
            fs::metadata(proc_root.join("root").join(rel))
        })
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

#[cfg(target_os = "windows")]
pub fn inspect_target_process(
    pid: u32,
    process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    windows_process::inspect(pid, process_name, true)
}

#[cfg(target_os = "windows")]
pub fn inspect_distraction(
    pid: u32,
    process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    if !shinpo_catalog_match(process_name) {
        return Ok(None);
    }
    inspect_target_process(pid, process_name)
}

#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
pub fn inspect_distraction(
    _pid: u32,
    _process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    Err("Verified process identity is unavailable on this platform".into())
}

#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
pub fn inspect_target_process(
    _pid: u32,
    _process_name: &str,
) -> Result<Option<ProcessIdentity>, String> {
    Err("Verified process identity is unavailable on this platform".into())
}

#[cfg(target_os = "linux")]
pub fn request_process_close(
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
    // A pidfd binds every signal to this process instance. If pidfd support is
    // unavailable, fail closed instead of falling back to a reusable raw PID.
    // SAFETY: pidfd_open takes a PID and flags; expected.pid is a u32 and flags are zero.
    let raw_pidfd = unsafe { libc::syscall(libc::SYS_pidfd_open, expected.pid, 0) } as i32;
    if raw_pidfd < 0 {
        return Err(format!(
            "Could not bind intervention to a process handle: {}",
            std::io::Error::last_os_error()
        ));
    }
    // SAFETY: successful pidfd_open returned a new owned descriptor not managed elsewhere.
    let pidfd = unsafe { OwnedFd::from_raw_fd(raw_pidfd) };
    match identity_still_matches(expected) {
        Ok(true) => {}
        Ok(false) => {
            return Err("Process identity changed before intervention; no signal was sent".into())
        }
        Err(error) => {
            return Err(format!(
                "Process identity could not be revalidated; no signal was sent: {error}"
            ))
        }
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
        return Err(format!(
            "Could not request process close through its verified handle: {}",
            std::io::Error::last_os_error()
        ));
    }

    let mut descriptor = libc::pollfd {
        fd: pidfd.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    // SAFETY: descriptor points to one initialized pollfd for the duration of the call.
    let ready = unsafe {
        libc::poll(
            &mut descriptor,
            1,
            Duration::from_millis(40).as_millis() as i32,
        )
    };
    if ready > 0 && descriptor.revents & libc::POLLIN != 0 {
        return Ok(CloseResult::ExitedAfterCloseRequest);
    }

    // Closure consent authorizes escalation for this verified target. Confirm exit
    // through the same pidfd before reporting success.
    // SAFETY: pidfd remains owned and live; SIGKILL is directed to the bound process only.
    let kill_result = unsafe {
        libc::syscall(
            libc::SYS_pidfd_send_signal,
            pidfd.as_raw_fd(),
            libc::SIGKILL,
            std::ptr::null::<libc::siginfo_t>(),
            0,
        )
    };
    if kill_result != 0 {
        return Err(format!(
            "Could not complete the consented process intervention: {}",
            std::io::Error::last_os_error()
        ));
    }
    descriptor.revents = 0;
    // SAFETY: descriptor still points to the initialized pollfd and pidfd is live.
    let exited = unsafe { libc::poll(&mut descriptor, 1, 1_000) };
    if exited > 0 && descriptor.revents & libc::POLLIN != 0 {
        Ok(CloseResult::ExitedAfterForcedTermination)
    } else {
        Ok(CloseResult::RequestedButNotConfirmed)
    }
}

#[cfg(target_os = "windows")]
pub fn request_process_close(
    expected: &ProcessIdentity,
    closure_consent: bool,
) -> Result<CloseResult, String> {
    windows_process::request_close(expected, closure_consent)
}

#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
pub fn request_process_close(
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
        .or_else(|_| {
            let rel = expected
                .executable_path
                .strip_prefix("/")
                .unwrap_or(&expected.executable_path);
            fs::metadata(format!("/proc/{}/root/{}", expected.pid, rel.display()))
        })
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

#[cfg(target_os = "windows")]
mod windows_process {
    use super::{CloseResult, ProcessIdentity};
    use std::{
        ffi::OsString,
        mem::MaybeUninit,
        os::windows::ffi::OsStringExt,
        path::PathBuf,
        ptr::{null, null_mut},
        slice,
        time::Duration,
    };
    use windows_sys::Win32::{
        Foundation::{
            CloseHandle, FILETIME, HANDLE, INVALID_HANDLE_VALUE, WAIT_FAILED, WAIT_OBJECT_0,
            WAIT_TIMEOUT,
        },
        Security::{
            EqualSid, GetLengthSid, GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER,
        },
        Storage::FileSystem::{
            CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
            FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL, FILE_READ_ATTRIBUTES,
            FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
        },
        System::Threading::{
            GetCurrentProcess, GetProcessTimes, OpenProcess, OpenProcessToken,
            QueryFullProcessImageNameW, TerminateProcess, WaitForSingleObject,
            PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, SYNCHRONIZATION_SYNCHRONIZE,
        },
        UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, PostMessageW, WM_CLOSE},
    };

    struct OwnedHandle(HANDLE);

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            // SAFETY: this wrapper only owns valid handles returned by Win32 open/create calls.
            unsafe { CloseHandle(self.0) };
        }
    }

    fn last_error(context: &str) -> String {
        format!("{context}: {}", std::io::Error::last_os_error())
    }

    fn open_process(pid: u32, access: u32) -> Result<OwnedHandle, String> {
        // SAFETY: OpenProcess receives a PID and access mask; no pointers are passed.
        let handle = unsafe { OpenProcess(access, 0, pid) };
        if handle == 0 {
            Err(last_error("Could not open the target process"))
        } else {
            Ok(OwnedHandle(handle))
        }
    }

    fn filetime_value(value: FILETIME) -> u64 {
        (u64::from(value.dwHighDateTime) << 32) | u64::from(value.dwLowDateTime)
    }

    fn process_start_time(handle: HANDLE) -> Result<u64, String> {
        let mut creation = MaybeUninit::<FILETIME>::zeroed();
        let mut exit = MaybeUninit::<FILETIME>::zeroed();
        let mut kernel = MaybeUninit::<FILETIME>::zeroed();
        let mut user = MaybeUninit::<FILETIME>::zeroed();
        // SAFETY: all output pointers refer to initialized storage for FILETIME values.
        if unsafe {
            GetProcessTimes(
                handle,
                creation.as_mut_ptr(),
                exit.as_mut_ptr(),
                kernel.as_mut_ptr(),
                user.as_mut_ptr(),
            )
        } == 0
        {
            return Err(last_error("Could not verify process start time"));
        }
        // SAFETY: GetProcessTimes returned success and initialized all four outputs.
        Ok(filetime_value(unsafe { creation.assume_init() }))
    }

    fn process_path(handle: HANDLE) -> Result<PathBuf, String> {
        let mut buffer = vec![0u16; 32_768];
        let mut length = buffer.len() as u32;
        // SAFETY: buffer is writable and length is its capacity in UTF-16 code units.
        if unsafe { QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut length) } == 0 {
            return Err(last_error("Could not verify process executable path"));
        }
        buffer.truncate(length as usize);
        let path = PathBuf::from(OsString::from_wide(&buffer));
        if !path.is_absolute() {
            return Err("Process executable path is not absolute".into());
        }
        Ok(path)
    }

    fn token_user_buffer(token: HANDLE) -> Result<Vec<usize>, String> {
        let mut required = 0u32;
        // SAFETY: a null output with zero length is the documented size-query call.
        unsafe {
            GetTokenInformation(token, TokenUser, null_mut(), 0, &mut required);
        }
        if required == 0 {
            return Err(last_error("Could not query process account identity"));
        }
        let words = (required as usize).div_ceil(std::mem::size_of::<usize>());
        let mut storage = vec![0usize; words];
        // SAFETY: storage is suitably aligned and large enough for the reported TOKEN_USER data.
        if unsafe {
            GetTokenInformation(
                token,
                TokenUser,
                storage.as_mut_ptr().cast(),
                (storage.len() * std::mem::size_of::<usize>()) as u32,
                &mut required,
            )
        } == 0
        {
            return Err(last_error("Could not read process account identity"));
        }
        Ok(storage)
    }

    fn current_user_hash_and_match(process: HANDLE) -> Result<Option<u32>, String> {
        let mut process_token: HANDLE = 0;
        let mut current_token: HANDLE = 0;
        // SAFETY: output pointers are valid and both handles are process handles.
        if unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut process_token) } == 0 {
            return Err(last_error("Could not open target account identity"));
        }
        let process_token = OwnedHandle(process_token);
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle; output pointer is valid.
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut current_token) } == 0 {
            return Err(last_error("Could not open current account identity"));
        }
        let current_token = OwnedHandle(current_token);
        let process_user = token_user_buffer(process_token.0)?;
        let current_user = token_user_buffer(current_token.0)?;
        // SAFETY: GetTokenInformation filled each aligned buffer with a TOKEN_USER structure.
        let process_sid = unsafe { (*(process_user.as_ptr().cast::<TOKEN_USER>())).User.Sid };
        // SAFETY: same as above for the current account token.
        let current_sid = unsafe { (*(current_user.as_ptr().cast::<TOKEN_USER>())).User.Sid };
        // SAFETY: both SID pointers are owned by live token buffers for the duration of this call.
        if unsafe { EqualSid(process_sid, current_sid) } == 0 {
            return Ok(None);
        }
        // SAFETY: process_sid points to a valid SID returned by GetTokenInformation.
        let sid_length = unsafe { GetLengthSid(process_sid) } as usize;
        if sid_length == 0 {
            return Err("Process account SID is invalid".into());
        }
        // SAFETY: GetLengthSid reports the readable byte length of this validated SID.
        let sid_bytes = unsafe { slice::from_raw_parts(process_sid.cast::<u8>(), sid_length) };
        let hash = sid_bytes.iter().fold(0x811c_9dc5u32, |hash, byte| {
            (hash ^ u32::from(*byte)).wrapping_mul(0x0100_0193)
        });
        Ok(Some(hash))
    }

    fn executable_file_identity(path: &PathBuf) -> Result<(u64, u64, u64), String> {
        use std::os::windows::ffi::OsStrExt;
        let mut wide = path.as_os_str().encode_wide().collect::<Vec<_>>();
        wide.push(0);
        // SAFETY: wide is NUL-terminated; no security descriptor or template handle is supplied.
        let file = unsafe {
            CreateFileW(
                wide.as_ptr(),
                FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                null(),
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                0,
            )
        };
        if file == 0 || file == INVALID_HANDLE_VALUE {
            return Err(last_error("Could not verify executable file identity"));
        }
        let file = OwnedHandle(file);
        let mut information = MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::zeroed();
        // SAFETY: information points to writable storage for the Win32 output structure.
        if unsafe { GetFileInformationByHandle(file.0, information.as_mut_ptr()) } == 0 {
            return Err(last_error("Could not read executable file identity"));
        }
        // SAFETY: GetFileInformationByHandle returned success and initialized the structure.
        let information = unsafe { information.assume_init() };
        if information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
            return Err("Process executable is not a regular file".into());
        }
        let file_id =
            (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
        let size =
            (u64::from(information.nFileSizeHigh) << 32) | u64::from(information.nFileSizeLow);
        Ok((u64::from(information.dwVolumeSerialNumber), file_id, size))
    }

    fn inspect_handle(
        pid: u32,
        process_name: &str,
        handle: HANDLE,
    ) -> Result<Option<ProcessIdentity>, String> {
        if pid == std::process::id() || super::protected_process_name(process_name) {
            return Ok(None);
        }
        let executable_path = process_path(handle)?;
        let executable_name = executable_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Process executable name is unavailable".to_string())?
            .to_ascii_lowercase();
        let reported_name = process_name
            .trim()
            .to_ascii_lowercase()
            .trim_end_matches(".exe")
            .to_string();
        let actual_name = executable_name.trim_end_matches(".exe");
        if actual_name != reported_name {
            return Ok(None);
        }
        let Some(owner_id) = current_user_hash_and_match(handle)? else {
            return Ok(None);
        };
        let (executable_device, executable_inode, executable_size) =
            executable_file_identity(&executable_path)?;
        Ok(Some(ProcessIdentity {
            pid,
            process_name: reported_name,
            process_start_ticks: process_start_time(handle)?,
            executable_path,
            executable_device,
            executable_inode,
            executable_size,
            owner_id,
        }))
    }

    pub(super) fn inspect(
        pid: u32,
        process_name: &str,
        allow_custom: bool,
    ) -> Result<Option<ProcessIdentity>, String> {
        if super::protected_process_name(process_name) {
            return Ok(None);
        }
        if !allow_custom && !super::shinpo_catalog_match(process_name) {
            return Ok(None);
        }
        let handle = open_process(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
        inspect_handle(pid, process_name, handle.0)
    }

    fn matches_expected(actual: &ProcessIdentity, expected: &ProcessIdentity) -> bool {
        actual.pid == expected.pid
            && actual.process_start_ticks == expected.process_start_ticks
            && actual.owner_id == expected.owner_id
            && actual.executable_path == expected.executable_path
            && actual.executable_device == expected.executable_device
            && actual.executable_inode == expected.executable_inode
            && actual.executable_size == expected.executable_size
            && actual
                .process_name
                .eq_ignore_ascii_case(&expected.process_name)
    }

    struct WindowTargets {
        pid: u32,
        handles: Vec<isize>,
    }

    unsafe extern "system" fn collect_top_level_windows(hwnd: isize, context: isize) -> i32 {
        // SAFETY: EnumWindows is called synchronously with a live pointer to WindowTargets.
        let targets = unsafe { &mut *(context as *mut WindowTargets) };
        let mut window_pid = 0u32;
        // SAFETY: hwnd is supplied by EnumWindows and the PID output pointer is valid.
        unsafe { GetWindowThreadProcessId(hwnd, &mut window_pid) };
        if window_pid == targets.pid {
            targets.handles.push(hwnd);
        }
        1
    }

    fn send_close_to_windows(pid: u32, process_handle: HANDLE) {
        let mut targets = WindowTargets {
            pid,
            handles: Vec::new(),
        };
        // SAFETY: callback and context remain valid for the synchronous EnumWindows call.
        unsafe {
            EnumWindows(
                Some(collect_top_level_windows),
                (&mut targets as *mut WindowTargets) as isize,
            )
        };
        for hwnd in targets.handles {
            // If the original process exited, do not send a message to a reused PID/window.
            // SAFETY: process_handle is an owned, still-open process handle.
            if unsafe { WaitForSingleObject(process_handle, 0) } != WAIT_TIMEOUT {
                return;
            }
            // SAFETY: hwnd came from EnumWindows and was matched to the target PID.
            unsafe { PostMessageW(hwnd, WM_CLOSE, 0, 0) };
        }
    }

    pub(super) fn request_close(
        expected: &ProcessIdentity,
        closure_consent: bool,
    ) -> Result<CloseResult, String> {
        if !closure_consent {
            return Ok(CloseResult::ConsentRequired);
        }
        if expected.pid == std::process::id()
            || super::protected_process_name(&expected.process_name)
        {
            return Err("Protected processes cannot be closed".into());
        }
        let access =
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE | SYNCHRONIZATION_SYNCHRONIZE;
        let process = open_process(expected.pid, access)?;
        let actual = inspect_handle(expected.pid, &expected.process_name, process.0)?;
        if !actual
            .as_ref()
            .is_some_and(|actual| matches_expected(actual, expected))
        {
            return Err(
                "Process identity changed before intervention; no close was requested".into(),
            );
        }

        send_close_to_windows(expected.pid, process.0);
        // Give the application a short opportunity to close its own windows and save state.
        // SAFETY: process is a live process handle opened with SYNCHRONIZE.
        match unsafe {
            WaitForSingleObject(process.0, Duration::from_millis(500).as_millis() as u32)
        } {
            WAIT_OBJECT_0 => return Ok(CloseResult::ExitedAfterCloseRequest),
            WAIT_TIMEOUT => {}
            WAIT_FAILED => return Err(last_error("Could not wait for the application to close")),
            _ => return Err("Windows returned an unexpected process wait result".into()),
        }

        // Re-read identity through the same process handle; this cannot bind to a reused PID.
        let actual = inspect_handle(expected.pid, &expected.process_name, process.0)?;
        if !actual
            .as_ref()
            .is_some_and(|actual| matches_expected(actual, expected))
        {
            return Err(
                "Process identity changed before termination; no force close was sent".into(),
            );
        }
        // Explicit closure consent authorizes terminating this one verified process handle.
        // No child processes or process tree are targeted.
        // SAFETY: process is the verified target handle and PROCESS_TERMINATE was requested.
        if unsafe { TerminateProcess(process.0, 1) } == 0 {
            return Err(last_error(
                "Could not terminate the verified target application",
            ));
        }
        // SAFETY: the same live process handle is synchronized until the target exits.
        match unsafe { WaitForSingleObject(process.0, 1_000) } {
            WAIT_OBJECT_0 => Ok(CloseResult::ExitedAfterForcedTermination),
            WAIT_TIMEOUT => Ok(CloseResult::RequestedButNotConfirmed),
            WAIT_FAILED => Err(last_error("Could not confirm application termination")),
            _ => Err("Windows returned an unexpected process wait result".into()),
        }
    }
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

        fn start_ignoring_sigterm() -> Option<Self> {
            let directory = std::env::temp_dir().join(format!(
                "shinpo-guardian-ignore-term-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()?
                    .as_nanos()
            ));
            fs::create_dir_all(&directory).ok()?;
            let child = Command::new("python3")
                .args([
                    "-c",
                    "import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(30)",
                ])
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
            if self.child.try_wait().ok().flatten().is_none() {
                // This is a disposable fixture owned by the test harness, never a user app.
                let _ = self.child.kill();
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
            request_process_close(&identity, false).unwrap(),
            CloseResult::ConsentRequired
        );
        assert!(process.child.try_wait().unwrap().is_none());
        assert_eq!(
            request_process_close(&identity, true).unwrap(),
            CloseResult::ExitedAfterCloseRequest
        );
        assert!(!process.child.wait().unwrap().success());
    }

    #[test]
    fn strict_close_escalates_to_terminate_a_process_that_ignores_sigterm() {
        let Some(mut process) = FixtureProcess::start_ignoring_sigterm() else {
            return;
        };
        let identity = inspect_target_process(process.child.id(), "python3")
            .unwrap()
            .unwrap();

        assert_eq!(
            request_process_close(&identity, true).unwrap(),
            CloseResult::ExitedAfterForcedTermination
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
    fn catalog_process_name_does_not_match_an_executable_prefix() {
        let Some(process) = FixtureProcess::start("discord-client") else {
            return;
        };
        assert!(inspect_distraction(process.child.id(), "discord")
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
            request_process_close(&identity, false).unwrap(),
            CloseResult::ConsentRequired
        );
        assert!(process.child.try_wait().unwrap().is_none());
        assert_eq!(
            request_process_close(&identity, true).unwrap(),
            CloseResult::ExitedAfterCloseRequest
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

#[cfg(all(test, target_os = "windows"))]
mod windows_tests {
    use super::{inspect_distraction, request_process_close, CloseResult};
    use std::{
        fs,
        process::{Child, Command, Stdio},
        thread,
        time::Duration,
    };

    struct ChildGuard(Child);

    impl Drop for ChildGuard {
        fn drop(&mut self) {
            if self.0.try_wait().ok().flatten().is_none() {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
    }

    #[test]
    fn disposable_fixture_child_waits_for_parent_intervention() {
        if std::env::var_os("SHINPO_WINDOWS_GUARDIAN_FIXTURE").is_some() {
            thread::sleep(Duration::from_secs(30));
        }
    }

    #[test]
    fn windows_close_is_consent_gated_and_confirms_only_the_disposable_process() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock is after epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "shinpo-windows-guardian-fixture-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("create isolated fixture directory");
        let executable = directory.join("discord.exe");
        fs::copy(
            std::env::current_exe().expect("test executable path"),
            &executable,
        )
        .expect("copy test executable as disposable catalog fixture");

        let mut child = ChildGuard(
            Command::new(&executable)
                .args([
                    "--exact",
                    "process_identity::windows_tests::disposable_fixture_child_waits_for_parent_intervention",
                    "--nocapture",
                ])
                .env("SHINPO_WINDOWS_GUARDIAN_FIXTURE", "1")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn isolated disposable fixture process"),
        );
        thread::sleep(Duration::from_millis(250));

        assert!(inspect_distraction(child.0.id(), "steam.exe")
            .expect("wrong catalog identity is rejected")
            .is_none());
        assert!(inspect_distraction(std::process::id(), "discord.exe")
            .expect("the SHINPO test runner is protected")
            .is_none());

        let identity = inspect_distraction(child.0.id(), "discord.exe")
            .expect("read fixture identity")
            .expect("same-user catalog fixture should be verified");
        assert_eq!(
            request_process_close(&identity, false).expect("missing consent is not an error"),
            CloseResult::ConsentRequired
        );
        assert!(child.0.try_wait().expect("check fixture").is_none());

        assert_eq!(
            request_process_close(&identity, true).expect("consented close completes"),
            CloseResult::ExitedAfterForcedTermination
        );
        assert!(child
            .0
            .wait()
            .expect("collect fixture exit")
            .code()
            .is_some());
        fs::remove_dir_all(directory).expect("remove disposable fixture directory");
    }

    #[test]
    fn windows_explicit_custom_block_can_close_only_its_verified_fixture() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock is after epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "shinpo-windows-custom-guardian-fixture-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("create isolated fixture directory");
        let executable = directory.join("owner-blocked-test-app.exe");
        fs::copy(
            std::env::current_exe().expect("test executable path"),
            &executable,
        )
        .expect("copy test executable as a custom fixture");
        let mut child = ChildGuard(
            Command::new(&executable)
                .args([
                    "--exact",
                    "process_identity::windows_tests::disposable_fixture_child_waits_for_parent_intervention",
                    "--nocapture",
                ])
                .env("SHINPO_WINDOWS_GUARDIAN_FIXTURE", "1")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn custom disposable fixture process"),
        );
        thread::sleep(Duration::from_millis(250));
        let identity = super::inspect_target_process(child.0.id(), "owner-blocked-test-app.exe")
            .expect("inspect custom explicit target")
            .expect("same-user custom target identity is verified");
        assert!(!super::shinpo_catalog_match(&identity.process_name));
        assert_eq!(
            request_process_close(&identity, true).expect("explicit custom target can be closed"),
            CloseResult::ExitedAfterForcedTermination
        );
        assert!(child
            .0
            .wait()
            .expect("collect child status")
            .code()
            .is_some());
        fs::remove_dir_all(directory).expect("remove disposable fixture directory");
    }
}
