use crate::HostError;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};

pub const HOST_NAME_CANONICAL: &str = "com.shinpo.browser_companion";
pub const HOST_NAME_ALIAS: &str = "com.shinpo.companion";
pub const CHROMIUM_EXTENSION_ID: &str = "ndknhgihhogcfkliohfjcllglpjdgjpj";
pub const FIREFOX_EXTENSION_IDS: &[&str] = &[
    "browser-companion@shinpo.local",
    "companion@shinpo.local",
    "shinpo@shinpo.local",
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRegistrationStatus {
    pub browser: String,
    pub path: String,
    pub is_firefox: bool,
    pub registered: bool,
    pub canonical_manifest_present: bool,
    pub alias_manifest_present: bool,
    pub valid_executable_target: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostDiscoveryReport {
    pub host_binary: Option<String>,
    pub host_binary_exists: bool,
    pub is_executable: bool,
    pub registered_browsers: Vec<String>,
    pub missing_browsers: Vec<String>,
    pub targets: Vec<BrowserRegistrationStatus>,
    pub total_registered: usize,
    pub status_summary: String,
}

pub struct TargetSpec {
    pub browser_name: &'static str,
    pub relative_dir: &'static str,
    pub is_firefox: bool,
    pub base_env: Option<&'static str>,
}

pub fn standard_linux_targets() -> Vec<TargetSpec> {
    vec![
        TargetSpec {
            browser_name: "Google Chrome",
            relative_dir: ".config/google-chrome/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Google Chrome for Testing",
            relative_dir: ".config/google-chrome-for-testing/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Chromium",
            relative_dir: ".config/chromium/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Brave Browser",
            relative_dir: ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Microsoft Edge",
            relative_dir: ".config/microsoft-edge/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Mozilla Firefox",
            relative_dir: ".mozilla/native-messaging-hosts",
            is_firefox: true,
            base_env: Some("HOME"),
        },
        // Flatpak browser environments
        TargetSpec {
            browser_name: "Google Chrome (Flatpak)",
            relative_dir: ".var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Brave Browser (Flatpak)",
            relative_dir:
                ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
            is_firefox: false,
            base_env: Some("HOME"),
        },
        TargetSpec {
            browser_name: "Mozilla Firefox (Flatpak)",
            relative_dir: ".var/app/org.mozilla.firefox/.mozilla/native-messaging-hosts",
            is_firefox: true,
            base_env: Some("HOME"),
        },
    ]
}

pub fn resolve_target_dir(spec: &TargetSpec) -> Option<PathBuf> {
    let base = match spec.base_env {
        Some("HOME") => std::env::var_os("HOME").map(PathBuf::from)?,
        _ => return None,
    };
    Some(base.join(spec.relative_dir))
}

pub fn find_host_binary(explicit: Option<&Path>) -> Option<PathBuf> {
    if let Some(path) = explicit {
        if path.exists() {
            return fs::canonicalize(path)
                .ok()
                .or_else(|| Some(path.to_path_buf()));
        }
    }

    let bin_name = if cfg!(windows) {
        "shinpo-browser-host.exe"
    } else {
        "shinpo-browser-host"
    };

    // 1. Check adjacent to current running binary
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let adjacent = parent.join(bin_name);
            if adjacent.exists() {
                if let Ok(c) = fs::canonicalize(&adjacent) {
                    return Some(c);
                }
                return Some(adjacent);
            }
            // Check parent/browser-companion/shinpo-browser-host
            let sub = parent.join("browser-companion").join(bin_name);
            if sub.exists() {
                if let Ok(c) = fs::canonicalize(&sub) {
                    return Some(c);
                }
                return Some(sub);
            }
        }
    }

    // 2. Standard RPM/DEB installation directory
    #[cfg(unix)]
    {
        let standard_paths = [
            format!("/usr/lib/SHINPO/browser-companion/{bin_name}"),
            format!("/usr/local/lib/SHINPO/browser-companion/{bin_name}"),
            format!("/usr/bin/{bin_name}"),
            format!("/usr/local/bin/{bin_name}"),
        ];
        for p in standard_paths {
            let path = PathBuf::from(p);
            if path.exists() {
                return Some(path);
            }
        }
    }

    // 3. Current working directory or target/release build artifacts
    let dev_candidates = [
        format!("release/{bin_name}"),
        format!("release/rc/{bin_name}"),
        format!("crates/shinpo-browser-host/target/release/{bin_name}"),
        format!("crates/shinpo-browser-host/target/debug/{bin_name}"),
        format!("target/release/{bin_name}"),
        format!("bin/{bin_name}"),
    ];
    for dev_path in dev_candidates {
        let path = PathBuf::from(&dev_path);
        if path.exists() {
            if let Ok(c) = fs::canonicalize(&path) {
                return Some(c);
            }
            return Some(path);
        }
    }

    None
}

pub fn generate_manifest_content(
    host_name: &str,
    binary_path: &Path,
    is_firefox: bool,
) -> serde_json::Value {
    let path_str = binary_path.to_string_lossy().to_string();
    if is_firefox {
        json!({
            "name": host_name,
            "description": "SHINPO Focus Protection Browser Companion Native Host",
            "path": path_str,
            "type": "stdio",
            "allowed_extensions": FIREFOX_EXTENSION_IDS
        })
    } else {
        json!({
            "name": host_name,
            "description": "SHINPO Focus Protection Browser Companion Native Host",
            "path": path_str,
            "type": "stdio",
            "allowed_origins": [
                format!("chrome-extension://{CHROMIUM_EXTENSION_ID}/")
            ]
        })
    }
}

pub fn check_registration(explicit_bin: Option<&Path>) -> HostDiscoveryReport {
    let host_bin = find_host_binary(explicit_bin);
    let host_binary_exists = host_bin.is_some();
    let is_executable = host_bin.as_ref().is_some_and(|p| {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::metadata(p)
                .map(|m| (m.permissions().mode() & 0o111) != 0)
                .unwrap_or(false)
        }
        #[cfg(not(unix))]
        {
            true
        }
    });

    let mut targets = Vec::new();
    let mut registered_browsers = Vec::new();
    let mut missing_browsers = Vec::new();

    let specs = standard_linux_targets();
    for spec in &specs {
        if let Some(target_dir) = resolve_target_dir(spec) {
            let canonical_file = target_dir.join(format!("{HOST_NAME_CANONICAL}.json"));
            let alias_file = target_dir.join(format!("{HOST_NAME_ALIAS}.json"));

            let canonical_exists = canonical_file.exists();
            let alias_exists = alias_file.exists();

            let mut valid_target = false;
            let mut error = None;

            if canonical_exists || alias_exists {
                let check_file = if canonical_exists {
                    &canonical_file
                } else {
                    &alias_file
                };
                match fs::read_to_string(check_file) {
                    Ok(content) => {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(p) = parsed.get("path").and_then(|v| v.as_str()) {
                                if Path::new(p).exists() {
                                    valid_target = true;
                                } else {
                                    error = Some(format!("Manifest path does not exist: {p}"));
                                }
                            } else {
                                error = Some("Manifest missing path field".to_string());
                            }
                        } else {
                            error = Some("Invalid manifest JSON".to_string());
                        }
                    }
                    Err(e) => {
                        error = Some(format!("Cannot read manifest: {e}"));
                    }
                }
            }

            let registered = (canonical_exists || alias_exists) && valid_target;
            if registered {
                if !registered_browsers.contains(&spec.browser_name.to_string()) {
                    registered_browsers.push(spec.browser_name.to_string());
                }
            } else if target_dir.parent().is_some_and(|p| p.exists()) {
                // Parent browser config dir exists, but manifest not registered
                if !missing_browsers.contains(&spec.browser_name.to_string()) {
                    missing_browsers.push(spec.browser_name.to_string());
                }
            }

            targets.push(BrowserRegistrationStatus {
                browser: spec.browser_name.to_string(),
                path: target_dir.to_string_lossy().to_string(),
                is_firefox: spec.is_firefox,
                registered,
                canonical_manifest_present: canonical_exists,
                alias_manifest_present: alias_exists,
                valid_executable_target: valid_target,
                error,
            });
        }
    }

    let total_registered = registered_browsers.len();
    let status_summary = if total_registered > 0 {
        format!(
            "Registered for {} ({})",
            if total_registered == 1 {
                "1 browser".to_string()
            } else {
                format!("{total_registered} browsers")
            },
            registered_browsers.join(", ")
        )
    } else if host_binary_exists {
        "Host binary found, but not registered in any browser".to_string()
    } else {
        "SHINPO native messaging host binary not found".to_string()
    };

    HostDiscoveryReport {
        host_binary: host_bin.map(|p| p.to_string_lossy().to_string()),
        host_binary_exists,
        is_executable,
        registered_browsers,
        missing_browsers,
        targets,
        total_registered,
        status_summary,
    }
}

pub fn register_host(explicit_bin: Option<&Path>) -> Result<HostDiscoveryReport, HostError> {
    let host_bin = find_host_binary(explicit_bin).ok_or_else(|| {
        HostError::Config("shinpo-browser-host binary not found on system".to_string())
    })?;

    let specs = standard_linux_targets();
    for spec in &specs {
        if let Some(target_dir) = resolve_target_dir(spec) {
            // Check if parent configuration directory exists (indicating browser is installed or likely to be used)
            // Or create standard Google Chrome / Chromium / Firefox paths
            let should_create = spec.browser_name == "Google Chrome"
                || spec.browser_name == "Chromium"
                || spec.browser_name == "Mozilla Firefox"
                || target_dir.parent().is_some_and(|p| p.exists());

            if should_create {
                if let Err(e) = fs::create_dir_all(&target_dir) {
                    eprintln!(
                        "Warning: Could not create directory {}: {}",
                        target_dir.display(),
                        e
                    );
                    continue;
                }

                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = fs::set_permissions(&target_dir, fs::Permissions::from_mode(0o755));
                }

                // 1. Write canonical manifest: com.shinpo.browser_companion.json
                let canonical_manifest =
                    generate_manifest_content(HOST_NAME_CANONICAL, &host_bin, spec.is_firefox);
                let canonical_path = target_dir.join(format!("{HOST_NAME_CANONICAL}.json"));
                if let Ok(json_str) = serde_json::to_string_pretty(&canonical_manifest) {
                    let _ = fs::write(&canonical_path, json_str);
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ =
                            fs::set_permissions(&canonical_path, fs::Permissions::from_mode(0o644));
                    }
                }

                // 2. Write alias manifest: com.shinpo.companion.json
                let alias_manifest =
                    generate_manifest_content(HOST_NAME_ALIAS, &host_bin, spec.is_firefox);
                let alias_path = target_dir.join(format!("{HOST_NAME_ALIAS}.json"));
                if let Ok(json_str) = serde_json::to_string_pretty(&alias_manifest) {
                    let _ = fs::write(&alias_path, json_str);
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ = fs::set_permissions(&alias_path, fs::Permissions::from_mode(0o644));
                    }
                }
            }
        }
    }

    Ok(check_registration(Some(&host_bin)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_generate_manifest_content_chromium() {
        let bin = Path::new("/usr/bin/shinpo-browser-host");
        let manifest = generate_manifest_content(HOST_NAME_CANONICAL, bin, false);
        assert_eq!(manifest["name"], HOST_NAME_CANONICAL);
        assert_eq!(manifest["path"], "/usr/bin/shinpo-browser-host");
        assert_eq!(manifest["type"], "stdio");
        assert_eq!(
            manifest["allowed_origins"][0],
            format!("chrome-extension://{CHROMIUM_EXTENSION_ID}/")
        );
    }

    #[test]
    fn test_generate_manifest_content_firefox() {
        let bin = Path::new("/usr/bin/shinpo-browser-host");
        let manifest = generate_manifest_content(HOST_NAME_CANONICAL, bin, true);
        assert_eq!(manifest["name"], HOST_NAME_CANONICAL);
        assert_eq!(manifest["path"], "/usr/bin/shinpo-browser-host");
        assert_eq!(manifest["type"], "stdio");
        assert_eq!(
            manifest["allowed_extensions"][0],
            "browser-companion@shinpo.local"
        );
    }

    #[test]
    fn test_manifest_file_writing_and_checking() {
        let dir = tempdir().unwrap();
        let bin_path = dir.path().join("shinpo-browser-host");
        fs::write(&bin_path, b"#!/bin/sh\nexit 0\n").unwrap();

        let manifest = generate_manifest_content(HOST_NAME_CANONICAL, &bin_path, false);
        let manifest_path = dir.path().join(format!("{HOST_NAME_CANONICAL}.json"));
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();

        assert!(manifest_path.exists());
        let read_back: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
        assert_eq!(read_back["path"], bin_path.to_str().unwrap());
    }
}
