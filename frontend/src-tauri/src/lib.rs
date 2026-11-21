#[cfg(all(feature = "qa-clock", not(debug_assertions)))]
compile_error!("the qa-clock feature must never be enabled in release builds");

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

static SHUTDOWN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "linux")]
fn start_linux_lock_monitor(app: tauri::AppHandle) -> std::io::Result<()> {
    thread::Builder::new()
        .name("shinpo-session-lock-monitor".into())
        .spawn(move || {
            use dbus::blocking::Connection;
            use dbus::message::MatchRule;
            use std::time::Duration as DbusDuration;

            let connection = match Connection::new_system() {
                Ok(connection) => connection,
                Err(error) => {
                    log::warn!("Linux session lock monitoring unavailable: {error}");
                    return;
                }
            };
            let manager_proxy = connection.with_proxy(
                "org.freedesktop.login1",
                "/org/freedesktop/login1",
                DbusDuration::from_secs(2),
            );
            let session_result: Result<(dbus::Path<'static>,), dbus::Error> = manager_proxy
                .method_call(
                    "org.freedesktop.login1.Manager",
                    "GetSessionByPID",
                    (std::process::id(),),
                );
            let session_result =
                session_result.or_else(|pid_error| match std::env::var("XDG_SESSION_ID") {
                    Ok(session_id) => manager_proxy.method_call(
                        "org.freedesktop.login1.Manager",
                        "GetSession",
                        (session_id,),
                    ),
                    Err(_) => Err(pid_error),
                });
            let (session_path,) = match session_result {
                Ok(path) => path,
                Err(error) => {
                    log::warn!("Could not subscribe to the current Linux session lock: {error}");
                    return;
                }
            };

            let lock_app = app.clone();
            let mut lock_rule = MatchRule::new_signal("org.freedesktop.login1.Session", "Lock");
            lock_rule.sender = Some("org.freedesktop.login1".into());
            lock_rule.path = Some(session_path);
            if let Err(error) = connection.add_match(lock_rule, move |(), _, _| {
                lock_vault_on_os_event(&lock_app, "workstation locked");
                true
            }) {
                log::warn!("Could not subscribe to the Linux session lock signal: {error}");
                return;
            }

            let sleep_app = app;
            let mut sleep_rule =
                MatchRule::new_signal("org.freedesktop.login1.Manager", "PrepareForSleep");
            sleep_rule.sender = Some("org.freedesktop.login1".into());
            if let Err(error) = connection.add_match(sleep_rule, move |(preparing,), _, _| {
                if preparing {
                    lock_vault_on_os_event(&sleep_app, "workstation suspending");
                }
                true
            }) {
                log::warn!("Could not subscribe to Linux suspend notifications: {error}");
                return;
            }

            loop {
                if let Err(error) = connection.process(DbusDuration::from_secs(1)) {
                    log::warn!("Linux session lock monitoring stopped: {error}");
                    break;
                }
            }
        })?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn lock_vault_on_os_event(app: &tauri::AppHandle, reason: &str) {
    if let Some(state) = app.try_state::<native_vault::VaultManager>() {
        if let Err(error) = native_vault::lock_vault_for_system_event(state.inner()) {
            log::warn!("Vault lock on {reason} completed with a Focus checkpoint issue: {error}");
        }
    }
}

const CREDENTIAL_SERVICE: &str = "com.shinpo.app";
const REFRESH_TOKEN_ACCOUNT: &str = "refresh_token";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserCompanionLocalStatus {
    paired: bool,
    state: &'static str,
    detail: &'static str,
    host_registered: bool,
    host_binary_exists: bool,
    host_summary: String,
    registered_browsers: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPackageInfo {
    pub os: String,
    pub arch: String,
    pub package_type: String,
    pub supports_in_app_update: bool,
    pub version: String,
    pub channel: String,
}

#[tauri::command]
fn local_get_package_info(app: tauri::AppHandle) -> LocalPackageInfo {
    let version = app.package_info().version.to_string();
    let channel = if version.contains("-beta") {
        "beta".to_string()
    } else {
        "stable".to_string()
    };
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let (package_type, supports_in_app_update) = if cfg!(target_os = "linux") {
        if std::env::var_os("APPIMAGE").is_some() {
            ("appimage".to_string(), true)
        } else if std::path::Path::new("/etc/debian_version").exists() {
            ("deb".to_string(), false)
        } else if std::path::Path::new("/etc/redhat-release").exists()
            || std::path::Path::new("/etc/fedora-release").exists()
        {
            ("rpm".to_string(), false)
        } else {
            ("dev".to_string(), false)
        }
    } else if cfg!(target_os = "windows") {
        ("nsis".to_string(), true)
    } else if cfg!(target_os = "macos") {
        ("app".to_string(), false)
    } else {
        ("unknown".to_string(), false)
    };

    LocalPackageInfo {
        os,
        arch,
        package_type,
        supports_in_app_update,
        version,
        channel,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalPlatformCapabilities {
    guardian: &'static str,
    guardian_process_observation: bool,
    guardian_process_close: bool,
    browser_companion_supported: bool,
}

#[tauri::command]
fn local_platform_capabilities() -> LocalPlatformCapabilities {
    LocalPlatformCapabilities {
        guardian: if cfg!(any(target_os = "linux", target_os = "windows")) {
            "OBSERVE_AND_WARN"
        } else {
            "UNAVAILABLE"
        },
        guardian_process_observation: cfg!(any(target_os = "linux", target_os = "windows")),
        guardian_process_close: cfg!(any(target_os = "linux", target_os = "windows")),
        browser_companion_supported: cfg!(any(target_os = "linux", target_os = "windows")),
    }
}

#[tauri::command]
fn browser_companion_pairing_code(
    state: tauri::State<'_, native_vault::VaultManager>,
) -> Result<String, String> {
    let paths = shinpo_browser_host::config::HostPaths::default();
    shinpo_browser_host::initialize_installation(&paths)
        .map_err(|_| "Could not initialize the Browser Companion host".to_string())?;
    shinpo_browser_host::clear_credentials(&paths)
        .map_err(|_| "Could not switch Browser Companion to local-only credentials".to_string())?;
    let code = shinpo_browser_host::rotate_pairing(&paths)
        .map_err(|_| "Could not create a pairing challenge".to_string())?;
    native_vault::local_sync_browser_policy(state)?;

    // Ensure native messaging host manifests are automatically written for all supported browsers
    let _ = shinpo_browser_host::registration::register_host(None);

    Ok(code)
}

#[tauri::command]
fn browser_companion_local_status(
    state: tauri::State<'_, native_vault::VaultManager>,
) -> BrowserCompanionLocalStatus {
    let paths = shinpo_browser_host::config::HostPaths::default();
    let host_paired = shinpo_browser_host::config::HostConfig::load(&paths)
        .ok()
        .is_some_and(|config| config.browser_token_hash.is_some());
    let vault_paired = state.is_unlocked().unwrap_or(false)
        && native_vault::get_browser_companion_is_paired(state.inner()).unwrap_or(false);

    if host_paired && state.is_unlocked().unwrap_or(false) && !vault_paired {
        let _ = native_vault::set_browser_companion_is_paired(state.inner(), true);
    }
    let paired = host_paired || vault_paired;
    let report = shinpo_browser_host::registration::check_registration(None);
    BrowserCompanionLocalStatus {
        paired,
        state: if paired { "PAIRED" } else { "UNPAIRED" },
        detail: if paired {
            "Pairing is saved locally. Open the extension to verify its live connection."
        } else {
            "Pair the installed extension using a short-lived code from SHINPO."
        },
        host_registered: report.total_registered > 0,
        host_binary_exists: report.host_binary_exists,
        host_summary: report.status_summary,
        registered_browsers: report.registered_browsers,
    }
}

#[tauri::command]
fn browser_companion_register_host(
) -> Result<shinpo_browser_host::registration::HostDiscoveryReport, String> {
    shinpo_browser_host::registration::register_host(None)
        .map_err(|e| format!("Could not register native messaging host: {e}"))
}

#[tauri::command]
fn browser_companion_revoke(
    state: tauri::State<'_, native_vault::VaultManager>,
) -> Result<(), String> {
    if state.is_unlocked().unwrap_or(false) {
        let _ = native_vault::set_browser_companion_is_paired(state.inner(), false);
    }
    shinpo_browser_host::disconnect_installation(&shinpo_browser_host::config::HostPaths::default())
        .map_err(|_| "Could not revoke the Browser Companion pairing".to_string())
}

fn refresh_token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, REFRESH_TOKEN_ACCOUNT)
        .map_err(|_| "OS credential storage is unavailable".to_string())
}

fn validate_refresh_token(token: &str) -> Result<(), String> {
    if token.is_empty() || token.len() > 8192 || token.chars().any(char::is_control) {
        return Err("Invalid refresh token".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_secure_refresh_token() -> Result<Option<String>, String> {
    match refresh_token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read the saved session from OS credential storage".to_string()),
    }
}

#[tauri::command]
fn set_secure_refresh_token(token: String) -> Result<(), String> {
    validate_refresh_token(&token)?;
    refresh_token_entry()?
        .set_password(&token)
        .map_err(|_| "Could not save the session in OS credential storage".to_string())
}

#[cfg(test)]
mod credential_tests {
    use super::validate_refresh_token;

    #[test]
    fn refresh_token_validation_rejects_empty_control_and_oversized_values() {
        assert!(validate_refresh_token("").is_err());
        assert!(validate_refresh_token("token\nwith-control").is_err());
        assert!(validate_refresh_token(&"x".repeat(8193)).is_err());
        assert!(validate_refresh_token("opaque-refresh-token").is_ok());
    }
}

#[tauri::command]
fn delete_secure_refresh_token() -> Result<(), String> {
    match refresh_token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove the saved session from OS credential storage".to_string()),
    }
}

#[tauri::command]
fn desktop_minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn desktop_restart_app(app: tauri::AppHandle, state: tauri::State<'_, native_vault::VaultManager>) {
    if SHUTDOWN_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        log::warn!("[SHINPO Desktop] Application shutdown or restart is already in progress.");
        return;
    }
    log::info!("[SHINPO Desktop] Safe restart requested by user; preparing vault checkpoint.");
    let _ = native_vault::prepare_desktop_shutdown(&state);
    app.restart();
}

#[tauri::command]
fn desktop_exit_app(app: tauri::AppHandle, state: tauri::State<'_, native_vault::VaultManager>) {
    if SHUTDOWN_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        log::warn!("[SHINPO Desktop] Application shutdown or restart is already in progress.");
        return;
    }
    log::info!("[SHINPO Desktop] Safe exit requested by user; preparing vault checkpoint.");
    let _ = native_vault::prepare_desktop_shutdown(&state);
    app.exit(0);
}

pub fn validate_open_url(url: &str) -> Result<url::Url, String> {
    if url.chars().any(|c| c.is_control() || c == '"' || c == '\'') {
        return Err("URL contains forbidden control or quote characters".to_string());
    }
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL: {e}"))?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Only http and https URLs can be opened externally".to_string());
    }
    Ok(parsed)
}

#[tauri::command]
fn desktop_open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = validate_open_url(&url)?;
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGS",
            "--enable-gpu-rasterization --enable-zero-copy",
        );
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            let quit_i =
                tauri::menu::MenuItem::with_id(app, "quit", "Quit SHINPO", true, None::<&str>)?;
            let open_i =
                tauri::menu::MenuItem::with_id(app, "open", "Open SHINPO", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&open_i, &quit_i])?;

            let mut tray_builder = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            let vault_dir = app.path().app_data_dir()?.join("vaults");
            app.manage(native_vault::VaultManager::new(vault_dir));
            #[cfg(target_os = "linux")]
            start_linux_lock_monitor(app.handle().clone())?;
            let focus_worker = app.handle().clone();
            thread::Builder::new()
                .name("shinpo-focus-checkpoint".into())
                .spawn(move || {
                    let mut tick_counter: u32 = 0;
                    loop {
                        let mut sleep_ms = 1000;
                        if let Some(state) = focus_worker.try_state::<native_vault::VaultManager>()
                        {
                            if state.is_unlocked().unwrap_or(false) {
                                tick_counter = tick_counter.wrapping_add(1);
                                if (tick_counter.is_multiple_of(4) || sleep_ms == 1000)
                                    && native_vault::maintain_active_focus(state.inner()).is_err()
                                {
                                    log::debug!("Local Focus checkpoint was unavailable.");
                                }
                                if native_vault::observe_local_guardian_apps(state.inner()).is_err()
                                {
                                    log::debug!("Local Guardian observation was unavailable.");
                                }
                                if native_vault::is_fast_guardian_poll_needed(state.inner()) {
                                    sleep_ms = 250;
                                }
                            }
                        }
                        thread::sleep(Duration::from_millis(sleep_ms));
                    }
                })?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            app.handle().plugin(tauri_plugin_opener::init())?;
            #[cfg(target_os = "linux")]
            setup_linux_desktop_integration();
            let _ = shinpo_browser_host::registration::register_host(None);
            log::info!("[SHINPO Desktop] Tauri shell initialized.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_vault::create_local_account,
            native_vault::unlock_local_account,
            native_vault::recover_local_account,
            native_vault::change_local_password,
            native_vault::lock_local_account,
            native_vault::delete_local_account,
            native_vault::local_vault_status,
            native_vault::touch_local_vault_activity,
            native_vault::local_get_goals,
            native_vault::local_create_goal,
            native_vault::local_update_goal,
            native_vault::local_delete_goal,
            native_vault::local_delete_all_goals,
            native_vault::local_get_tasks,
            native_vault::local_create_task,
            native_vault::local_update_task,
            native_vault::local_complete_task,
            native_vault::local_delete_task,
            native_vault::local_delete_all_tasks,
            native_vault::local_get_progress,
            native_vault::local_get_streak,
            native_vault::local_get_onboarding_state,
            native_vault::local_start_onboarding,
            native_vault::local_record_onboarding_step,
            native_vault::local_finish_onboarding,
            native_vault::local_pause_onboarding,
            native_vault::local_skip_onboarding,
            native_vault::local_claim_onboarding_reward,
            native_vault::local_eonpai_provider_status,
            native_vault::local_eonpai_get_active,
            native_vault::local_eonpai_clear_active,
            native_vault::local_eonpai_send,
            native_vault::eonpai::provider::local_eonpai_configure_provider,
            native_vault::eonpai::provider::local_eonpai_provider_config,
            native_vault::eonpai::provider::local_eonpai_cancel,
            native_vault::eonpai::local_eonpai_list,
            native_vault::eonpai::local_eonpai_open,
            native_vault::eonpai::local_eonpai_delete,
            native_vault::eonpai::local_eonpai_read,
            native_vault::eonpai::local_eonpai_propose,
            native_vault::eonpai::local_eonpai_confirm,
            native_vault::eonpai::local_eonpai_reject,
            native_vault::eonpai::local_eonpai_actions,
            native_vault::eonpai::local_eonpai_commit_plan,
            native_vault::local_create_focus_session,
            native_vault::local_get_focus_sessions,
            native_vault::local_get_focus_sessions_by_date,
            native_vault::local_update_focus_session,
            native_vault::local_start_focus_session,
            native_vault::local_pause_focus_session,
            native_vault::local_resume_focus_session,
            native_vault::local_return_to_focus,
            native_vault::local_complete_focus_session,
            native_vault::local_cancel_focus_session,
            native_vault::local_delete_focus_session,
            native_vault::local_get_study_resources,
            native_vault::local_create_study_resource,
            native_vault::local_delete_study_resource,
            native_vault::local_sync_browser_policy,
            native_vault::local_set_browser_focus_mode,
            native_vault::local_get_guardian_observations,
            native_vault::local_get_guardian_status,
            native_vault::local_get_guardian_preferences,
            native_vault::local_update_guardian_preferences,
            native_vault::local_emergency_stop_guardian,
            native_vault::local_get_discovered_apps,
            native_vault::local_get_app_policies,
            native_vault::local_save_app_policy,
            native_vault::local_remove_app_policy,
            browser_companion_pairing_code,
            browser_companion_local_status,
            browser_companion_revoke,
            browser_companion_register_host,
            local_platform_capabilities,
            local_get_package_info,
            native_system_monitor::local_get_system_telemetry,
            native_system_monitor::local_get_process_snapshot,
            get_secure_refresh_token,
            set_secure_refresh_token,
            delete_secure_refresh_token,
            desktop_minimize_window,
            desktop_restart_app,
            desktop_exit_app,
            desktop_open_url,
            #[cfg(feature = "qa-clock")]
            native_vault::qa_set_clock_offset
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

mod native_system_monitor;
mod native_vault;

pub fn smoke_test() -> Result<(), String> {
    native_vault::smoke_test()
}

#[cfg(target_os = "linux")]
fn setup_linux_desktop_integration() {
    let Some(home) = std::env::var_os("HOME").map(std::path::PathBuf::from) else {
        return;
    };

    // Determine target execution path: prioritize AppImage path if running from an AppImage bundle.
    let exec_cmd = match std::env::var("APPIMAGE") {
        Ok(appimage_path) if !appimage_path.trim().is_empty() => {
            format!("\"{}\" %U", appimage_path.trim())
        }
        _ => match std::env::current_exe() {
            Ok(exe_path) => format!("\"{}\" %U", exe_path.to_string_lossy()),
            Err(_) => return,
        },
    };

    let icon_sizes: &[(&str, &[u8])] = &[
        ("32x32", include_bytes!("../icons/32x32.png")),
        ("64x64", include_bytes!("../icons/64x64.png")),
        ("128x128", include_bytes!("../icons/128x128.png")),
        ("256x256", include_bytes!("../icons/128x128@2x.png")),
        ("512x512", include_bytes!("../icons/icon.png")),
    ];

    for (size, bytes) in icon_sizes {
        let icon_dir = home.join(format!(".local/share/icons/hicolor/{size}/apps"));
        if std::fs::create_dir_all(&icon_dir).is_ok() {
            let _ = std::fs::write(icon_dir.join("shinpo-desktop.png"), bytes);
            let _ = std::fs::write(icon_dir.join("SHINPO.png"), bytes);
            let _ = std::fs::write(icon_dir.join("com.shinpo.desktop.png"), bytes);
        }
    }

    let pixmaps_dir = home.join(".local/share/pixmaps");
    if std::fs::create_dir_all(&pixmaps_dir).is_ok() {
        let icon_512 = include_bytes!("../icons/icon.png");
        let _ = std::fs::write(pixmaps_dir.join("shinpo-desktop.png"), icon_512);
        let _ = std::fs::write(pixmaps_dir.join("SHINPO.png"), icon_512);
        let _ = std::fs::write(pixmaps_dir.join("com.shinpo.desktop.png"), icon_512);
    }

    let app_dir = home.join(".local/share/applications");
    if std::fs::create_dir_all(&app_dir).is_ok() {
        for (file_name, wm_class) in &[
            ("shinpo-desktop.desktop", "shinpo-desktop"),
            ("SHINPO.desktop", "SHINPO"),
            ("com.shinpo.desktop.desktop", "com.shinpo.desktop"),
        ] {
            let desktop_content = format!(
                "[Desktop Entry]\nVersion=1.0\nType=Application\nName=SHINPO\nGenericName=Personal Execution OS\nComment=SHINPO Personal Execution OS\nExec={exec_cmd}\nIcon=shinpo-desktop\nTerminal=false\nCategories=Utility;Office;\nStartupWMClass={wm_class}\nStartupNotify=true\n"
            );
            let _ = std::fs::write(app_dir.join(file_name), desktop_content);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_url_http_accepted() {
        let res = validate_open_url("http://example.com/update");
        assert!(res.is_ok());
        assert_eq!(res.unwrap().scheme(), "http");
    }

    #[test]
    fn test_open_url_https_accepted() {
        let res = validate_open_url("https://github.com/ronartz/SHINPO/releases");
        assert!(res.is_ok());
        assert_eq!(res.unwrap().scheme(), "https");
    }

    #[test]
    fn test_open_url_file_scheme_rejected() {
        assert!(validate_open_url("file:///etc/passwd").is_err());
        assert!(validate_open_url("file://C:/Windows/System32").is_err());
    }

    #[test]
    fn test_open_url_javascript_scheme_rejected() {
        assert!(validate_open_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn test_open_url_control_chars_rejected() {
        assert!(validate_open_url("https://example.com/\"").is_err());
        assert!(validate_open_url("https://example.com/'").is_err());
        assert!(validate_open_url("https://example.com/\ncalc.exe").is_err());
        assert!(validate_open_url("https://example.com/\0calc.exe").is_err());
        assert!(validate_open_url("https://example.com/\r\ncmd").is_err());
    }
}
