use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::{ProcessesToUpdate, System};

use crate::process_identity::protected_process_name;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredApp {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub source: String,
    pub icon: Option<String>,
    pub exec_name: Option<String>,
    pub is_running: bool,
    pub policy: String,                 // "BLOCKED" | "ALLOWED" | "NONE"
    pub enforcement_capability: String, // "TERMINATE" | "MONITOR_ONLY" | "UNSUPPORTED"
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RawDesktopEntry {
    pub id: String,
    pub name: String,
    pub exec: Option<String>,
    pub icon: Option<String>,
    pub wm_class: Option<String>,
    pub source: String,
    pub no_display: bool,
    pub hidden: bool,
    pub is_application: bool,
}

pub fn parse_desktop_entry_content(
    id: &str,
    content: &str,
    source: &str,
) -> Option<RawDesktopEntry> {
    let mut in_desktop_entry = false;
    let mut name = None;
    let mut exec = None;
    let mut icon = None;
    let mut wm_class = None;
    let mut no_display = false;
    let mut hidden = false;
    let mut is_application = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_desktop_entry = trimmed == "[Desktop Entry]";
            continue;
        }
        if !in_desktop_entry || !trimmed.contains('=') {
            continue;
        }

        let mut parts = trimmed.splitn(2, '=');
        let key = parts.next()?.trim();
        let val = parts.next()?.trim();

        match key {
            "Name" if name.is_none() => {
                name = Some(val.to_string());
            }
            "Exec" if exec.is_none() => {
                exec = Some(val.to_string());
            }
            "Icon" if icon.is_none() => {
                icon = Some(val.to_string());
            }
            "StartupWMClass" if wm_class.is_none() => {
                wm_class = Some(val.to_string());
            }
            "Type" => {
                if val.eq_ignore_ascii_case("Application") {
                    is_application = true;
                }
            }
            "NoDisplay" => {
                no_display = val.eq_ignore_ascii_case("true");
            }
            "Hidden" => {
                hidden = val.eq_ignore_ascii_case("true");
            }
            _ => {}
        }
    }

    let name = name?;
    if !is_application || no_display || hidden {
        return None;
    }

    Some(RawDesktopEntry {
        id: id.to_string(),
        name,
        exec,
        icon,
        wm_class,
        source: source.to_string(),
        no_display,
        hidden,
        is_application,
    })
}

pub fn extract_exec_binary(exec_str: &str, wm_class: Option<&str>) -> Option<String> {
    let trimmed = exec_str.trim();
    if trimmed.is_empty() {
        return wm_class.map(|s| s.trim().to_ascii_lowercase());
    }

    // Flatpak launcher handling: e.g. /usr/bin/flatpak run --command=com.discordapp.Discord ...
    if trimmed.contains("flatpak") {
        if let Some(pos) = trimmed.find("--command=") {
            let rest = &trimmed[pos + 10..];
            let cmd = rest.split_whitespace().next().unwrap_or_default();
            if !cmd.is_empty() {
                if let Some(wm) = wm_class {
                    if !wm.trim().is_empty() {
                        return Some(wm.trim().to_ascii_lowercase());
                    }
                }
                let clean = cmd.split('.').next_back().unwrap_or(cmd);
                return Some(clean.trim().to_ascii_lowercase());
            }
        }
        if let Some(wm) = wm_class {
            if !wm.trim().is_empty() {
                return Some(wm.trim().to_ascii_lowercase());
            }
        }
    }

    // Standard Exec: get first command token, stripping quotes and flags
    let mut tokens = trimmed.split_whitespace();
    let first = tokens.next()?;
    let unquoted = first.trim_matches('\"').trim_matches('\'');
    let path = Path::new(unquoted);
    let binary = path.file_name()?.to_str()?.to_ascii_lowercase();

    if binary.is_empty() {
        wm_class.map(|s| s.trim().to_ascii_lowercase())
    } else {
        Some(binary)
    }
}

#[cfg(target_os = "linux")]
pub fn get_linux_application_dirs() -> Vec<(PathBuf, &'static str)> {
    let mut dirs = Vec::new();

    // 1. User local applications (~/.local/share/applications)
    if let Ok(home) = std::env::var("HOME") {
        let user_apps = PathBuf::from(&home).join(".local/share/applications");
        if user_apps.is_dir() {
            dirs.push((user_apps, "user"));
        }
        let user_flatpak =
            PathBuf::from(&home).join(".local/share/flatpak/exports/share/applications");
        if user_flatpak.is_dir() {
            dirs.push((user_flatpak, "flatpak"));
        }
    }

    // 2. Local system applications (/usr/local/share/applications)
    let local_share = PathBuf::from("/usr/local/share/applications");
    if local_share.is_dir() {
        dirs.push((local_share, "local"));
    }

    // 3. System applications (/usr/share/applications)
    let sys_share = PathBuf::from("/usr/share/applications");
    if sys_share.is_dir() {
        dirs.push((sys_share, "system"));
    }

    // 4. System flatpak applications (/var/lib/flatpak/exports/share/applications)
    let sys_flatpak = PathBuf::from("/var/lib/flatpak/exports/share/applications");
    if sys_flatpak.is_dir() {
        dirs.push((sys_flatpak, "flatpak"));
    }

    // 5. Snap applications (/var/lib/snapd/desktop/applications)
    let snap_share = PathBuf::from("/var/lib/snapd/desktop/applications");
    if snap_share.is_dir() {
        dirs.push((snap_share, "snap"));
    }

    dirs
}

#[cfg(target_os = "linux")]
pub fn scan_linux_desktop_entries() -> Vec<RawDesktopEntry> {
    let mut discovered: HashMap<String, RawDesktopEntry> = HashMap::new();
    let dirs = get_linux_application_dirs();

    for (dir, source) in dirs {
        scan_directory_entries(&dir, source, &mut discovered);
    }

    let mut result: Vec<RawDesktopEntry> = discovered.into_values().collect();
    result.sort_by_key(|entry| entry.name.to_lowercase());
    result
}

fn scan_directory_entries(
    dir: &Path,
    source: &str,
    discovered: &mut HashMap<String, RawDesktopEntry>,
) {
    let read_dir = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Recurse into subdirectories
            scan_directory_entries(&path, source, discovered);
            continue;
        }

        if path.extension().and_then(|ext| ext.to_str()) != Some("desktop") {
            continue;
        }

        let file_name = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // If a higher-priority directory already registered this desktop ID, skip lower-priority duplicate
        if discovered.contains_key(&file_name) {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if let Some(entry) = parse_desktop_entry_content(&file_name, &content, source) {
            discovered.insert(file_name, entry);
        }
    }
}

#[cfg(target_os = "windows")]
pub fn scan_windows_start_menu_entries() -> Vec<RawDesktopEntry> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    let mut paths_to_scan = Vec::new();
    if let Ok(program_data) = std::env::var("ProgramData") {
        paths_to_scan.push((
            PathBuf::from(program_data).join("Microsoft\\Windows\\Start Menu\\Programs"),
            "system",
        ));
    }
    if let Ok(app_data) = std::env::var("APPDATA") {
        paths_to_scan.push((
            PathBuf::from(app_data).join("Microsoft\\Windows\\Start Menu\\Programs"),
            "user",
        ));
    }

    for (dir, source) in paths_to_scan {
        if !dir.is_dir() {
            continue;
        }
        scan_windows_directory(&dir, source, &mut seen, &mut entries);
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries
}

#[cfg(target_os = "windows")]
fn scan_windows_directory(
    dir: &Path,
    source: &str,
    seen: &mut HashSet<String>,
    entries: &mut Vec<RawDesktopEntry>,
) {
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_windows_directory(&path, source, seen, entries);
            continue;
        }

        let is_lnk = path
            .extension()
            .and_then(|e| e.to_str())
            .map_or(false, |ext| ext.eq_ignore_ascii_case("lnk"));
        if !is_lnk {
            continue;
        }

        let stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) if !s.is_empty() => s.to_string(),
            _ => continue,
        };

        if seen.contains(&stem) {
            continue;
        }
        seen.insert(stem.clone());

        let exec_name = stem.to_ascii_lowercase().replace(' ', "");

        entries.push(RawDesktopEntry {
            id: format!("{stem}.lnk"),
            name: stem,
            exec: Some(exec_name.clone()),
            icon: None,
            wm_class: None,
            source: source.to_string(),
            no_display: false,
            hidden: false,
            is_application: true,
        });
    }
}

pub fn get_running_process_names() -> HashSet<String> {
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    let own_pid = std::process::id();

    let mut running = HashSet::new();
    for (pid, process) in system.processes() {
        if pid.as_u32() == own_pid {
            continue;
        }
        let name = process.name().to_string_lossy().to_ascii_lowercase();
        let stripped = name.strip_suffix(".exe").unwrap_or(&name).to_string();
        running.insert(stripped);
        running.insert(name);
    }
    running
}

pub fn determine_enforcement_capability(
    exec_name: Option<&str>,
    is_protected: bool,
    platform: &str,
) -> (String, Option<String>) {
    let clean_name = exec_name.map(str::trim).filter(|s| !s.is_empty());
    if is_protected {
        (
            "UNSUPPORTED".to_string(),
            Some("Protected system application".to_string()),
        )
    } else if clean_name.is_none() {
        (
            "UNSUPPORTED".to_string(),
            Some("Executable target unresolved".to_string()),
        )
    } else if platform == "linux" {
        ("TERMINATE".to_string(), None)
    } else {
        (
            "MONITOR_ONLY".to_string(),
            Some(format!(
                "Verified process identity and safe graceful close are unavailable on {platform}; monitoring only"
            )),
        )
    }
}

pub fn discover_installed_apps() -> Vec<DiscoveredApp> {
    #[cfg(target_os = "linux")]
    let raw_entries = scan_linux_desktop_entries();

    #[cfg(target_os = "windows")]
    let raw_entries = scan_windows_start_menu_entries();

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    let raw_entries: Vec<RawDesktopEntry> = Vec::new();

    let running_processes = get_running_process_names();
    let platform_name = if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "unknown"
    };

    let mut apps = Vec::with_capacity(raw_entries.len());

    for entry in raw_entries {
        let exec_name = entry
            .exec
            .as_deref()
            .and_then(|ex| extract_exec_binary(ex, entry.wm_class.as_deref()))
            .or_else(|| entry.wm_class.as_ref().map(|wm| wm.to_ascii_lowercase()));

        let is_running = if let Some(ref ename) = exec_name {
            running_processes.contains(ename)
                || entry
                    .wm_class
                    .as_ref()
                    .is_some_and(|wm| running_processes.contains(&wm.to_ascii_lowercase()))
        } else {
            false
        };

        let is_protected = exec_name
            .as_ref()
            .is_some_and(|ename| protected_process_name(ename));

        let (enforcement_capability, unsupported_reason) =
            determine_enforcement_capability(exec_name.as_deref(), is_protected, platform_name);

        apps.push(DiscoveredApp {
            id: entry.id,
            name: entry.name,
            platform: platform_name.to_string(),
            source: entry.source,
            icon: entry.icon,
            exec_name,
            is_running,
            policy: "NONE".to_string(),
            enforcement_capability,
            unsupported_reason,
        });
    }

    apps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_desktop_entry() {
        let content = r#"
[Desktop Entry]
Name=Visual Studio Code
Exec=/usr/share/code/code %F
Icon=vscode
Type=Application
StartupWMClass=com.microsoft.VSCode
"#;
        let entry = parse_desktop_entry_content("code.desktop", content, "system").unwrap();
        assert_eq!(entry.id, "code.desktop");
        assert_eq!(entry.name, "Visual Studio Code");
        assert_eq!(entry.icon.as_deref(), Some("vscode"));
        assert_eq!(entry.wm_class.as_deref(), Some("com.microsoft.VSCode"));
        let exec = extract_exec_binary(entry.exec.as_deref().unwrap(), entry.wm_class.as_deref());
        assert_eq!(exec, Some("code".to_string()));
    }

    #[test]
    fn test_parse_hidden_or_nodisplay_is_skipped() {
        let content_nodisplay = r#"
[Desktop Entry]
Name=Hidden Utility
Exec=utility
Type=Application
NoDisplay=true
"#;
        assert!(
            parse_desktop_entry_content("hidden.desktop", content_nodisplay, "system").is_none()
        );

        let content_non_app = r#"
[Desktop Entry]
Name=Folder Link
Type=Link
URL=https://example.com
"#;
        assert!(parse_desktop_entry_content("link.desktop", content_non_app, "system").is_none());
    }

    #[test]
    fn test_extract_exec_binary_flatpak() {
        let exec = "/usr/bin/flatpak run --branch=stable --arch=x86_64 --command=com.discordapp.Discord --file-forwarding com.discordapp.Discord @@u %U @@";
        let binary = extract_exec_binary(exec, Some("discord"));
        assert_eq!(binary, Some("discord".to_string()));
    }

    #[test]
    fn test_extract_exec_binary_with_quotes_and_args() {
        let exec = r#""/opt/google/chrome/google-chrome" --profile-directory="Default" %U"#;
        let binary = extract_exec_binary(exec, None);
        assert_eq!(binary, Some("google-chrome".to_string()));
    }

    #[test]
    fn test_protected_process_is_marked_unsupported() {
        let apps = [RawDesktopEntry {
            id: "systemd.desktop".to_string(),
            name: "System Daemon".to_string(),
            exec: Some("systemd".to_string()),
            icon: None,
            wm_class: None,
            source: "system".to_string(),
            no_display: false,
            hidden: false,
            is_application: true,
        }];

        let entry = &apps[0];
        let exec_name = entry
            .exec
            .as_deref()
            .and_then(|ex| extract_exec_binary(ex, None));
        let is_protected = exec_name
            .as_ref()
            .is_some_and(|ename| protected_process_name(ename));
        assert!(is_protected);

        let (cap_linux, reason_linux) =
            determine_enforcement_capability(exec_name.as_deref(), is_protected, "linux");
        assert_eq!(cap_linux, "UNSUPPORTED");
        assert_eq!(
            reason_linux.as_deref(),
            Some("Protected system application")
        );

        let (cap_win, reason_win) =
            determine_enforcement_capability(exec_name.as_deref(), is_protected, "windows");
        assert_eq!(cap_win, "UNSUPPORTED");
        assert_eq!(reason_win.as_deref(), Some("Protected system application"));
    }

    #[test]
    fn test_determine_enforcement_capability_cross_platform() {
        // 1. Unresolved executable is UNSUPPORTED on all platforms
        let (cap, reason) = determine_enforcement_capability(None, false, "linux");
        assert_eq!(cap, "UNSUPPORTED");
        assert_eq!(reason.as_deref(), Some("Executable target unresolved"));

        let (cap, reason) = determine_enforcement_capability(Some("   "), false, "linux");
        assert_eq!(cap, "UNSUPPORTED");
        assert_eq!(reason.as_deref(), Some("Executable target unresolved"));

        let (cap, reason) = determine_enforcement_capability(None, false, "windows");
        assert_eq!(cap, "UNSUPPORTED");
        assert_eq!(reason.as_deref(), Some("Executable target unresolved"));

        // 2. Protected process is UNSUPPORTED on all platforms
        let (cap, reason) = determine_enforcement_capability(Some("init"), true, "linux");
        assert_eq!(cap, "UNSUPPORTED");
        assert_eq!(reason.as_deref(), Some("Protected system application"));

        let (cap, reason) = determine_enforcement_capability(Some("csrss.exe"), true, "windows");
        assert_eq!(cap, "UNSUPPORTED");
        assert_eq!(reason.as_deref(), Some("Protected system application"));

        // 3. Valid non-protected executable on Linux has verified close -> TERMINATE
        let (cap, reason) = determine_enforcement_capability(Some("discord"), false, "linux");
        assert_eq!(cap, "TERMINATE");
        assert!(reason.is_none());

        // 4. Valid non-protected executable on Windows lacks verified close -> MONITOR_ONLY
        let (cap, reason) = determine_enforcement_capability(Some("discord.exe"), false, "windows");
        assert_eq!(cap, "MONITOR_ONLY");
        assert!(reason.is_some());
        assert!(reason.as_ref().unwrap().contains("windows"));

        // 5. Valid non-protected executable on macOS lacks verified close -> MONITOR_ONLY
        let (cap, reason) = determine_enforcement_capability(Some("discord"), false, "macos");
        assert_eq!(cap, "MONITOR_ONLY");
        assert!(reason.is_some());
        assert!(reason.as_ref().unwrap().contains("macos"));
    }
}
