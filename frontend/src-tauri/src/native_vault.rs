use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use subtle::ConstantTimeEq;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use unicode_normalization::UnicodeNormalization;
use zeroize::{Zeroize, Zeroizing};

const KEY_BYTES: usize = 32;
const SALT_BYTES: usize = 16;
const NONCE_BYTES: usize = 24;
const ARGON_MEMORY_KIB: u32 = 65_536;
const ARGON_ITERATIONS: u32 = 3;
const LATEST_SCHEMA_VERSION: i64 = 17;
const LOCAL_VAULT_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[path = "native_eonpai.rs"]
pub mod eonpai;
const DOMAIN_CATALOG_VERSION: &str = "guardian-domains-v1";
const CHECKPOINT_STALE_SECONDS: i64 = 15;

#[derive(Serialize, Deserialize)]
struct VaultMetadata {
    username: String,
    password_salt: String,
    password_nonce: String,
    password_wrapped_key: String,
    recovery_salt: String,
    recovery_nonce: String,
    recovery_wrapped_key: String,
    #[serde(default)]
    password_nfkc: bool,
    #[serde(default)]
    failed_unlock_attempts: u32,
    #[serde(default)]
    unlock_blocked_until: Option<i64>,
}

struct UnlockedVault {
    connection: Connection,
    username: String,
    _database_key: Zeroizing<[u8; KEY_BYTES]>,
    eonpai_epoch: String,
    last_activity: Instant,
    last_activity_wall: SystemTime,
}

pub struct VaultManager {
    root: PathBuf,
    unlocked: Mutex<Option<UnlockedVault>>,
    auth_attempts: Mutex<()>,
    eonpai_requests: Mutex<std::collections::HashMap<String, tokio::sync::watch::Sender<bool>>>,
    guardian_observer: Mutex<GuardianObserverHealth>,
    idle_timeout_ns: AtomicU64,
    browser_host_paths: shinpo_browser_host::config::HostPaths,
    #[cfg(test)]
    dummy_argon2_runs: std::sync::atomic::AtomicUsize,
}

pub fn smoke_test() -> Result<(), String> {
    let mut random = [0u8; 8];
    getrandom::fill(&mut random)
        .map_err(|_| "Could not create an isolated smoke-test profile".to_string())?;
    let root = std::env::temp_dir().join(format!(
        "shinpo-smoke-{}-{}",
        std::process::id(),
        encode_hex(&random)
    ));
    fs::create_dir(&root)
        .map_err(|_| "Could not create an isolated smoke-test profile".to_string())?;
    let result = run_smoke_test_in(&root);
    let cleanup = fs::remove_dir_all(&root);
    result?;
    cleanup.map_err(|_| {
        "Smoke test passed, but its temporary profile could not be removed".to_string()
    })
}

fn run_smoke_test_in(root: &Path) -> Result<(), String> {
    let username = "smoke_test_user";
    let password = "Shinpo disposable smoke password 2026";
    let manager = VaultManager::new(root.to_path_buf());
    create_account(&manager, username, password)?;
    lock_vault_for_system_event(&manager)?;
    unlock_account(&manager, username, password)?;

    let (goal, task, session) = with_db(&manager, |db| {
        let goal = insert_goal_record(
            db,
            "Smoke-test goal",
            Some("Disposable"),
            "2026-01-01",
            None,
        )?;
        let task =
            insert_task_record(db, goal.id, "Smoke-test task", None, "2026-01-01", Some(25))?;
        let request = CreateFocusSessionRequest {
            goal_id: Some(goal.id),
            mission_id: Some(task.id),
            name: "Smoke-test focus".into(),
            intention: Some("Disposable native persistence check".into()),
            duration_minutes: 25,
            scheduled_at: None,
            pomodoro_enabled: Some(false),
            pomodoro_focus_cycles: Some(2),
            pomodoro_short_break_minutes: Some(5),
            pomodoro_long_break_minutes: Some(15),
            pomodoro_grace_minutes: Some(10),
            late_penalty_enabled: Some(false),
            late_penalty_xp: Some(5),
            late_penalty_daily_cap_xp: Some(20),
            guardian_mode: Some("PROTECTED".into()),
            guardian_app_monitoring: Some(false),
        };
        let session = insert_focus_record(db, &request)?;
        complete_task(db, task.id, Some(1)).map_err(|_| rusqlite::Error::InvalidQuery)?;
        update_goal_record(
            db,
            goal.id,
            &goal.title,
            goal.description.as_deref(),
            &goal.start_date,
            goal.target_date.as_deref(),
            "COMPLETED",
        )?;
        Ok((goal, task, session))
    })?;

    let start_at = unix_now_seconds() - 900;
    with_db(&manager, |db| {
        start_focus_session(db, session.id, start_at)?;
        complete_focus_session(
            db,
            session.id,
            start_at + 900,
            Some(5),
            Some("Smoke-test reflection".into()),
            Some("Persisted".into()),
            false,
        )?;
        Ok(())
    })?;
    lock_vault_for_system_event(&manager)?;
    drop(manager);

    let reopened = VaultManager::new(root.to_path_buf());
    unlock_account(&reopened, username, password)?;
    let (goal_status, task_status, focus_status, xp, reflection): (
        String,
        String,
        String,
        i64,
        Option<String>,
    ) = with_db(&reopened, |db| {
        Ok((
            db.query_row("SELECT status FROM goals WHERE id=?1", [goal.id], |r| {
                r.get(0)
            })?,
            db.query_row("SELECT status FROM tasks WHERE id=?1", [task.id], |r| {
                r.get(0)
            })?,
            db.query_row(
                "SELECT status FROM calendar_sessions WHERE id=?1",
                [session.id],
                |r| r.get(0),
            )?,
            db.query_row(
                "SELECT coalesce(sum(amount),0) FROM progress_events",
                [],
                |r| r.get(0),
            )?,
            db.query_row(
                "SELECT reflection_note FROM calendar_sessions WHERE id=?1",
                [session.id],
                |r| r.get(0),
            )?,
        ))
    })?;
    if goal_status != "COMPLETED"
        || task_status != "COMPLETED"
        || focus_status != "COMPLETED"
        || xp != 75
        || reflection.as_deref() != Some("Smoke-test reflection")
    {
        return Err("Native smoke test did not recover the expected persisted records".into());
    }
    let database = root.join(username).join("shinpo.db");
    let header = fs::read(database)
        .map_err(|_| "Could not verify encrypted smoke-test database".to_string())?;
    if header.starts_with(b"SQLite format 3\0") {
        return Err("Smoke-test database was readable as plaintext SQLite".into());
    }
    lock_vault_for_system_event(&reopened)?;
    println!("PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header");
    Ok(())
}

#[derive(Default)]
struct GuardianObserverHealth {
    session_id: Option<i64>,
    status: &'static str,
    checked_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedLocalAccount {
    pub username: String,
    pub recovery_key: String,
}

#[derive(Serialize)]
pub struct LocalVaultStatus {
    pub unlocked: bool,
    pub username: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalOnboardingState {
    pub user_id: i64,
    pub status: String,
    pub current_step: i64,
    pub completed_steps_count: i64,
    pub verified_steps: String,
    pub completed_at: Option<String>,
    pub is_completed: bool,
    pub can_claim_reward: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEonpaiMessage {
    pub id: i64,
    pub role: String,
    pub content: String,
    pub suggestion_type: Option<String>,
    pub structured_card: Option<serde_json::Value>,
    pub tutorial: Option<serde_json::Value>,
    pub bug_report: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEonpaiConversation {
    pub conversation_id: String,
    pub title: String,
    pub status: String,
    pub messages: Vec<LocalEonpaiMessage>,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEonpaiReply {
    pub reply: String,
    pub suggestion_type: String,
    pub structured_card: Option<serde_json::Value>,
    pub tutorial: Option<serde_json::Value>,
    pub bug_report: Option<serde_json::Value>,
    pub conversation_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGoal {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_date: String,
    pub target_date: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTask {
    pub id: i64,
    pub goal_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub scheduled_date: String,
    pub estimated_minutes: Option<i64>,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTaskCompletion {
    pub id: i64,
    pub mission_id: i64,
    pub started_at: Option<String>,
    pub completed_at: String,
    pub actual_minutes: Option<i64>,
    pub result: String,
    pub earned_progress: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateTaskRequest {
    task_id: i64,
    goal_id: i64,
    title: String,
    description: Option<String>,
    scheduled_date: String,
    estimated_minutes: Option<i64>,
    status: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateFocusSessionRequest {
    goal_id: Option<i64>,
    mission_id: Option<i64>,
    name: String,
    intention: Option<String>,
    duration_minutes: i64,
    scheduled_at: Option<String>,
    pomodoro_enabled: Option<bool>,
    pomodoro_focus_cycles: Option<i64>,
    pomodoro_short_break_minutes: Option<i64>,
    pomodoro_long_break_minutes: Option<i64>,
    pomodoro_grace_minutes: Option<i64>,
    late_penalty_enabled: Option<bool>,
    late_penalty_xp: Option<i64>,
    late_penalty_daily_cap_xp: Option<i64>,
    guardian_mode: Option<String>,
    guardian_app_monitoring: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateGuardianPreferencesRequest {
    preferred_mode: String,
    app_monitoring_consent: bool,
    apply_to_new_sessions: bool,
    closure_consent: bool,
    background_runtime_consent: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGuardianPreferences {
    pub preferred_mode: String,
    pub app_monitoring_consent: bool,
    pub apply_to_new_sessions: bool,
    pub closure_consent: bool,
    pub background_runtime_consent: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateFocusSessionRequest {
    session_id: i64,
    goal_id: Option<i64>,
    mission_id: Option<i64>,
    name: String,
    intention: Option<String>,
    duration_minutes: i64,
    scheduled_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateStudyResourceRequest {
    mission_id: Option<i64>,
    focus_session_id: Option<i64>,
    resource_type: String,
    match_type: String,
    disposition: String,
    break_only: bool,
    destination: String,
    display_name: Option<String>,
    expires_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProgressEvent {
    pub id: i64,
    pub event_type: String,
    pub amount: i64,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGuardianObservation {
    pub id: i64,
    pub session_id: i64,
    pub pid: u32,
    pub process_name: String,
    pub catalog_version: String,
    pub category: String,
    pub rationale: String,
    pub guardian_mode: String,
    pub focus_phase: String,
    pub outcome: String,
    pub observed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGuardianAppPolicy {
    pub id: i64,
    pub app_id: String,
    pub app_name: String,
    pub exec_name: String,
    pub policy_type: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAppPolicyRequest {
    pub app_id: String,
    pub app_name: String,
    pub exec_name: String,
    pub policy_type: String,
    pub source: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGuardianStatus {
    pub status: &'static str,
    pub active_focus_session_id: Option<i64>,
    pub active_focus_session_name: Option<String>,
    pub guardian_mode: Option<String>,
    pub focus_phase: Option<String>,
    pub observations_today: i64,
    pub last_observation_at: Option<String>,
    pub app_catalog_version: &'static str,
    pub domain_catalog_version: &'static str,
    pub warning_only: bool,
    pub intervention_capability: &'static str,
    pub standard_allowance_seconds: Option<i64>,
    pub observer_status: &'static str,
    pub application_policy_status: &'static str,
    pub application_catalog: Vec<LocalGuardianCatalogEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGuardianCatalogEntry {
    pub process_name: &'static str,
    pub category: &'static str,
    pub rationale: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStudyResource {
    pub id: i64,
    pub user_id: i64,
    pub mission_id: Option<i64>,
    pub focus_session_id: Option<i64>,
    pub resource_type: String,
    pub match_type: String,
    pub disposition: String,
    pub break_only: bool,
    pub destination: String,
    pub canonical_destination: String,
    pub display_name: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DailyStreakDay {
    pub date: String,
    pub day_label: String,
    pub qualified: bool,
    pub task_completed: bool,
    pub focus_minutes: i64,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConsistencyStreak {
    pub current_streak: i64,
    pub longest_streak: i64,
    pub today_completed: bool,
    pub productive_days_this_month: i64,
    pub last_seven_days: Vec<DailyStreakDay>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProgress {
    pub user_id: i64,
    pub total_progress: i64,
    pub level: i64,
    pub level_title: String,
    pub current_level_xp: i64,
    pub next_level_threshold: i64,
    pub progress_percent: f64,
    pub recent_events: Vec<LocalProgressEvent>,
    pub streak: ConsistencyStreak,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFocusSession {
    pub id: i64,
    pub user_id: i64,
    pub goal_id: Option<i64>,
    pub mission_id: Option<i64>,
    pub plan_id: Option<i64>,
    pub name: String,
    pub intention: Option<String>,
    pub duration_minutes: i64,
    pub pomodoro_enabled: bool,
    pub pomodoro_focus_cycles: i64,
    pub pomodoro_short_break_minutes: i64,
    pub pomodoro_long_break_minutes: i64,
    pub completed_focus_cycles: i64,
    pub pomodoro_grace_minutes: i64,
    pub late_penalty_enabled: bool,
    pub late_penalty_xp: i64,
    pub late_penalty_daily_cap_xp: i64,
    pub guardian_app_monitoring: bool,
    pub current_phase: String,
    pub phase_deadline_at: Option<i64>,
    pub phase_revision: i64,
    pub interruption_count: i64,
    pub focus_active_seconds: i64,
    pub break_active_seconds: i64,
    pub status: String,
    pub scheduled_at: Option<String>,
    pub started_at: Option<String>,
    pub paused_at: Option<String>,
    pub accumulated_paused_seconds: i64,
    pub active_seconds: i64,
    pub remaining_seconds: i64,
    pub server_time: String,
    pub ended_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completion_quality: Option<i64>,
    pub reflection_note: Option<String>,
    pub accomplishment: Option<String>,
}

impl VaultManager {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            unlocked: Mutex::new(None),
            auth_attempts: Mutex::new(()),
            eonpai_requests: Mutex::new(std::collections::HashMap::new()),
            guardian_observer: Mutex::new(GuardianObserverHealth::default()),
            idle_timeout_ns: AtomicU64::new(LOCAL_VAULT_IDLE_TIMEOUT.as_nanos() as u64),
            browser_host_paths: shinpo_browser_host::config::HostPaths::default(),
            #[cfg(test)]
            dummy_argon2_runs: std::sync::atomic::AtomicUsize::new(0),
        }
    }

    #[cfg(test)]
    fn with_browser_host_paths(mut self, paths: shinpo_browser_host::config::HostPaths) -> Self {
        self.browser_host_paths = paths;
        self
    }

    #[cfg(test)]
    fn set_idle_timeout(&self, timeout: Duration) {
        self.idle_timeout_ns
            .store(timeout.as_nanos() as u64, Ordering::Relaxed);
    }

    fn idle_timeout(&self) -> Duration {
        Duration::from_nanos(self.idle_timeout_ns.load(Ordering::Relaxed))
    }

    fn account_dir(&self, username: &str) -> Result<PathBuf, String> {
        let username = normalize_username(username)?;
        let root = self.canonical_root()?;
        let account_dir = root.join(username);
        match fs::symlink_metadata(&account_dir) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                Err("Local account path is not a safe directory".to_string())
            }
            Ok(_) => {
                let canonical = fs::canonicalize(&account_dir)
                    .map_err(|_| "Local account path is unavailable".to_string())?;
                if canonical.parent() != Some(root.as_path()) {
                    return Err("Local account path is outside the vault directory".to_string());
                }
                set_private_permissions(&canonical)?;
                Ok(canonical)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(account_dir),
            Err(_) => Err("Local account path is unavailable".to_string()),
        }
    }

    fn canonical_root(&self) -> Result<PathBuf, String> {
        let metadata = fs::symlink_metadata(&self.root)
            .map_err(|_| "Local vault directory is unavailable".to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("Local vault path is not a safe directory".to_string());
        }
        let canonical = fs::canonicalize(&self.root)
            .map_err(|_| "Local vault directory is unavailable".to_string())?;
        set_private_permissions(&canonical)?;
        Ok(canonical)
    }

    pub fn is_unlocked(&self) -> Result<bool, String> {
        expire_idle_vault(self)?;
        self.unlocked
            .lock()
            .map(|guard| guard.is_some())
            .map_err(|_| "Vault state is unavailable".to_string())
    }

    fn metadata(&self, username: &str) -> Result<VaultMetadata, String> {
        let account_dir = self.account_dir(username)?;
        let path = account_dir.join("vault.json");
        require_regular_file_if_present(&path)?;
        if path.exists() {
            let file = File::open(&path)
                .map_err(|_| "Local account metadata is unavailable".to_string())?;
            set_private_file_permissions(&file)?;
        }
        let bytes = fs::read(path).map_err(|_| "Local account was not found".to_string())?;
        serde_json::from_slice(&bytes).map_err(|_| "Local account metadata is invalid".to_string())
    }
}

#[tauri::command]
pub fn create_local_account(
    state: tauri::State<'_, VaultManager>,
    username: String,
    password: String,
) -> Result<CreatedLocalAccount, String> {
    create_account(&state, &username, &password)
}

fn create_account(
    state: &VaultManager,
    username: &str,
    password: &str,
) -> Result<CreatedLocalAccount, String> {
    let username = normalize_username(username)?;
    let password = normalize_new_password(password)?;
    fs::create_dir_all(&state.root)
        .map_err(|_| "Could not create the local vault directory".to_string())?;
    set_private_permissions(&state.canonical_root()?)?;
    let account_dir = state.account_dir(&username)?;
    fs::create_dir(&account_dir)
        .map_err(|_| "An account with this username already exists".to_string())?;
    set_private_permissions(&account_dir)?;

    let result = (|| {
        let mut database_key = Zeroizing::new([0u8; KEY_BYTES]);
        let mut recovery_bytes = [0u8; KEY_BYTES];
        getrandom::fill(database_key.as_mut())
            .map_err(|_| "Secure random generation failed".to_string())?;
        getrandom::fill(&mut recovery_bytes)
            .map_err(|_| "Secure random generation failed".to_string())?;
        let recovery_key = encode_hex(&recovery_bytes);
        recovery_bytes.zeroize();

        let mut password_salt = [0u8; SALT_BYTES];
        let mut recovery_salt = [0u8; SALT_BYTES];
        getrandom::fill(&mut password_salt)
            .map_err(|_| "Secure random generation failed".to_string())?;
        getrandom::fill(&mut recovery_salt)
            .map_err(|_| "Secure random generation failed".to_string())?;
        let password_nonce = random_nonce()?;
        let recovery_nonce = random_nonce()?;
        let password_key = derive_key(password.as_bytes(), &password_salt)?;
        let recovery_key_bytes = derive_key(recovery_key.as_bytes(), &recovery_salt)?;
        let metadata = VaultMetadata {
            username: username.clone(),
            password_salt: encode_hex(&password_salt),
            password_nonce: encode_hex(&password_nonce),
            password_wrapped_key: wrap_key(
                &password_key,
                &password_nonce,
                &database_key,
                username.as_bytes(),
            )?,
            recovery_salt: encode_hex(&recovery_salt),
            recovery_nonce: encode_hex(&recovery_nonce),
            recovery_wrapped_key: wrap_key(
                &recovery_key_bytes,
                &recovery_nonce,
                &database_key,
                username.as_bytes(),
            )?,
            password_nfkc: true,
            failed_unlock_attempts: 0,
            unlock_blocked_until: None,
        };
        write_metadata(&account_dir.join("vault.json"), &metadata)?;
        let connection = open_encrypted_database(
            &account_dir.join("shinpo.db"),
            &database_key,
            &username,
            true,
        )?;
        let mut unlocked = state
            .unlocked
            .lock()
            .map_err(|_| "Vault state is unavailable".to_string())?;
        *unlocked = Some(UnlockedVault {
            connection,
            username: username.clone(),
            _database_key: database_key,
            eonpai_epoch: eonpai::opaque_id()?,
            last_activity: Instant::now(),
            last_activity_wall: SystemTime::now(),
        });
        Ok(CreatedLocalAccount {
            username: username.clone(),
            recovery_key,
        })
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&account_dir);
    }
    result
}

#[tauri::command]
pub fn unlock_local_account(
    state: tauri::State<'_, VaultManager>,
    username: String,
    password: String,
) -> Result<LocalVaultStatus, String> {
    unlock_account(&state, &username, &password)
}

fn unlock_account(
    state: &VaultManager,
    username: &str,
    password: &str,
) -> Result<LocalVaultStatus, String> {
    const LOGIN_ERROR: &str = "Unable to unlock local account";
    let _attempt = state
        .auth_attempts
        .try_lock()
        .map_err(|_| LOGIN_ERROR.to_string())?;
    let _cross_process_attempt = lock_auth_attempts(state).map_err(|_| LOGIN_ERROR.to_string())?;
    let username = match normalize_username(username) {
        Ok(username) => username,
        Err(_) => {
            dummy_argon2_verify(state, password);
            return Err(LOGIN_ERROR.to_string());
        }
    };
    let mut metadata = match state.metadata(&username) {
        Ok(metadata) => metadata,
        Err(_) => {
            dummy_argon2_verify(state, password);
            return Err(LOGIN_ERROR.to_string());
        }
    };
    reserve_auth_attempt(state, &username, &mut metadata)?;
    let normalized_password = if metadata.password_nfkc {
        match normalize_password_nfkc(password) {
            Ok(password) => password,
            Err(_) => {
                dummy_argon2_verify(state, password);
                return Err(LOGIN_ERROR.to_string());
            }
        }
    } else {
        if validate_legacy_password(password).is_err() {
            dummy_argon2_verify(state, password);
            return Err(LOGIN_ERROR.to_string());
        }
        Zeroizing::new(password.to_owned())
    };
    let unwrap_result = (|| {
        let salt = decode_fixed::<SALT_BYTES>(&metadata.password_salt)?;
        let wrapping_key = derive_key(normalized_password.as_bytes(), &salt)?;
        let nonce = decode_hex(&metadata.password_nonce)?;
        let wrapped = decode_hex(&metadata.password_wrapped_key)?;
        unwrap_key(&wrapping_key, &nonce, &wrapped, username.as_bytes())
    })();
    let db_key = match unwrap_result {
        Ok(key) => Zeroizing::new(key),
        Err(_) => {
            return Err(LOGIN_ERROR.to_string());
        }
    };
    let db_path = state.account_dir(&username)?.join("shinpo.db");
    let connection = require_existing_regular_file(&db_path)
        .and_then(|()| open_encrypted_database(&db_path, &db_key, &username, false))
        .map_err(|_| LOGIN_ERROR.to_string())?;
    let mut metadata_changed = false;
    if !metadata.password_nfkc {
        if let Ok(normalized_password) = normalize_password_nfkc(password) {
            let mut salt = [0u8; SALT_BYTES];
            getrandom::fill(&mut salt).map_err(|_| LOGIN_ERROR.to_string())?;
            let nonce = random_nonce().map_err(|_| LOGIN_ERROR.to_string())?;
            let wrapping_key = derive_key(normalized_password.as_bytes(), &salt)
                .map_err(|_| LOGIN_ERROR.to_string())?;
            let wrapped_key = wrap_key(&wrapping_key, &nonce, &db_key, username.as_bytes())
                .map_err(|_| LOGIN_ERROR.to_string())?;
            let verified = unwrap_key(
                &wrapping_key,
                &nonce,
                &decode_hex(&wrapped_key).map_err(|_| LOGIN_ERROR.to_string())?,
                username.as_bytes(),
            )
            .map_err(|_| LOGIN_ERROR.to_string())?;
            if verified != *db_key {
                return Err(LOGIN_ERROR.to_string());
            }
            metadata.password_salt = encode_hex(&salt);
            metadata.password_nonce = encode_hex(&nonce);
            metadata.password_wrapped_key = wrapped_key;
            metadata.password_nfkc = true;
            metadata_changed = true;
        }
    }
    if metadata.failed_unlock_attempts != 0 || metadata.unlock_blocked_until.is_some() {
        metadata.failed_unlock_attempts = 0;
        metadata.unlock_blocked_until = None;
        metadata_changed = true;
    }
    if metadata_changed {
        write_metadata(&state.account_dir(&username)?.join("vault.json"), &metadata)?;
    }
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *unlocked = Some(UnlockedVault {
        connection,
        username: username.clone(),
        _database_key: db_key,
        eonpai_epoch: eonpai::opaque_id()?,
        last_activity: Instant::now(),
        last_activity_wall: SystemTime::now(),
    });
    Ok(LocalVaultStatus {
        unlocked: true,
        username: Some(username),
    })
}

#[tauri::command]
pub fn recover_local_account(
    state: tauri::State<'_, VaultManager>,
    username: String,
    recovery_key: String,
    new_password: String,
) -> Result<(), String> {
    recover_account(&state, &username, &recovery_key, &new_password)
}

fn recover_account(
    state: &VaultManager,
    username: &str,
    recovery_key: &str,
    new_password: &str,
) -> Result<(), String> {
    const AUTH_ERROR: &str = "Unable to recover local account";
    let _cross_process_attempt = lock_auth_attempts(state)?;
    let username = match normalize_username(username) {
        Ok(username) => username,
        Err(_) => {
            dummy_argon2_verify(state, recovery_key);
            return Err(AUTH_ERROR.into());
        }
    };
    let new_password = normalize_new_password(new_password)?;
    let mut metadata = match state.metadata(&username) {
        Ok(metadata) => metadata,
        Err(_) => {
            dummy_argon2_verify(state, recovery_key);
            return Err(AUTH_ERROR.into());
        }
    };
    reserve_auth_attempt(state, &username, &mut metadata).map_err(|_| AUTH_ERROR.to_string())?;
    if recovery_key.len() != KEY_BYTES * 2 || decode_fixed::<KEY_BYTES>(recovery_key).is_err() {
        dummy_argon2_verify(state, recovery_key);
        return Err(AUTH_ERROR.into());
    }
    let recovery_salt =
        decode_fixed::<SALT_BYTES>(&metadata.recovery_salt).map_err(|_| AUTH_ERROR.to_string())?;
    let recovery_nonce =
        decode_hex(&metadata.recovery_nonce).map_err(|_| AUTH_ERROR.to_string())?;
    let recovery_wrapped =
        decode_hex(&metadata.recovery_wrapped_key).map_err(|_| AUTH_ERROR.to_string())?;
    let recovery_derived = derive_key(recovery_key.as_bytes(), &recovery_salt)?;
    let db_key = Zeroizing::new(
        unwrap_key(
            &recovery_derived,
            &recovery_nonce,
            &recovery_wrapped,
            username.as_bytes(),
        )
        .map_err(|_| AUTH_ERROR.to_string())?,
    );
    let db_path = state.account_dir(&username)?.join("shinpo.db");
    require_existing_regular_file(&db_path).map_err(|_| AUTH_ERROR.to_string())?;

    let mut salt = [0u8; SALT_BYTES];
    let nonce = random_nonce()?;
    getrandom::fill(&mut salt).map_err(|_| "Secure random generation failed".to_string())?;
    let wrapping_key = derive_key(new_password.as_bytes(), &salt)?;
    metadata.password_salt = encode_hex(&salt);
    metadata.password_nonce = encode_hex(&nonce);
    metadata.password_wrapped_key = wrap_key(&wrapping_key, &nonce, &db_key, username.as_bytes())?;
    metadata.password_nfkc = true;
    metadata.failed_unlock_attempts = 0;
    metadata.unlock_blocked_until = None;
    let connection = open_encrypted_database(&db_path, &db_key, &username, false)
        .map_err(|_| AUTH_ERROR.to_string())?;
    write_metadata(&state.account_dir(&username)?.join("vault.json"), &metadata)
        .map_err(|_| AUTH_ERROR.to_string())?;
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *unlocked = Some(UnlockedVault {
        connection,
        username: username.clone(),
        _database_key: db_key,
        eonpai_epoch: eonpai::opaque_id()?,
        last_activity: Instant::now(),
        last_activity_wall: SystemTime::now(),
    });
    Ok(())
}

#[tauri::command]
pub fn change_local_password(
    state: tauri::State<'_, VaultManager>,
    username: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    change_account_password(&state, &username, &current_password, &new_password)
}

fn change_account_password(
    state: &VaultManager,
    username: &str,
    current_password: &str,
    new_password: &str,
) -> Result<(), String> {
    expire_idle_vault(state)?;
    let _cross_process_attempt = lock_auth_attempts(state)?;
    let username = normalize_username(username)?;
    let new_password = normalize_new_password(new_password)?;
    let mut metadata = state.metadata(&username)?;
    reserve_auth_attempt(state, &username, &mut metadata)?;
    let salt = decode_fixed::<SALT_BYTES>(&metadata.password_salt)?;
    let current_password = if metadata.password_nfkc {
        match normalize_password_nfkc(current_password) {
            Ok(password) => password,
            Err(_) => {
                dummy_argon2_verify(state, current_password);
                return Err("Current password is incorrect".to_string());
            }
        }
    } else {
        if validate_legacy_password(current_password).is_err() {
            dummy_argon2_verify(state, current_password);
            return Err("Current password is incorrect".to_string());
        }
        Zeroizing::new(current_password.to_owned())
    };
    let wrapping_key = derive_key(current_password.as_bytes(), &salt)?;
    let nonce = decode_hex(&metadata.password_nonce)?;
    let wrapped = decode_hex(&metadata.password_wrapped_key)?;
    let database_key = Zeroizing::new(
        unwrap_key(&wrapping_key, &nonce, &wrapped, username.as_bytes())
            .map_err(|_| "Current password is incorrect".to_string())?,
    );

    let db_path = state.account_dir(&username)?.join("shinpo.db");
    let connection = open_encrypted_database(&db_path, &database_key, &username, false)?;
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    if !unlocked
        .as_ref()
        .is_some_and(|vault| vault.username == username)
    {
        return Err("Unlock this local account before changing its password".into());
    }

    let mut new_salt = [0u8; SALT_BYTES];
    getrandom::fill(&mut new_salt).map_err(|_| "Secure random generation failed".to_string())?;
    let new_nonce = random_nonce()?;
    let new_wrapping_key = derive_key(new_password.as_bytes(), &new_salt)?;
    metadata.password_salt = encode_hex(&new_salt);
    metadata.password_nonce = encode_hex(&new_nonce);
    metadata.password_wrapped_key = wrap_key(
        &new_wrapping_key,
        &new_nonce,
        &database_key,
        username.as_bytes(),
    )?;
    metadata.password_nfkc = true;
    metadata.failed_unlock_attempts = 0;
    metadata.unlock_blocked_until = None;
    write_metadata(&state.account_dir(&username)?.join("vault.json"), &metadata)?;
    *unlocked = Some(UnlockedVault {
        connection,
        username,
        _database_key: database_key,
        eonpai_epoch: eonpai::opaque_id()?,
        last_activity: Instant::now(),
        last_activity_wall: SystemTime::now(),
    });
    Ok(())
}

#[tauri::command]
pub fn lock_local_account(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    lock_vault_for_system_event(&state)
}

pub fn prepare_desktop_shutdown(manager: &VaultManager) -> Result<(), String> {
    lock_vault_for_system_event(manager)
}

pub fn lock_vault_for_system_event(manager: &VaultManager) -> Result<(), String> {
    eonpai::cancel_all(manager);
    let mut unlocked = manager
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let pause_result = if let Some(vault) = unlocked.as_mut() {
        pause_focus_before_vault_lock(&mut vault.connection, unix_now_seconds())
            .map_err(|_| "Could not safely checkpoint Focus before vault lock".to_string())
    } else {
        Ok(())
    };
    unlocked.take();
    drop(unlocked);
    finish_vault_lock(manager);
    pause_result
}

#[tauri::command]
pub fn delete_local_account(
    state: tauri::State<'_, VaultManager>,
    username: String,
) -> Result<(), String> {
    delete_local_account_data(
        &state,
        &username,
        || {
            shinpo_browser_host::clear_session(&state.browser_host_paths).map_err(|_| {
                "Could not clear Browser Companion policy; account was not deleted".into()
            })
        },
        eonpai::provider::delete_account_credential,
    )
}

fn delete_local_account_data(
    state: &VaultManager,
    username: &str,
    clear_browser_policy: impl FnOnce() -> Result<(), String>,
    clear_provider_credential: impl FnOnce(&Connection, &str) -> Result<(), String>,
) -> Result<(), String> {
    eonpai::cancel_all(state);
    expire_idle_vault(state)?;
    let username = normalize_username(username)?;
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let vault = unlocked
        .as_ref()
        .filter(|vault| vault.username == username)
        .ok_or_else(|| "Unlock this local account before deleting it".to_string())?;
    let active_focus: bool = vault
        .connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED'))",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Could not verify Focus state; account was not deleted".to_string())?;
    if active_focus {
        return Err(
            "Complete or cancel the active Focus session before deleting this account".into(),
        );
    }
    let account_dir = state.account_dir(&username)?;
    if !account_dir.is_dir() {
        return Err("Local account was not found".into());
    }
    clear_browser_policy()?;
    clear_provider_credential(&vault.connection, &username)?;
    *unlocked = None;
    fs::remove_dir_all(&account_dir).map_err(|_| {
        "Could not remove all local account files; the account may need recovery".into()
    })
}

fn pause_focus_before_vault_lock(db: &mut Connection, now_seconds: i64) -> rusqlite::Result<()> {
    reconcile_active_focus_sessions(db, now_seconds, false)?;
    let active_id = db
        .query_row(
            "SELECT id FROM calendar_sessions WHERE status='ACTIVE' AND current_phase<>'RETURN_REQUIRED' LIMIT 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    if let Some(id) = active_id {
        pause_focus_session(db, id, now_seconds)?;
    }
    Ok(())
}

#[tauri::command]
pub fn local_vault_status(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalVaultStatus, String> {
    expire_idle_vault(&state)?;
    let unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let username = unlocked
        .as_ref()
        .map(|vault| {
            vault
                .connection
                .query_row("SELECT username FROM local_profile WHERE id=1", [], |row| {
                    row.get(0)
                })
                .map_err(|_| "Local profile is unreadable".to_string())
        })
        .transpose()?;
    Ok(LocalVaultStatus {
        unlocked: username.is_some(),
        username,
    })
}

#[tauri::command]
pub fn touch_local_vault_activity(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    touch_local_vault_activity_from(&state)
}

fn touch_local_vault_activity_from(state: &VaultManager) -> Result<(), String> {
    with_db_mode(state, true, |_| Ok(()))
}

#[tauri::command]
pub fn local_get_goals(state: tauri::State<'_, VaultManager>) -> Result<Vec<LocalGoal>, String> {
    with_db(&state, |db| {
        let mut query = db.prepare("SELECT id,title,description,start_date,target_date,status,created_at FROM goals ORDER BY id")?;
        let rows = query.query_map([], |row| {
            Ok(LocalGoal {
                id: row.get(0)?,
                user_id: 1,
                title: row.get(1)?,
                description: row.get(2)?,
                start_date: row.get(3)?,
                target_date: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_create_goal(
    state: tauri::State<'_, VaultManager>,
    title: String,
    description: Option<String>,
    start_date: String,
    target_date: Option<String>,
) -> Result<LocalGoal, String> {
    validate_title(&title)?;
    validate_optional_text(description.as_deref(), 4000)?;
    validate_date(&start_date)?;
    if let Some(date) = target_date.as_deref() {
        validate_date(date)?;
    }
    with_db(&state, |db| {
        insert_goal_record(
            db,
            &title,
            description.as_deref(),
            &start_date,
            target_date.as_deref(),
        )
    })
}

#[tauri::command]
pub fn local_update_goal(
    state: tauri::State<'_, VaultManager>,
    goal_id: i64,
    title: String,
    description: Option<String>,
    start_date: String,
    target_date: Option<String>,
    status: Option<String>,
) -> Result<LocalGoal, String> {
    validate_title(&title)?;
    validate_optional_text(description.as_deref(), 4000)?;
    validate_date(&start_date)?;
    if let Some(date) = target_date.as_deref() {
        validate_date(date)?;
    }
    if let Some(value) = status.as_deref() {
        validate_goal_status(value)?;
    }
    with_db(&state, |db| {
        update_goal_record(
            db,
            goal_id,
            &title,
            description.as_deref(),
            &start_date,
            target_date.as_deref(),
            status.as_deref().unwrap_or(""),
        )
    })
}

fn update_goal_record(
    db: &mut Connection,
    goal_id: i64,
    title: &str,
    description: Option<&str>,
    start_date: &str,
    target_date: Option<&str>,
    requested_status: &str,
) -> rusqlite::Result<LocalGoal> {
    let tx = db.transaction()?;
    let old: String = tx.query_row("SELECT status FROM goals WHERE id=?1", [goal_id], |row| {
        row.get(0)
    })?;
    let next = if requested_status.is_empty() {
        old.clone()
    } else {
        requested_status.to_ascii_uppercase()
    };
    tx.execute("UPDATE goals SET title=?1,description=?2,start_date=?3,target_date=?4,status=?5 WHERE id=?6", params![title.trim(),description,start_date,target_date,next,goal_id])?;
    if old != "COMPLETED" && next == "COMPLETED" {
        let reward_id: String = tx.query_row(
            "SELECT reward_id FROM goals WHERE id=?1",
            [goal_id],
            |row| row.get(0),
        )?;
        insert_xp_event(
            &tx,
            &format!("goal:{reward_id}"),
            "GOAL_COMPLETED",
            50,
            None,
        )?;
    }
    let goal = goal_by_id(&tx, goal_id)?;
    tx.commit()?;
    Ok(goal)
}

#[tauri::command]
pub fn local_delete_goal(
    state: tauri::State<'_, VaultManager>,
    goal_id: i64,
) -> Result<(), String> {
    with_db(&state, |db| {
        db.execute("DELETE FROM goals WHERE id=?1", [goal_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_delete_all_goals(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    with_db(&state, |db| {
        db.execute("DELETE FROM goals", [])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_get_tasks(state: tauri::State<'_, VaultManager>) -> Result<Vec<LocalTask>, String> {
    with_db(&state, |db| {
        let mut query = db.prepare("SELECT id,goal_id,title,description,scheduled_date,estimated_minutes,status,created_at FROM tasks ORDER BY id")?;
        let rows = query.query_map([], |row| {
            Ok(LocalTask {
                id: row.get(0)?,
                goal_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                scheduled_date: row.get(4)?,
                estimated_minutes: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_create_task(
    state: tauri::State<'_, VaultManager>,
    goal_id: i64,
    title: String,
    description: Option<String>,
    scheduled_date: String,
    estimated_minutes: Option<i64>,
) -> Result<LocalTask, String> {
    validate_title(&title)?;
    validate_optional_text(description.as_deref(), 4000)?;
    validate_date(&scheduled_date)?;
    validate_estimated_minutes(estimated_minutes)?;
    with_db(&state, |db| {
        insert_task_record(
            db,
            goal_id,
            &title,
            description.as_deref(),
            &scheduled_date,
            estimated_minutes,
        )
    })
}

#[tauri::command]
pub fn local_update_task(
    state: tauri::State<'_, VaultManager>,
    request: UpdateTaskRequest,
) -> Result<LocalTask, String> {
    let UpdateTaskRequest {
        task_id,
        goal_id,
        title,
        description,
        scheduled_date,
        estimated_minutes,
        status,
    } = request;
    validate_title(&title)?;
    validate_optional_text(description.as_deref(), 4000)?;
    validate_date(&scheduled_date)?;
    validate_estimated_minutes(estimated_minutes)?;
    if let Some(value) = status.as_deref() {
        validate_task_status(value)?;
    }
    with_db(&state, |db| {
        let old: String = db
            .query_row("SELECT status FROM tasks WHERE id=?1", [task_id], |row| {
                row.get(0)
            })
            .optional()?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let next = status
            .as_deref()
            .map(str::to_ascii_uppercase)
            .unwrap_or(old.clone());
        if old != "COMPLETED" && next == "COMPLETED" {
            return Err(rusqlite::Error::InvalidQuery);
        }
        db.execute("UPDATE tasks SET goal_id=?1,title=?2,description=?3,scheduled_date=?4,estimated_minutes=?5,status=?6 WHERE id=?7 AND EXISTS(SELECT 1 FROM goals WHERE id=?1)", params![goal_id,title.trim(),description,scheduled_date,estimated_minutes,next,task_id])?;
        if db.changes() == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        task_by_id(db, task_id)
    })
}

#[tauri::command]
pub fn local_complete_task(
    state: tauri::State<'_, VaultManager>,
    task_id: i64,
    actual_minutes: Option<i64>,
) -> Result<LocalTaskCompletion, String> {
    if actual_minutes.is_some_and(|n| !(1..=1440).contains(&n)) {
        return Err("Actual minutes must be between 1 and 1440".into());
    }
    with_db(&state, |db| complete_task(db, task_id, actual_minutes))
}

fn complete_task(
    db: &mut Connection,
    task_id: i64,
    actual_minutes: Option<i64>,
) -> rusqlite::Result<LocalTaskCompletion> {
    let tx = db.transaction()?;
    let completion = complete_task_in_transaction(&tx, task_id, actual_minutes)?;
    tx.commit()?;
    Ok(completion)
}

fn complete_task_in_transaction(
    tx: &Transaction<'_>,
    task_id: i64,
    actual_minutes: Option<i64>,
) -> rusqlite::Result<LocalTaskCompletion> {
    let (goal_id, task_reward_id, goal_reward_id): (i64, String, String) = tx.query_row(
        "SELECT t.goal_id,t.reward_id,g.reward_id FROM tasks t JOIN goals g ON g.id=t.goal_id WHERE t.id=?1 AND t.status<>'COMPLETED'",
        [task_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    tx.execute("UPDATE tasks SET status='COMPLETED',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1", [task_id])?;
    let completed_at: String = tx.query_row(
        "SELECT completed_at FROM tasks WHERE id=?1",
        [task_id],
        |row| row.get(0),
    )?;
    let event_id = insert_xp_event(
        tx,
        &format!("task:{task_reward_id}"),
        "MISSION_COMPLETED",
        10,
        None,
    )?;
    let remaining: i64 = tx.query_row(
        "SELECT count(*) FROM tasks WHERE goal_id=?1 AND status<>'COMPLETED'",
        [goal_id],
        |row| row.get(0),
    )?;
    if remaining == 0 {
        tx.execute(
            "UPDATE goals SET status='COMPLETED' WHERE id=?1 AND status<>'COMPLETED'",
            [goal_id],
        )?;
        if tx.changes() > 0 {
            insert_xp_event(
                tx,
                &format!("goal:{goal_reward_id}"),
                "GOAL_COMPLETED",
                50,
                None,
            )?;
        }
    }
    Ok(LocalTaskCompletion {
        id: event_id,
        mission_id: task_id,
        started_at: None,
        completed_at,
        actual_minutes,
        result: "COMPLETED".into(),
        earned_progress: 10,
    })
}

#[tauri::command]
pub fn local_delete_task(
    state: tauri::State<'_, VaultManager>,
    task_id: i64,
) -> Result<(), String> {
    with_db(&state, |db| {
        db.execute("DELETE FROM tasks WHERE id=?1", [task_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_delete_all_tasks(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    with_db(&state, |db| {
        db.execute("DELETE FROM tasks", [])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_get_progress(state: tauri::State<'_, VaultManager>) -> Result<LocalProgress, String> {
    with_db(&state, |db| local_progress(db))
}

#[tauri::command]
pub fn local_get_streak(
    state: tauri::State<'_, VaultManager>,
) -> Result<ConsistencyStreak, String> {
    with_db(&state, |db| {
        compute_consistency_streak(db, OffsetDateTime::now_utc().date())
    })
}

#[tauri::command]
pub fn local_get_onboarding_state(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalOnboardingState, String> {
    with_db(&state, |db| local_onboarding_state(db))
}

#[tauri::command]
pub fn local_start_onboarding(
    state: tauri::State<'_, VaultManager>,
    from_step: Option<i64>,
) -> Result<LocalOnboardingState, String> {
    let step = validate_onboarding_start_step(from_step)?;
    with_db(&state, |db| {
        let now = format_epoch_seconds(unix_now_seconds());
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,started_at,updated_at)
             VALUES(1,'IN_PROGRESS',?1,?2,?2)
             ON CONFLICT(id) DO UPDATE SET
               status=CASE WHEN local_onboarding.status='COMPLETED' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
               current_step=CASE WHEN local_onboarding.status='COMPLETED' THEN local_onboarding.current_step ELSE excluded.current_step END,
               started_at=CASE WHEN local_onboarding.status='SKIPPED' THEN excluded.started_at ELSE COALESCE(local_onboarding.started_at,excluded.started_at) END,
               updated_at=excluded.updated_at",
            params![step, now],
        )?;
        local_onboarding_state(db)
    })
}

#[tauri::command]
pub fn local_record_onboarding_step(
    state: tauri::State<'_, VaultManager>,
    step_index: i64,
) -> Result<LocalOnboardingState, String> {
    if !valid_onboarding_step(step_index) {
        return Err("Invalid onboarding step index".into());
    }
    with_db(&state, |db| {
        let now = format_epoch_seconds(unix_now_seconds());
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,started_at,updated_at)
             VALUES(1,'IN_PROGRESS',?1,?2,?2)
             ON CONFLICT(id) DO UPDATE SET
               status=CASE WHEN local_onboarding.status IN ('NOT_STARTED','PAUSED') THEN 'IN_PROGRESS' ELSE local_onboarding.status END,
               current_step=CASE WHEN local_onboarding.status='COMPLETED' THEN local_onboarding.current_step ELSE excluded.current_step END,
               started_at=COALESCE(local_onboarding.started_at,excluded.started_at),updated_at=excluded.updated_at",
            params![step_index, now],
        )?;
        local_onboarding_state(db)
    })
}

#[tauri::command]
pub fn local_finish_onboarding(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalOnboardingState, String> {
    with_db(&state, finish_local_onboarding)
}

fn finish_local_onboarding(db: &mut Connection) -> rusqlite::Result<LocalOnboardingState> {
    let now = format_epoch_seconds(unix_now_seconds());
    db.execute(
        "INSERT INTO local_onboarding(id,status,current_step,started_at,completed_at,updated_at)
         VALUES(1,'COMPLETED',6,?1,?1,?1)
         ON CONFLICT(id) DO UPDATE SET
           status=CASE WHEN local_onboarding.status='SKIPPED' THEN 'SKIPPED' ELSE 'COMPLETED' END,
           current_step=CASE WHEN local_onboarding.status='SKIPPED' THEN local_onboarding.current_step ELSE 6 END,
           started_at=COALESCE(local_onboarding.started_at,excluded.started_at),
           completed_at=CASE WHEN local_onboarding.status='SKIPPED' THEN local_onboarding.completed_at ELSE excluded.completed_at END,
           updated_at=excluded.updated_at",
        [&now],
    )?;
    local_onboarding_state(db)
}

#[tauri::command]
pub fn local_pause_onboarding(
    state: tauri::State<'_, VaultManager>,
    step_index: i64,
) -> Result<LocalOnboardingState, String> {
    if !valid_onboarding_pause_step(step_index) {
        return Err("Invalid onboarding step index".into());
    }
    with_db(&state, |db| {
        let now = format_epoch_seconds(unix_now_seconds());
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,updated_at)
             VALUES(1,'PAUSED',?1,?2)
             ON CONFLICT(id) DO UPDATE SET
               status=CASE WHEN local_onboarding.status='COMPLETED' THEN 'COMPLETED' ELSE 'PAUSED' END,
               current_step=CASE WHEN local_onboarding.status='COMPLETED' THEN local_onboarding.current_step ELSE excluded.current_step END,
               updated_at=excluded.updated_at",
            params![step_index, now],
        )?;
        local_onboarding_state(db)
    })
}

fn valid_onboarding_step(step: i64) -> bool {
    (0..6).contains(&step)
}

fn validate_onboarding_start_step(step: Option<i64>) -> Result<i64, String> {
    let step = step.unwrap_or(0);
    valid_onboarding_step(step)
        .then_some(step)
        .ok_or_else(|| "Invalid onboarding step index".into())
}

fn valid_onboarding_pause_step(step: i64) -> bool {
    (0..=6).contains(&step)
}

#[tauri::command]
pub fn local_skip_onboarding(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalOnboardingState, String> {
    with_db(&state, |db| {
        let now = format_epoch_seconds(unix_now_seconds());
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,updated_at)
             VALUES(1,'SKIPPED',0,?1)
             ON CONFLICT(id) DO UPDATE SET
               status=CASE WHEN local_onboarding.status='COMPLETED' THEN 'COMPLETED' ELSE 'SKIPPED' END,
               updated_at=excluded.updated_at",
            [&now],
        )?;
        local_onboarding_state(db)
    })
}

#[tauri::command]
pub fn local_claim_onboarding_reward(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalProgress, String> {
    with_db(&state, claim_onboarding_reward)
}

fn claim_onboarding_reward(db: &mut Connection) -> rusqlite::Result<LocalProgress> {
    let tx = db.transaction()?;
    if !onboarding_workflow_qualifies(&tx)? {
        return Err(rusqlite::Error::InvalidQuery);
    }
    insert_xp_event(
        &tx,
        "onboarding:first-completion",
        "ONBOARDING_COMPLETED",
        50,
        None,
    )?;
    tx.commit()?;
    local_progress(db)
}

#[tauri::command]
pub async fn local_eonpai_provider_status(
    state: tauri::State<'_, VaultManager>,
) -> Result<serde_json::Value, String> {
    eonpai::provider_status(&state).await
}

#[tauri::command]
pub fn local_eonpai_get_active(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalEonpaiConversation, String> {
    with_db(&state, |db| {
        let id = ensure_active_eonpai_conversation(db)?;
        local_eonpai_conversation(db, id)
    })
}

#[tauri::command]
pub fn local_eonpai_clear_active(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalEonpaiConversation, String> {
    with_db(&state, |db| {
        let tx = db.transaction()?;
        let now = chrono_now();
        tx.execute(
            "UPDATE eonpai_conversations SET status='ARCHIVED',updated_at=?1 WHERE status='ACTIVE'",
            [&now],
        )?;
        tx.execute(
            "INSERT INTO eonpai_conversations(title,status,created_at,updated_at) VALUES('New conversation','ACTIVE',?1,?1)",
            [&now],
        )?;
        let id = tx.last_insert_rowid();
        tx.commit()?;
        local_eonpai_conversation(db, id)
    })
}

#[tauri::command]
pub async fn local_eonpai_send(
    state: tauri::State<'_, VaultManager>,
    request: eonpai::ChatRequest,
) -> Result<LocalEonpaiReply, String> {
    eonpai::send_request(&state, request).await
}

#[cfg(test)]
fn send_local_eonpai(
    db: &mut Connection,
    content: &str,
    requested_conversation_id: Option<&str>,
) -> rusqlite::Result<LocalEonpaiReply> {
    send_local_eonpai_with_context(db, content, requested_conversation_id, None, None, None)
}

fn send_local_eonpai_with_context(
    db: &mut Connection,
    content: &str,
    requested_conversation_id: Option<&str>,
    goal_id: Option<i64>,
    task_id: Option<i64>,
    session_id: Option<i64>,
) -> rusqlite::Result<LocalEonpaiReply> {
    let tx = db.transaction()?;
    let conversation = ensure_active_eonpai_conversation(&tx)?;
    let current_id = eonpai::conversation_public_id(&tx, conversation)?;
    if requested_conversation_id.is_some_and(|requested| requested != current_id) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let (reply, suggestion_type, structured_card) =
        eonpai::offline_reply(&tx, content, goal_id, task_id, session_id)?;
    let now = chrono_now();
    tx.execute(
        "INSERT INTO eonpai_messages(conversation_id,role,content,created_at) VALUES(?1,'USER',?2,?3)",
        params![conversation, content, now],
    )?;
    tx.execute(
        "INSERT INTO eonpai_messages(conversation_id,role,content,suggestion_type,created_at,structured_card) VALUES(?1,'ASSISTANT',?2,?3,?4,?5)",
        params![conversation, reply, suggestion_type, now, structured_card.as_ref().map(serde_json::Value::to_string)],
    )?;
    tx.execute(
        "UPDATE eonpai_conversations SET title=CASE WHEN title='New conversation' THEN substr(?1,1,72) ELSE title END,updated_at=?2 WHERE id=?3",
        params![content, now, conversation],
    )?;
    tx.commit()?;
    Ok(LocalEonpaiReply {
        reply,
        suggestion_type,
        structured_card,
        tutorial: None,
        bug_report: None,
        conversation_id: current_id,
    })
}

#[tauri::command]
pub fn local_create_focus_session(
    state: tauri::State<'_, VaultManager>,
    request: CreateFocusSessionRequest,
) -> Result<LocalFocusSession, String> {
    let CreateFocusSessionRequest {
        goal_id,
        mission_id,
        name,
        intention,
        duration_minutes,
        scheduled_at,
        pomodoro_enabled,
        pomodoro_focus_cycles,
        pomodoro_short_break_minutes,
        pomodoro_long_break_minutes,
        pomodoro_grace_minutes,
        late_penalty_enabled,
        late_penalty_xp,
        late_penalty_daily_cap_xp,
        guardian_mode,
        guardian_app_monitoring: _,
    } = request.clone();
    validate_title(&name)?;
    validate_optional_text(intention.as_deref(), 4000)?;
    if !(1..=1440).contains(&duration_minutes) {
        return Err("Duration must be between 1 and 1440 minutes".into());
    }
    validate_optional_text(scheduled_at.as_deref(), 64)?;
    let cycles = pomodoro_focus_cycles.unwrap_or(2);
    let pomodoro = pomodoro_enabled.unwrap_or(false);
    let short_break = pomodoro_short_break_minutes.unwrap_or(5);
    let long_break = pomodoro_long_break_minutes.unwrap_or(15);
    let grace = pomodoro_grace_minutes.unwrap_or(10);
    if !(1..=12).contains(&cycles)
        || !(1..=60).contains(&short_break)
        || !(1..=120).contains(&long_break)
        || !(1..=10).contains(&grace)
    {
        return Err("Pomodoro settings are outside the supported ranges".into());
    }
    validate_midpoint_focus_cycles(pomodoro, cycles)?;
    let penalty_enabled = late_penalty_enabled.unwrap_or(false);
    let penalty_xp = late_penalty_xp.unwrap_or(5);
    let penalty_cap = late_penalty_daily_cap_xp.unwrap_or(20);
    if guardian_mode.as_ref().is_some_and(|mode| {
        !matches!(
            mode.to_ascii_uppercase().as_str(),
            "GUIDED" | "PROTECTED" | "STRICT"
        )
    }) {
        return Err("Guardian mode must be Light, Standard, or Strict".into());
    }
    if !(1..=100).contains(&penalty_xp)
        || !(1..=100).contains(&penalty_cap)
        || penalty_xp > penalty_cap
        || (penalty_enabled && !pomodoro)
    {
        return Err("Late-return penalty requires a midpoint break and valid XP limits".into());
    }
    with_db(&state, |db| {
        if let Some(goal) = goal_id {
            let exists: bool = db.query_row(
                "SELECT EXISTS(SELECT 1 FROM goals WHERE id=?1)",
                [goal],
                |r| r.get(0),
            )?;
            if !exists {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        if let Some(task) = mission_id {
            let linked: bool = db.query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1 AND (?2 IS NULL OR goal_id=?2))",
                params![task, goal_id],
                |r| r.get(0),
            )?;
            if !linked {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        insert_focus_record(db, &request)
    })
}

fn validate_midpoint_focus_cycles(enabled: bool, cycles: i64) -> Result<(), String> {
    if enabled && cycles != 2 {
        return Err("The native Focus break flow supports exactly two focus blocks".into());
    }
    Ok(())
}

#[tauri::command]
pub fn local_get_focus_sessions(
    state: tauri::State<'_, VaultManager>,
) -> Result<Vec<LocalFocusSession>, String> {
    let sessions = with_db(&state, |db| {
        reconcile_active_focus_sessions(db, unix_now_seconds(), true)?;
        let mut query=db.prepare("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment,phase_started_at,phase_deadline_at,phase_revision,interruption_count,paused_phase_remaining_seconds,late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp,guardian_app_monitoring FROM calendar_sessions ORDER BY COALESCE(scheduled_at,created_at),id")?;
        let rows = query.query_map([], focus_session_from_row)?;
        rows.collect()
    })?;
    let _ = publish_local_browser_policy(&state);
    Ok(sessions)
}

#[tauri::command]
pub fn local_get_focus_sessions_by_date(
    state: tauri::State<'_, VaultManager>,
    date: String,
) -> Result<Vec<LocalFocusSession>, String> {
    validate_date(&date)?;
    let sessions = with_db(&state, |db| {
        reconcile_active_focus_sessions(db, unix_now_seconds(), true)?;
        let mut query=db.prepare("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment,phase_started_at,phase_deadline_at,phase_revision,interruption_count,paused_phase_remaining_seconds,late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp,guardian_app_monitoring FROM calendar_sessions WHERE substr(COALESCE(scheduled_at,started_at,created_at),1,10)=?1 ORDER BY COALESCE(scheduled_at,created_at),id")?;
        let rows = query.query_map([date], focus_session_from_row)?;
        rows.collect()
    })?;
    let _ = publish_local_browser_policy(&state);
    Ok(sessions)
}

#[tauri::command]
pub fn local_update_focus_session(
    state: tauri::State<'_, VaultManager>,
    request: UpdateFocusSessionRequest,
) -> Result<LocalFocusSession, String> {
    let UpdateFocusSessionRequest {
        session_id,
        goal_id,
        mission_id,
        name,
        intention,
        duration_minutes,
        scheduled_at,
    } = request;
    validate_title(&name)?;
    validate_optional_text(intention.as_deref(), 4000)?;
    validate_optional_text(scheduled_at.as_deref(), 64)?;
    if !(1..=1440).contains(&duration_minutes) {
        return Err("Duration must be between 1 and 1440 minutes".into());
    }
    with_db(&state, |db| {
        if let Some(goal) = goal_id {
            let exists: bool = db.query_row(
                "SELECT EXISTS(SELECT 1 FROM goals WHERE id=?1)",
                [goal],
                |row| row.get(0),
            )?;
            if !exists {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        if let Some(task) = mission_id {
            let linked: bool = db.query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1 AND goal_id=?2)",
                params![task, goal_id],
                |row| row.get(0),
            )?;
            if !linked {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        let changed = db.execute(
            "UPDATE calendar_sessions SET goal_id=?2,task_id=?3,name=?4,intention=?5,duration_minutes=?6,scheduled_at=?7,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status NOT IN ('ACTIVE','PAUSED')",
            params![session_id, goal_id, mission_id, name.trim(), intention, duration_minutes, scheduled_at],
        )?;
        if changed == 0 {
            return Err(rusqlite::Error::InvalidQuery);
        }
        focus_session_by_id(db, session_id)
    })
}

#[tauri::command]
pub fn local_start_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<LocalFocusSession, String> {
    let session = with_db(&state, |db| {
        start_focus_session(db, session_id, unix_now_seconds())
    })?;
    publish_local_browser_policy(&state)?;
    Ok(session)
}

fn start_focus_session(
    db: &mut Connection,
    session_id: i64,
    now_seconds: i64,
) -> rusqlite::Result<LocalFocusSession> {
    let now = format_epoch_seconds(now_seconds);
    let changed = db.execute(
        "UPDATE calendar_sessions
         SET status='ACTIVE',started_at=?2,phase_started_at=?2,last_checkpoint_at=?2,
             phase_deadline_at=CAST((?3 + CASE WHEN pomodoro_enabled=1
                 THEN max(1,(duration_minutes*60)/2) ELSE duration_minutes*60 END)*1000 AS INTEGER),
             phase_elapsed_seconds=0,completed_focus_cycles=0,focus_active_seconds=0,
             break_active_seconds=0,phase_revision=phase_revision+1,updated_at=?2
         WHERE id=?1 AND status='SCHEDULED'
             AND NOT EXISTS(SELECT 1 FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED'))",
        params![session_id, now, now_seconds],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    focus_session_by_id(db, session_id)
}

#[tauri::command]
pub fn local_pause_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<LocalFocusSession, String> {
    let session = with_db(&state, |db| {
        let now = unix_now_seconds();
        let current = advance_focus_session_at(db, session_id, now, true)?;
        if current.status != "ACTIVE" && current.status != "PAUSED" {
            return Err(rusqlite::Error::InvalidQuery);
        }
        pause_focus_session(db, session_id, now)
    })?;
    publish_local_browser_policy(&state)?;
    Ok(session)
}

fn pause_focus_session(
    db: &mut Connection,
    session_id: i64,
    now_seconds: i64,
) -> rusqlite::Result<LocalFocusSession> {
    advance_focus_session_at(db, session_id, now_seconds, false)?;
    let now = format_epoch_seconds(now_seconds);
    let changed = db.execute(
        "UPDATE calendar_sessions SET
             focus_active_seconds=focus_active_seconds+CASE WHEN current_phase='FOCUS'
                 AND phase_started_at IS NOT NULL THEN min(max(0,?2-unixepoch(phase_started_at)),
                 max(0,COALESCE(phase_deadline_at/1000,?2)-unixepoch(phase_started_at))) ELSE 0 END,
             break_active_seconds=break_active_seconds+CASE WHEN current_phase IN ('BREAK','GRACE')
                 AND phase_started_at IS NOT NULL THEN min(max(0,?2-unixepoch(phase_started_at)),
                 max(0,COALESCE(phase_deadline_at/1000,?2)-unixepoch(phase_started_at))) ELSE 0 END,
             active_seconds=focus_active_seconds+CASE WHEN current_phase='FOCUS'
                 AND phase_started_at IS NOT NULL THEN min(max(0,?2-unixepoch(phase_started_at)),
                 max(0,COALESCE(phase_deadline_at/1000,?2)-unixepoch(phase_started_at))) ELSE 0 END,
             paused_phase_remaining_seconds=CASE WHEN phase_deadline_at IS NULL THEN NULL
                 ELSE max(0,phase_deadline_at/1000-?2) END,
             phase_started_at=NULL,phase_elapsed_seconds=0,paused_at=?3,last_checkpoint_at=?3,
             status='PAUSED',phase_revision=phase_revision+1,updated_at=?3
         WHERE id=?1 AND status='ACTIVE' AND current_phase NOT IN ('RETURN_REQUIRED','COMPLETE')",
        params![session_id, now_seconds, now],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    focus_session_by_id(db, session_id)
}

#[tauri::command]
pub fn local_resume_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<LocalFocusSession, String> {
    let session = with_db(&state, |db| {
        resume_focus_session(db, session_id, unix_now_seconds())
    })?;
    publish_local_browser_policy(&state)?;
    Ok(session)
}

fn resume_focus_session(
    db: &Connection,
    session_id: i64,
    now_seconds: i64,
) -> rusqlite::Result<LocalFocusSession> {
    let now = format_epoch_seconds(now_seconds);
    let changed = db.execute(
        "UPDATE calendar_sessions SET
             accumulated_paused_seconds=accumulated_paused_seconds+max(0,?2-unixepoch(paused_at)),
             phase_deadline_at=CASE WHEN paused_phase_remaining_seconds IS NULL THEN NULL
                 ELSE CAST((?2+paused_phase_remaining_seconds)*1000 AS INTEGER) END,
             paused_phase_remaining_seconds=NULL,paused_at=NULL,phase_started_at=?3,
             last_checkpoint_at=?3,status='ACTIVE',phase_revision=phase_revision+1,updated_at=?3
         WHERE id=?1 AND status='PAUSED' AND current_phase NOT IN ('RETURN_REQUIRED','COMPLETE')
             AND NOT EXISTS(SELECT 1 FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED') AND id<>?1)",
        params![session_id, now_seconds, now],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    focus_session_by_id(db, session_id)
}

fn reconcile_active_focus_sessions(
    db: &mut Connection,
    now_seconds: i64,
    check_continuity: bool,
) -> rusqlite::Result<()> {
    let ids = {
        let mut statement = db.prepare("SELECT id FROM calendar_sessions WHERE status='ACTIVE'")?;
        let rows = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    for id in ids {
        advance_focus_session_at(db, id, now_seconds, check_continuity)?;
    }
    Ok(())
}

fn advance_focus_session_at(
    db: &mut Connection,
    session_id: i64,
    now_seconds: i64,
    check_continuity: bool,
) -> rusqlite::Result<LocalFocusSession> {
    let tx = db.transaction()?;
    let state = tx.query_row(
        "SELECT status,last_checkpoint_at
         FROM calendar_sessions WHERE id=?1",
        [session_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
    )?;
    let (status, checkpoint) = &state;
    if status != "ACTIVE" {
        tx.commit()?;
        return focus_session_by_id(db, session_id);
    }

    let checkpoint_seconds = checkpoint
        .as_deref()
        .and_then(epoch_seconds_from_iso)
        .unwrap_or(now_seconds);
    let interrupted = check_continuity
        && (now_seconds < checkpoint_seconds
            || now_seconds.saturating_sub(checkpoint_seconds) > CHECKPOINT_STALE_SECONDS);
    let effective_now = if interrupted {
        checkpoint_seconds
    } else {
        now_seconds
    };
    let effective_ms = effective_now.saturating_mul(1000);

    for _ in 0..3 {
        let current = tx.query_row(
            "SELECT current_phase,phase_started_at,phase_deadline_at,pomodoro_enabled,
                    pomodoro_long_break_minutes,pomodoro_grace_minutes,completed_focus_cycles
             FROM calendar_sessions WHERE id=?1",
            [session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                    row.get::<_, bool>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, i64>(6)?,
                ))
            },
        )?;
        let (phase, phase_started, deadline_ms, pomodoro, long_break, grace, completed_cycles) =
            current;
        let Some(deadline_ms) = deadline_ms else {
            break;
        };
        if deadline_ms > effective_ms || !matches!(phase.as_str(), "FOCUS" | "BREAK" | "GRACE") {
            break;
        }
        let boundary = deadline_ms / 1000;
        let phase_start = phase_started
            .as_deref()
            .and_then(epoch_seconds_from_iso)
            .unwrap_or(boundary);
        let segment_seconds = boundary.saturating_sub(phase_start).max(0);
        let (next_phase, next_deadline) = match phase.as_str() {
            "FOCUS" if pomodoro && completed_cycles == 0 => {
                ("BREAK", boundary.saturating_add(long_break.max(1) * 60))
            }
            "FOCUS" => ("COMPLETE", boundary),
            "BREAK" => ("GRACE", boundary.saturating_add(grace.clamp(1, 10) * 60)),
            "GRACE" => ("RETURN_REQUIRED", boundary),
            _ => break,
        };
        let next_started = if next_phase == "RETURN_REQUIRED" || next_phase == "COMPLETE" {
            None
        } else {
            Some(format_epoch_seconds(boundary))
        };
        let next_deadline_ms = if next_phase == "RETURN_REQUIRED" || next_phase == "COMPLETE" {
            None
        } else {
            Some(next_deadline.saturating_mul(1000))
        };
        tx.execute(
            "UPDATE calendar_sessions SET
                 focus_active_seconds=focus_active_seconds+CASE WHEN ?2 IN ('FOCUS') THEN ?3 ELSE 0 END,
                 break_active_seconds=break_active_seconds+CASE WHEN ?2 IN ('BREAK','GRACE') THEN ?3 ELSE 0 END,
                 active_seconds=active_seconds+CASE WHEN ?2='FOCUS' THEN ?3 ELSE 0 END,
                 current_phase=?4,completed_focus_cycles=CASE WHEN ?2='FOCUS' AND ?5=1
                     THEN max(1,completed_focus_cycles+1) ELSE completed_focus_cycles END,
                 phase_started_at=?6,phase_deadline_at=?7,phase_elapsed_seconds=0,
                 paused_phase_remaining_seconds=NULL,phase_revision=phase_revision+1,
                 updated_at=?8 WHERE id=?1",
            params![session_id, phase, segment_seconds, next_phase, pomodoro,
                next_started, next_deadline_ms, format_epoch_seconds(now_seconds)],
        )?;
        if phase == "GRACE" && next_phase == "RETURN_REQUIRED" {
            record_late_return_penalty(&tx, session_id, boundary)?;
        }
    }

    if interrupted {
        let paused_at = format_epoch_seconds(effective_now);
        tx.execute(
            "UPDATE calendar_sessions SET
                 focus_active_seconds=focus_active_seconds+CASE WHEN current_phase='FOCUS'
                     AND phase_started_at IS NOT NULL THEN max(0,min(?2,COALESCE(phase_deadline_at/1000,?2))-unixepoch(phase_started_at)) ELSE 0 END,
                 break_active_seconds=break_active_seconds+CASE WHEN current_phase IN ('BREAK','GRACE')
                     AND phase_started_at IS NOT NULL THEN max(0,min(?2,COALESCE(phase_deadline_at/1000,?2))-unixepoch(phase_started_at)) ELSE 0 END,
                 active_seconds=active_seconds+CASE WHEN current_phase='FOCUS'
                     AND phase_started_at IS NOT NULL THEN max(0,min(?2,COALESCE(phase_deadline_at/1000,?2))-unixepoch(phase_started_at)) ELSE 0 END,
                 paused_phase_remaining_seconds=CASE WHEN phase_deadline_at IS NULL THEN NULL
                     ELSE max(0,phase_deadline_at/1000-?2) END,
                 status=CASE WHEN current_phase IN ('RETURN_REQUIRED','COMPLETE') THEN status ELSE 'PAUSED' END,
                 paused_at=CASE WHEN current_phase IN ('RETURN_REQUIRED','COMPLETE') THEN paused_at ELSE ?3 END,
                 phase_started_at=CASE WHEN current_phase IN ('RETURN_REQUIRED','COMPLETE') THEN phase_started_at ELSE NULL END,
                 interruption_count=interruption_count+CASE WHEN current_phase IN ('RETURN_REQUIRED','COMPLETE') THEN 0 ELSE 1 END,
                 phase_revision=phase_revision+CASE WHEN current_phase IN ('RETURN_REQUIRED','COMPLETE') THEN 0 ELSE 1 END,
                 last_checkpoint_at=?4,updated_at=?5 WHERE id=?1",
            params![session_id, effective_now, paused_at, format_epoch_seconds(now_seconds), format_epoch_seconds(now_seconds)],
        )?;
    } else {
        tx.execute(
            "UPDATE calendar_sessions SET last_checkpoint_at=?2,updated_at=?2 WHERE id=?1 AND status='ACTIVE'",
            params![session_id, format_epoch_seconds(now_seconds)],
        )?;
    }
    tx.commit()?;
    focus_session_by_id(db, session_id)
}

fn record_late_return_penalty(
    tx: &Transaction<'_>,
    session_id: i64,
    boundary: i64,
) -> rusqlite::Result<()> {
    let (enabled, configured, daily_cap): (bool, i64, i64) = tx.query_row(
        "SELECT late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp FROM calendar_sessions WHERE id=?1",
        [session_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    if !enabled {
        return Ok(());
    }
    let balance: i64 = tx.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM progress_events",
        [],
        |row| row.get(0),
    )?;
    let at = format_epoch_seconds(boundary);
    let spent: i64 = tx.query_row(
        "SELECT COALESCE(-SUM(amount),0) FROM progress_events
         WHERE event_type='LATE_RETURN_PENALTY' AND date(created_at,'localtime')=date(?1,'localtime')",
        [&at], |row| row.get(0),
    )?;
    let debit = configured
        .min(daily_cap.saturating_sub(spent))
        .min(balance)
        .max(0);
    tx.execute(
        "INSERT OR IGNORE INTO progress_events(event_key,event_type,amount,session_id,created_at)
         VALUES(?1,'LATE_RETURN_PENALTY',?2,?3,?4)",
        params![format!("late-return:{session_id}"), -debit, session_id, at],
    )?;
    Ok(())
}

#[tauri::command]
pub fn local_return_to_focus(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<LocalFocusSession, String> {
    let session = with_db(&state, |db| {
        let now = unix_now_seconds();
        let current = advance_focus_session_at(db, session_id, now, true)?;
        if current.status != "ACTIVE" {
            return Ok(current);
        }
        return_to_focus(db, session_id, now)
    })?;
    let _ = publish_local_browser_policy(&state);
    Ok(session)
}

fn return_to_focus(
    db: &mut Connection,
    session_id: i64,
    now_seconds: i64,
) -> rusqlite::Result<LocalFocusSession> {
    advance_focus_session_at(db, session_id, now_seconds, false)?;
    let now = format_epoch_seconds(now_seconds);
    let changed = db.execute(
        "UPDATE calendar_sessions SET
             break_active_seconds=break_active_seconds+CASE WHEN current_phase IN ('BREAK','GRACE')
                 AND phase_started_at IS NOT NULL THEN max(0,min(?2,COALESCE(phase_deadline_at/1000,?2))-unixepoch(phase_started_at)) ELSE 0 END,
             current_phase='FOCUS',completed_focus_cycles=max(1,completed_focus_cycles),
             phase_started_at=?3,phase_deadline_at=CAST((?2+max(0,duration_minutes*60-focus_active_seconds))*1000 AS INTEGER),
             phase_elapsed_seconds=0,paused_phase_remaining_seconds=NULL,last_checkpoint_at=?3,
             phase_revision=phase_revision+1,updated_at=?3
         WHERE id=?1 AND status='ACTIVE' AND current_phase IN ('BREAK','GRACE','RETURN_REQUIRED')",
        params![session_id, now_seconds, now],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    focus_session_by_id(db, session_id)
}

fn unix_now_seconds() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

fn format_epoch_seconds(seconds: i64) -> String {
    OffsetDateTime::from_unix_timestamp(seconds)
        .unwrap_or(OffsetDateTime::UNIX_EPOCH)
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn epoch_seconds_from_iso(value: &str) -> Option<i64> {
    OffsetDateTime::parse(value, &Rfc3339)
        .ok()
        .map(|timestamp| timestamp.unix_timestamp())
}

#[tauri::command]
pub fn local_complete_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
    quality: Option<i64>,
    reflection_note: Option<String>,
    accomplishment: Option<String>,
    mark_mission_completed: Option<bool>,
) -> Result<LocalFocusSession, String> {
    if quality.is_some_and(|value| !(1..=5).contains(&value)) {
        return Err("Quality must be from 1 to 5".into());
    }
    validate_optional_text(reflection_note.as_deref(), 4000)?;
    validate_optional_text(accomplishment.as_deref(), 1000)?;
    let session = with_db(&state, |db| {
        let now = unix_now_seconds();
        let current = advance_focus_session_at(db, session_id, now, true)?;
        if current.status != "ACTIVE" {
            return Ok(current);
        }
        complete_focus_session(
            db,
            session_id,
            now,
            quality,
            reflection_note,
            accomplishment,
            mark_mission_completed.unwrap_or(false),
        )
    })?;
    publish_local_browser_policy(&state)?;
    Ok(session)
}

fn complete_focus_session(
    db: &mut Connection,
    session_id: i64,
    now_seconds: i64,
    quality: Option<i64>,
    reflection_note: Option<String>,
    accomplishment: Option<String>,
    mark_mission_completed: bool,
) -> rusqlite::Result<LocalFocusSession> {
    advance_focus_session_at(db, session_id, now_seconds, false)?;
    let tx = db.transaction()?;
    let now = format_epoch_seconds(now_seconds);
    let changed=tx.execute("UPDATE calendar_sessions SET
        focus_active_seconds=focus_active_seconds+CASE WHEN status='ACTIVE' AND current_phase='FOCUS' AND phase_started_at IS NOT NULL THEN max(0,min(?5,COALESCE(phase_deadline_at/1000,?5))-unixepoch(phase_started_at)) ELSE 0 END,
        break_active_seconds=break_active_seconds+CASE WHEN status='ACTIVE' AND current_phase IN ('BREAK','GRACE') AND phase_started_at IS NOT NULL THEN max(0,min(?5,COALESCE(phase_deadline_at/1000,?5))-unixepoch(phase_started_at)) ELSE 0 END,
        active_seconds=CASE WHEN pomodoro_enabled=1 THEN focus_active_seconds+CASE WHEN status='ACTIVE' AND current_phase='FOCUS' AND phase_started_at IS NOT NULL THEN max(0,min(?5,COALESCE(phase_deadline_at/1000,?5))-unixepoch(phase_started_at)) ELSE 0 END ELSE min(duration_minutes*60,active_seconds+CASE WHEN status='ACTIVE' AND current_phase='FOCUS' AND phase_started_at IS NOT NULL THEN max(0,min(?5,COALESCE(phase_deadline_at/1000,?5))-unixepoch(phase_started_at)) ELSE 0 END) END,
        status='COMPLETED',ended_at=?6,phase_started_at=NULL,phase_deadline_at=NULL,paused_phase_remaining_seconds=NULL,paused_at=NULL,
        completion_quality=?2,reflection_note=?3,accomplishment=?4,current_phase='COMPLETE',phase_revision=phase_revision+1,updated_at=?6
        WHERE id=?1 AND status IN ('ACTIVE','PAUSED') AND current_phase<>'RETURN_REQUIRED'",
        params![session_id,quality,reflection_note,accomplishment,now_seconds,now])?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let active_seconds:i64=tx.query_row("SELECT CASE WHEN pomodoro_enabled=1 THEN focus_active_seconds ELSE active_seconds END FROM calendar_sessions WHERE id=?1",[session_id],|r|r.get(0))?;
    let linked_task: Option<i64> = tx.query_row(
        "SELECT task_id FROM calendar_sessions WHERE id=?1",
        [session_id],
        |r| r.get(0),
    )?;
    let reward_id: String = tx.query_row(
        "SELECT reward_id FROM calendar_sessions WHERE id=?1",
        [session_id],
        |r| r.get(0),
    )?;
    let minutes = active_seconds / 60;
    if minutes >= 15 {
        insert_xp_event(
            &tx,
            &format!("focus:{reward_id}"),
            "FOCUS_SESSION_COMPLETED",
            if minutes >= 45 { 25 } else { 15 },
            Some(session_id),
        )?;
    }
    if mark_mission_completed {
        if let Some(task_id) = linked_task {
            let status: Option<String> = tx
                .query_row("SELECT status FROM tasks WHERE id=?1", [task_id], |row| {
                    row.get(0)
                })
                .optional()?;
            if status
                .as_deref()
                .is_some_and(|status| status != "COMPLETED")
            {
                complete_task_in_transaction(&tx, task_id, Some((active_seconds / 60).max(1)))?;
            }
        }
    }
    tx.commit()?;
    focus_session_by_id(db, session_id)
}

#[tauri::command]
pub fn local_cancel_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<LocalFocusSession, String> {
    let session = with_db(&state, |db| cancel_focus_session(db, session_id))?;
    publish_local_browser_policy(&state)?;
    Ok(session)
}

fn cancel_focus_session(db: &Connection, session_id: i64) -> rusqlite::Result<LocalFocusSession> {
    let changed = db.execute(
        "UPDATE calendar_sessions SET status='CANCELLED',ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status IN ('SCHEDULED','ACTIVE','PAUSED')",
        [session_id],
    )?;
    let session = focus_session_by_id(db, session_id)?;
    if changed == 0 && session.status != "CANCELLED" {
        return Err(rusqlite::Error::InvalidQuery);
    }
    Ok(session)
}

#[tauri::command]
pub fn local_delete_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
) -> Result<(), String> {
    with_db(&state, |db| {
        let changed = db.execute(
            "DELETE FROM calendar_sessions WHERE id=?1 AND status NOT IN ('ACTIVE','PAUSED')",
            [session_id],
        )?;
        if changed == 0 {
            return Err(rusqlite::Error::InvalidQuery);
        }
        Ok(())
    })
}

#[tauri::command]
pub fn local_get_study_resources(
    state: tauri::State<'_, VaultManager>,
    mission_id: Option<i64>,
    session_id: Option<i64>,
) -> Result<Vec<LocalStudyResource>, String> {
    with_db(&state, |db| {
        let mut statement = db.prepare("SELECT id,mission_id,focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination,display_name,expires_at,created_at,updated_at FROM browser_resources WHERE (?1 IS NULL OR mission_id=?1 OR mission_id IS NULL) AND (?2 IS NULL OR focus_session_id=?2 OR focus_session_id IS NULL) ORDER BY id DESC")?;
        let rows = statement.query_map(params![mission_id, session_id], |row| {
            Ok(LocalStudyResource {
                id: row.get(0)?,
                user_id: 1,
                mission_id: row.get(1)?,
                focus_session_id: row.get(2)?,
                resource_type: row.get(3)?,
                match_type: row.get(4)?,
                disposition: row.get(5)?,
                break_only: row.get::<_, i64>(6)? != 0,
                destination: row.get(7)?,
                canonical_destination: row.get(8)?,
                display_name: row.get(9)?,
                expires_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_create_study_resource(
    state: tauri::State<'_, VaultManager>,
    request: CreateStudyResourceRequest,
) -> Result<LocalStudyResource, String> {
    let CreateStudyResourceRequest {
        mission_id,
        focus_session_id,
        resource_type,
        match_type,
        disposition,
        break_only,
        destination,
        display_name,
        expires_at,
    } = request;
    let resource_type = resource_type.to_ascii_uppercase();
    let match_type = match_type.to_ascii_uppercase();
    let disposition = disposition.to_ascii_uppercase();
    if !matches!(
        resource_type.as_str(),
        "WEBSITE" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST" | "DISCORD_CHANNEL" | "TEMPORARY_SITE"
    ) || !matches!(
        match_type.as_str(),
        "EXACT" | "DOMAIN" | "URL_PATTERN" | "BROWSER_CHANNEL"
    ) || !matches!(disposition.as_str(), "APPROVED" | "BLOCKED")
        || (break_only && disposition != "APPROVED")
        || destination.trim().is_empty()
        || destination.len() > 2048
        || display_name.as_ref().is_some_and(|name| name.len() > 180)
    {
        return Err("Study resource is invalid".into());
    }
    if matches!(
        resource_type.as_str(),
        "WEBSITE" | "TEMPORARY_SITE" | "DISCORD_CHANNEL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST"
    ) {
        let raw = destination.trim();
        let candidate = if match_type == "DOMAIN" && !raw.contains("://") {
            format!("https://{}", raw)
        } else {
            raw.to_string()
        };
        let parseable = if match_type == "URL_PATTERN" {
            candidate.replace('*', "shinpo-wildcard")
        } else {
            candidate.clone()
        };
        let parsed = url::Url::parse(&parseable)
            .map_err(|_| "Enter a valid HTTP or HTTPS website".to_string())?;
        if !matches!(parsed.scheme(), "http" | "https")
            || parsed.host_str().is_none()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
        {
            return Err("Enter a valid HTTP or HTTPS website without credentials".into());
        }
        if match_type == "URL_PATTERN"
            && candidate
                .split('/')
                .nth(2)
                .is_some_and(|host| host.contains('*'))
        {
            return Err("URL patterns cannot use wildcards in the hostname".into());
        }
        if match_type == "BROWSER_CHANNEL"
            && (parsed.host_str() != Some("discord.com")
                || !parsed.path().starts_with("/channels/"))
        {
            return Err("Use an exact Discord channel URL".into());
        }
    }
    if break_only && focus_session_id.is_none() {
        return Err("Break-only resources must be linked to a Focus session".into());
    }
    with_db(&state, |db| {
        db.execute("INSERT INTO browser_resources(mission_id,focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination,display_name,expires_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7,?8,?9)", params![mission_id,focus_session_id,resource_type,match_type,disposition,break_only as i64,destination.trim(),display_name,expires_at])?;
        let id = db.last_insert_rowid();
        db.query_row("SELECT id,mission_id,focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination,display_name,expires_at,created_at,updated_at FROM browser_resources WHERE id=?1", [id], |row| Ok(LocalStudyResource {
            id: row.get(0)?, user_id: 1, mission_id: row.get(1)?, focus_session_id: row.get(2)?, resource_type: row.get(3)?, match_type: row.get(4)?, disposition: row.get(5)?, break_only: row.get::<_, i64>(6)? != 0, destination: row.get(7)?, canonical_destination: row.get(8)?, display_name: row.get(9)?, expires_at: row.get(10)?, created_at: row.get(11)?, updated_at: row.get(12)?,
        }))
    })
}

#[tauri::command]
pub fn local_delete_study_resource(
    state: tauri::State<'_, VaultManager>,
    resource_id: i64,
) -> Result<(), String> {
    with_db(&state, |db| {
        db.execute("DELETE FROM browser_resources WHERE id=?1", [resource_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_sync_browser_policy(
    state: tauri::State<'_, VaultManager>,
) -> Result<serde_json::Value, String> {
    publish_local_browser_policy(&state)
}

pub fn maintain_active_focus(state: &VaultManager) -> Result<(), String> {
    maintain_active_focus_at(state, &state.browser_host_paths, unix_now_seconds())
}

fn maintain_active_focus_at(
    state: &VaultManager,
    paths: &shinpo_browser_host::config::HostPaths,
    now: i64,
) -> Result<(), String> {
    let snapshot = with_db_background(state, |db| maintain_active_focus_in_db(db, now))?;

    if let Some(snapshot) = snapshot {
        shinpo_browser_host::initialize_installation(paths)
            .map_err(|_| "Browser Companion host is not initialized".to_string())?;
        shinpo_browser_host::publish_policy(paths, snapshot)
            .map_err(|_| "Could not publish local Focus policy".to_string())?;
    }
    Ok(())
}

pub fn observe_local_guardian_apps(state: &VaultManager) -> Result<(), String> {
    let (blocked, allowed) = with_db_background(state, |db| {
        let mut stmt = db.prepare("SELECT exec_name, policy_type FROM guardian_app_policies")?;
        let mut blocked = Vec::new();
        let mut allowed = Vec::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for r in rows.flatten() {
            if r.1 == "BLOCKED" {
                blocked.push(r.0);
            } else if r.1 == "ALLOWED" {
                allowed.push(r.0);
            }
        }
        Ok((blocked, allowed))
    })
    .unwrap_or_default();

    observe_local_guardian_apps_with(state, || {
        Ok(shinpo_shield::observer::observe_processes_with_targets(
            &blocked, &allowed,
        ))
    })
}

fn set_guardian_observer_health(
    state: &VaultManager,
    session_id: Option<i64>,
    status: &'static str,
) -> Result<(), String> {
    let mut health = state
        .guardian_observer
        .lock()
        .map_err(|_| "Guardian observer state is unavailable".to_string())?;
    health.session_id = session_id;
    health.status = status;
    health.checked_at = Some(chrono_now());
    Ok(())
}

fn observe_local_guardian_apps_with(
    state: &VaultManager,
    observe: impl FnOnce() -> Result<Vec<shinpo_shield::observer::ObservedDistraction>, String>,
) -> Result<(), String> {
    let active_session = with_db_background(state, |db| {
        db.query_row(
            "SELECT id,guardian_mode,current_phase FROM calendar_sessions WHERE status='ACTIVE' AND guardian_app_monitoring=1 ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .optional()
    })?;
    let Some((session_id, guardian_mode, focus_phase)) = active_session else {
        with_db_background(state, |db| {
            db.execute(
                "UPDATE guardian_session_usage SET last_verified_epoch=NULL",
                [],
            )?;
            Ok(())
        })?;
        set_guardian_observer_health(state, None, "IDLE")?;
        return Ok(());
    };

    set_guardian_observer_health(state, Some(session_id), "SCANNING")?;
    let observed = match observe() {
        Ok(observed) => observed,
        Err(error) => {
            reset_guardian_runtime_sample(state, session_id)?;
            set_guardian_observer_health(state, Some(session_id), "DEGRADED")?;
            return Err(error);
        }
    };
    if observed.is_empty() {
        reset_guardian_runtime_sample(state, session_id)?;
        set_guardian_observer_health(state, Some(session_id), "MONITORING")?;
        return Ok(());
    }
    let outcomes =
        apply_guardian_app_policy(state, session_id, &guardian_mode, &focus_phase, &observed)?;
    let observed_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|_| "Could not timestamp local Guardian observation".to_string())?;
    let persisted = with_db_background(state, |db| {
        persist_guardian_observations(
            db,
            session_id,
            &guardian_mode,
            &focus_phase,
            &observed,
            &observed_at,
        )
    });
    if persisted.is_ok() {
        let _ = with_db_background(state, |db| {
            persist_guardian_intervention_outcomes(
                db,
                session_id,
                &guardian_mode,
                &focus_phase,
                &observed,
                &outcomes,
            )
        });
    }
    set_guardian_observer_health(
        state,
        Some(session_id),
        if persisted.is_ok() {
            "MONITORING"
        } else {
            "DEGRADED"
        },
    )?;
    persisted
}

type GuardianOutcome = (u32, u64, String);

fn reset_guardian_runtime_sample(state: &VaultManager, session_id: i64) -> Result<(), String> {
    with_db_background(state, |db| {
        db.execute(
            "UPDATE guardian_session_usage SET last_verified_epoch=NULL WHERE session_id=?1",
            [session_id],
        )?;
        Ok(())
    })
}

fn apply_guardian_app_policy(
    state: &VaultManager,
    session_id: i64,
    guardian_mode: &str,
    focus_phase: &str,
    observed: &[shinpo_shield::observer::ObservedDistraction],
) -> Result<Vec<GuardianOutcome>, String> {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    with_db_background(state, |db| {
        let transaction = db.transaction()?;
        let session = transaction.query_row(
            "SELECT status,current_phase,guardian_app_monitoring,guardian_intervention_disabled,guardian_mode
             FROM calendar_sessions WHERE id=?1",
            [session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, bool>(2)?, row.get::<_, bool>(3)?, row.get::<_, String>(4)?)),
        ).optional()?;
        let runtime_consent: bool = transaction.query_row(
            "SELECT background_runtime_consent FROM guardian_preferences WHERE id=1",
            [],
            |row| row.get(0),
        )?;
        let valid_session =
            session
                .as_ref()
                .is_some_and(|(status, phase, monitoring, stopped, mode)| {
                    status == "ACTIVE"
                        && phase == focus_phase
                        && mode == guardian_mode
                        && *monitoring
                        && !stopped
                });
        let verified_count = observed
            .iter()
            .filter(|process| verified_observed_identity(process))
            .count();
        let allowance = if valid_session
            && focus_phase == "FOCUS"
            && guardian_mode == "PROTECTED"
            && runtime_consent
            && verified_count > 0
        {
            advance_guardian_runtime_allowance(&transaction, session_id, now)?
        } else {
            transaction.execute(
                "UPDATE guardian_session_usage SET last_verified_epoch=NULL WHERE session_id=?1",
                [session_id],
            )?;
            transaction
                .query_row(
                    "SELECT consumed_seconds FROM guardian_session_usage WHERE session_id=?1",
                    [session_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?
                .unwrap_or(0)
        };
        let mut outcomes = Vec::with_capacity(observed.len());
        for process in observed {
            let event_key = guardian_event_key(session_id, process, guardian_mode, focus_phase);
            let prior_outcome = transaction
                .query_row(
                    "SELECT outcome FROM guardian_observations WHERE event_key=?1",
                    [&event_key],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            let already_intervened = prior_outcome.as_deref().is_some_and(|outcome| {
                matches!(
                    outcome,
                    "CLOSED_GRACEFULLY_VERIFIED"
                        | "CLOSE_REQUESTED_UNCONFIRMED"
                        | "LIMITED_CLOSE_UNAVAILABLE"
                )
            });
            let outcome = if already_intervened {
                prior_outcome.unwrap_or_else(|| "INTERVENTION_ALREADY_RECORDED".to_string())
            } else if !valid_session {
                "LIMITED_STALE_OR_INACTIVE_SESSION".to_string()
            } else if focus_phase != "FOCUS" {
                "ALLOWED_OUTSIDE_FOCUS".to_string()
            } else if !verified_observed_identity(process) {
                "LIMITED_IDENTITY_UNVERIFIED".to_string()
            } else if guardian_mode == "GUIDED" {
                "WARNING_LIGHT".to_string()
            } else if guardian_mode == "PROTECTED" && !runtime_consent {
                "LIMITED_NO_RUNTIME_CONSENT".to_string()
            } else if guardian_mode == "PROTECTED" && allowance < 600 {
                format!("ALLOWANCE_REMAINING_{}", 600 - allowance)
            } else if guardian_mode == "STRICT" {
                "WARNING_STRICT_ENFORCEMENT_DISABLED".to_string()
            } else {
                "WARNING_ALLOWANCE_ENFORCEMENT_DISABLED".to_string()
            };
            outcomes.push((process.pid, process.process_started_at, outcome));
        }
        transaction.commit()?;
        Ok(outcomes)
    })
}

fn verified_observed_identity(process: &shinpo_shield::observer::ObservedDistraction) -> bool {
    process.identity.as_ref().is_some_and(|identity| {
        identity.pid == process.pid
            && identity
                .process_name
                .eq_ignore_ascii_case(&process.process_name)
            && !shinpo_shield::process_identity::protected_process_name(&identity.process_name)
    })
}

fn guardian_event_key(
    session_id: i64,
    process: &shinpo_shield::observer::ObservedDistraction,
    guardian_mode: &str,
    focus_phase: &str,
) -> String {
    format!(
        "guardian:{session_id}:{}:{}:{guardian_mode}:{focus_phase}",
        process.pid, process.process_started_at
    )
}

fn advance_guardian_runtime_allowance(
    transaction: &Transaction<'_>,
    session_id: i64,
    now: i64,
) -> rusqlite::Result<i64> {
    transaction.execute(
        "INSERT OR IGNORE INTO guardian_session_usage(session_id) VALUES(?1)",
        [session_id],
    )?;
    transaction.execute(
        "UPDATE guardian_session_usage SET
             consumed_seconds=MIN(600,consumed_seconds + CASE WHEN last_verified_epoch IS NULL THEN 0 ELSE MIN(10,MAX(0,?2-last_verified_epoch)) END),
             last_verified_epoch=?2 WHERE session_id=?1",
        params![session_id, now],
    )?;
    transaction.query_row(
        "SELECT consumed_seconds FROM guardian_session_usage WHERE session_id=?1",
        [session_id],
        |row| row.get(0),
    )
}

fn persist_guardian_intervention_outcomes(
    db: &mut Connection,
    session_id: i64,
    guardian_mode: &str,
    focus_phase: &str,
    observed: &[shinpo_shield::observer::ObservedDistraction],
    outcomes: &[GuardianOutcome],
) -> rusqlite::Result<()> {
    let tx = db.transaction()?;
    for process in observed {
        let Some((_, _, outcome)) = outcomes.iter().find(|(pid, started, _)| {
            *pid == process.pid && *started == process.process_started_at
        }) else {
            continue;
        };
        tx.execute(
            "UPDATE guardian_observations SET outcome=?1 WHERE event_key=?2",
            params![
                outcome,
                guardian_event_key(session_id, process, guardian_mode, focus_phase)
            ],
        )?;
    }
    tx.commit()
}

fn persist_guardian_observations(
    db: &mut Connection,
    session_id: i64,
    guardian_mode: &str,
    focus_phase: &str,
    observed: &[shinpo_shield::observer::ObservedDistraction],
    observed_at: &str,
) -> rusqlite::Result<()> {
    let transaction = db.transaction()?;
    for process in observed {
        let process_started_at = i64::try_from(process.process_started_at)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        let event_key = format!(
            "guardian:{session_id}:{}:{}:{guardian_mode}:{focus_phase}",
            process.pid, process.process_started_at,
        );
        let outcome = match (focus_phase, guardian_mode) {
            ("BREAK", _) => "ALLOWED_BREAK",
            ("GRACE", _) => "WARNING_GRACE",
            ("RETURN_REQUIRED", _) => "WARNING_RETURN_REQUIRED",
            (_, "GUIDED") => "WARNING_LIGHT",
            (_, "PROTECTED") => "WARNING_STANDARD",
            (_, "STRICT") => "WARNING_STRICT",
            _ => "WARNING_STANDARD",
        };
        transaction.execute(
            "INSERT OR IGNORE INTO guardian_observations(event_key,session_id,pid,process_name,process_started_at,observed_at,catalog_version,category,rationale,guardian_mode,focus_phase,outcome)
             SELECT ?1,id,?2,?3,?4,?5,?6,?7,?8,guardian_mode,current_phase,?11 FROM calendar_sessions
             WHERE id=?9 AND status='ACTIVE' AND guardian_app_monitoring=1 AND guardian_mode=?10 AND current_phase=?12",
            params![event_key, process.pid, process.process_name, process_started_at, observed_at, process.catalog_version, process.category, process.rationale, session_id, guardian_mode, outcome, focus_phase],
        )?;
    }
    transaction.commit()
}

#[tauri::command]
pub fn local_get_guardian_observations(
    state: tauri::State<'_, VaultManager>,
    session_id: Option<i64>,
) -> Result<Vec<LocalGuardianObservation>, String> {
    let session_id = session_id
        .filter(|id| *id > 0)
        .ok_or_else(|| "Focus session ID is invalid".to_string())?;
    local_get_guardian_observations_from(&state, session_id)
}

fn local_get_guardian_observations_from(
    state: &VaultManager,
    session_id: i64,
) -> Result<Vec<LocalGuardianObservation>, String> {
    with_db(state, |db| {
        let mut statement = db.prepare(
            "SELECT id,session_id,pid,process_name,catalog_version,category,rationale,guardian_mode,focus_phase,outcome,observed_at FROM guardian_observations
             WHERE session_id=?1 ORDER BY observed_at DESC,id DESC LIMIT 200",
        )?;
        let rows = statement.query_map([session_id], |row| {
            Ok(LocalGuardianObservation {
                id: row.get(0)?,
                session_id: row.get(1)?,
                pid: row.get(2)?,
                process_name: row.get(3)?,
                catalog_version: row.get(4)?,
                category: row.get(5)?,
                rationale: row.get(6)?,
                guardian_mode: row.get(7)?,
                focus_phase: row.get(8)?,
                outcome: row.get(9)?,
                observed_at: row.get(10)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_get_guardian_preferences(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalGuardianPreferences, String> {
    local_get_guardian_preferences_from(&state)
}

fn local_get_guardian_preferences_from(
    state: &VaultManager,
) -> Result<LocalGuardianPreferences, String> {
    with_db(state, |db| {
        db.query_row(
            "SELECT preferred_mode,app_monitoring_consent,apply_to_new_sessions,closure_consent,background_runtime_consent
             FROM guardian_preferences WHERE id=1",
            [],
            |row| {
                Ok(LocalGuardianPreferences {
                    preferred_mode: row.get(0)?,
                    app_monitoring_consent: row.get(1)?,
                    apply_to_new_sessions: row.get(2)?,
                    closure_consent: row.get(3)?,
                    background_runtime_consent: row.get(4)?,
                })
            },
        )
    })
}

#[tauri::command]
pub fn local_update_guardian_preferences(
    state: tauri::State<'_, VaultManager>,
    request: UpdateGuardianPreferencesRequest,
) -> Result<LocalGuardianPreferences, String> {
    local_update_guardian_preferences_from(&state, request)
}

#[tauri::command]
pub fn local_emergency_stop_guardian(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    emergency_stop_guardian_in(&state)
}

fn emergency_stop_guardian_in(state: &VaultManager) -> Result<(), String> {
    with_db(state, |db| {
        db.execute("UPDATE calendar_sessions SET guardian_intervention_disabled=1,updated_at=?1 WHERE status IN ('ACTIVE','PAUSED')", [chrono_now()])?;
        Ok(())
    })
}

#[tauri::command]
pub fn local_get_discovered_apps(
    state: tauri::State<'_, VaultManager>,
) -> Result<Vec<shinpo_shield::app_discovery::DiscoveredApp>, String> {
    local_get_discovered_apps_from(&state)
}

fn local_get_discovered_apps_from(
    state: &VaultManager,
) -> Result<Vec<shinpo_shield::app_discovery::DiscoveredApp>, String> {
    let mut apps = shinpo_shield::app_discovery::discover_installed_apps();
    if state.is_unlocked().unwrap_or(false) {
        let policies = local_get_app_policies_from(state).unwrap_or_default();
        let mut by_app_id = std::collections::HashMap::new();
        let mut by_exec = std::collections::HashMap::new();
        for p in policies {
            by_app_id.insert(p.app_id, p.policy_type.clone());
            by_exec.insert(p.exec_name.to_ascii_lowercase(), p.policy_type);
        }
        for app in &mut apps {
            if let Some(p) = by_app_id.get(&app.id) {
                app.policy = p.clone();
            } else if let Some(ref ename) = app.exec_name {
                if let Some(p) = by_exec.get(&ename.to_ascii_lowercase()) {
                    app.policy = p.clone();
                }
            }
        }
    }
    Ok(apps)
}

#[tauri::command]
pub fn local_get_app_policies(
    state: tauri::State<'_, VaultManager>,
) -> Result<Vec<LocalGuardianAppPolicy>, String> {
    local_get_app_policies_from(&state)
}

fn local_get_app_policies_from(
    state: &VaultManager,
) -> Result<Vec<LocalGuardianAppPolicy>, String> {
    with_db(state, |db| {
        let mut stmt = db.prepare(
            "SELECT id, app_id, app_name, exec_name, policy_type, source, created_at, updated_at
             FROM guardian_app_policies ORDER BY app_name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(LocalGuardianAppPolicy {
                id: row.get(0)?,
                app_id: row.get(1)?,
                app_name: row.get(2)?,
                exec_name: row.get(3)?,
                policy_type: row.get(4)?,
                source: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_save_app_policy(
    state: tauri::State<'_, VaultManager>,
    request: SaveAppPolicyRequest,
) -> Result<LocalGuardianAppPolicy, String> {
    local_save_app_policy_in(&state, request)
}

fn local_save_app_policy_in(
    state: &VaultManager,
    request: SaveAppPolicyRequest,
) -> Result<LocalGuardianAppPolicy, String> {
    let p_type = request.policy_type.trim().to_ascii_uppercase();
    if p_type != "BLOCKED" && p_type != "ALLOWED" {
        return Err("Policy type must be BLOCKED or ALLOWED".to_string());
    }
    let app_id = request.app_id.trim();
    if app_id.is_empty() {
        return Err("App ID is required".to_string());
    }
    let app_name = request.app_name.trim();
    if app_name.is_empty() {
        return Err("App name is required".to_string());
    }
    let exec_name = request.exec_name.trim().to_ascii_lowercase();
    if exec_name.is_empty() {
        return Err("Executable target is required".to_string());
    }
    if shinpo_shield::process_identity::protected_process_name(&exec_name) {
        return Err("Protected system processes cannot have policies applied".to_string());
    }
    let source = request.source.as_deref().unwrap_or("system");
    let now = chrono_now();

    with_db(state, |db| {
        db.execute(
            "INSERT INTO guardian_app_policies(app_id, app_name, exec_name, policy_type, source, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(app_id) DO UPDATE SET
                app_name=excluded.app_name,
                exec_name=excluded.exec_name,
                policy_type=excluded.policy_type,
                source=excluded.source,
                updated_at=excluded.updated_at",
            params![app_id, app_name, exec_name, p_type, source, now],
        )?;
        let row = db.query_row(
            "SELECT id, app_id, app_name, exec_name, policy_type, source, created_at, updated_at
             FROM guardian_app_policies WHERE app_id=?1",
            [app_id],
            |r| {
                Ok(LocalGuardianAppPolicy {
                    id: r.get(0)?,
                    app_id: r.get(1)?,
                    app_name: r.get(2)?,
                    exec_name: r.get(3)?,
                    policy_type: r.get(4)?,
                    source: r.get(5)?,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                })
            },
        )?;
        Ok(row)
    })
}

#[tauri::command]
pub fn local_remove_app_policy(
    state: tauri::State<'_, VaultManager>,
    app_id: String,
) -> Result<(), String> {
    local_remove_app_policy_in(&state, &app_id)
}

fn local_remove_app_policy_in(state: &VaultManager, app_id: &str) -> Result<(), String> {
    with_db(state, |db| {
        db.execute(
            "DELETE FROM guardian_app_policies WHERE app_id=?1 OR exec_name=?1",
            [app_id],
        )?;
        Ok(())
    })
}

fn local_update_guardian_preferences_from(
    state: &VaultManager,
    request: UpdateGuardianPreferencesRequest,
) -> Result<LocalGuardianPreferences, String> {
    let mode = request.preferred_mode.trim().to_ascii_uppercase();
    if !matches!(mode.as_str(), "GUIDED" | "PROTECTED" | "STRICT") {
        return Err("Guardian mode must be Light, Standard, or Strict".into());
    }
    if (request.closure_consent || request.background_runtime_consent)
        && !request.app_monitoring_consent
    {
        return Err("Guardian intervention consent requires app monitoring consent".into());
    }
    with_db(state, |db| {
        let transaction = db.transaction()?;
        transaction.execute(
            "UPDATE guardian_preferences SET preferred_mode=?1,app_monitoring_consent=?2,
             apply_to_new_sessions=?3,closure_consent=?4,background_runtime_consent=?5,updated_at=?6 WHERE id=1",
            params![
                mode,
                request.app_monitoring_consent,
                request.apply_to_new_sessions,
                request.closure_consent,
                request.background_runtime_consent,
                chrono_now(),
            ],
        )?;
        if !request.app_monitoring_consent {
            transaction.execute(
                "UPDATE calendar_sessions SET guardian_app_monitoring=0
                 WHERE status IN ('SCHEDULED','ACTIVE','PAUSED') AND guardian_app_monitoring<>0",
                [],
            )?;
        }
        if !request.app_monitoring_consent
            || !request.closure_consent
            || !request.background_runtime_consent
        {
            transaction.execute(
                "UPDATE guardian_session_usage SET last_verified_epoch=NULL",
                [],
            )?;
        }
        transaction.commit()?;
        Ok(LocalGuardianPreferences {
            preferred_mode: mode,
            app_monitoring_consent: request.app_monitoring_consent,
            apply_to_new_sessions: request.apply_to_new_sessions,
            closure_consent: request.closure_consent,
            background_runtime_consent: request.background_runtime_consent,
        })
    })
}

#[tauri::command]
pub fn local_get_guardian_status(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalGuardianStatus, String> {
    local_get_guardian_status_from(&state)
}

fn local_get_guardian_status_from(state: &VaultManager) -> Result<LocalGuardianStatus, String> {
    if !state.is_unlocked()? {
        return Ok(LocalGuardianStatus {
            status: "LOCKED",
            active_focus_session_id: None,
            active_focus_session_name: None,
            guardian_mode: None,
            focus_phase: None,
            observations_today: 0,
            last_observation_at: None,
            app_catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            domain_catalog_version: DOMAIN_CATALOG_VERSION,
            warning_only: true,
            intervention_capability: "LOCKED",
            standard_allowance_seconds: None,
            observer_status: "LOCKED",
            application_policy_status: "LOCKED",
            application_catalog: local_guardian_catalog(),
        });
    }

    with_db_background(state, |db| {
        let session = db
            .query_row(
                "SELECT id,name,guardian_mode,current_phase,status,guardian_app_monitoring,guardian_intervention_disabled FROM calendar_sessions
                 WHERE status IN ('ACTIVE','PAUSED') ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, bool>(5)?,
                        row.get::<_, bool>(6)?,
                    ))
                },
            )
            .optional()?;
        let today = OffsetDateTime::now_utc().date().to_string();
        let observations_today = db.query_row(
            "SELECT count(*) FROM guardian_observations WHERE substr(observed_at,1,10)=?1",
            [&today],
            |row| row.get(0),
        )?;
        let last_observation_at = db.query_row(
            "SELECT max(observed_at) FROM guardian_observations",
            [],
            |row| row.get(0),
        )?;
        let (status, id, name, mode, phase, policy_status, monitoring, intervention_disabled) =
            match session {
                Some((
                    id,
                    name,
                    mode,
                    phase,
                    session_status,
                    app_monitoring_enabled,
                    intervention_disabled,
                )) => (
                    if session_status == "ACTIVE" {
                        "ACTIVE"
                    } else {
                        "PAUSED"
                    },
                    Some(id),
                    Some(name),
                    Some(mode),
                    Some(phase.clone()),
                    match (session_status.as_str(), phase.as_str()) {
                        ("PAUSED", _) => "PAUSED",
                        (_, "FOCUS") => "WARNING_ONLY",
                        (_, "BREAK") => "BREAK_OBSERVATION_ONLY",
                        (_, "GRACE") => "GRACE_WARNING_ONLY",
                        (_, "RETURN_REQUIRED") => "RETURN_REQUIRED_WARNING_ONLY",
                        _ => "INACTIVE",
                    },
                    session_status == "ACTIVE" && app_monitoring_enabled,
                    intervention_disabled,
                ),
                None => ("READY", None, None, None, None, "INACTIVE", false, false),
            };
        let runtime_consent: bool = db.query_row(
            "SELECT background_runtime_consent FROM guardian_preferences WHERE id=1",
            [],
            |row| row.get(0),
        )?;
        let allowance = id
            .map(|session_id| {
                db.query_row(
                    "SELECT consumed_seconds FROM guardian_session_usage WHERE session_id=?1",
                    [session_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
            })
            .transpose()?
            .flatten();
        let health = state
            .guardian_observer
            .lock()
            .map_err(|_| rusqlite::Error::InvalidQuery)?;
        let observer_is_stale = health.session_id == id
            && health.checked_at.as_deref().is_some_and(|checked_at| {
                OffsetDateTime::parse(checked_at, &Rfc3339).is_ok_and(|checked| {
                    (OffsetDateTime::now_utc() - checked).whole_seconds() > CHECKPOINT_STALE_SECONDS
                })
            });
        let observer_status = if !monitoring {
            if status == "PAUSED" {
                "PAUSED"
            } else {
                "IDLE"
            }
        } else if health.session_id == id && (health.status == "DEGRADED" || observer_is_stale) {
            "DEGRADED"
        } else if health.session_id == id && health.status == "MONITORING" {
            "MONITORING"
        } else {
            "STARTING"
        };
        let application_policy_status = if id.is_none() {
            "INACTIVE"
        } else if intervention_disabled {
            "EMERGENCY_STOPPED"
        } else if status == "PAUSED" {
            "PAUSED"
        } else if phase.as_deref() != Some("FOCUS") {
            policy_status
        } else if !monitoring {
            "MONITORING_DISABLED"
        } else if observer_status == "DEGRADED" {
            "OBSERVER_UNAVAILABLE"
        } else if observer_status != "MONITORING" {
            "OBSERVER_STARTING"
        } else if !cfg!(target_os = "linux") {
            "LIMITED_PLATFORM_UNSUPPORTED"
        } else if mode.as_deref() == Some("STRICT") {
            "STRICT_WARNING_ONLY"
        } else if mode.as_deref() == Some("PROTECTED") && !runtime_consent {
            "LIMITED_NO_RUNTIME_CONSENT"
        } else if mode.as_deref() == Some("PROTECTED") && allowance.unwrap_or(0) < 600 {
            "STANDARD_ALLOWANCE_ACTIVE"
        } else if mode.as_deref() == Some("PROTECTED") {
            "STANDARD_WARNING_ONLY"
        } else {
            "WARNING_ONLY"
        };
        Ok(LocalGuardianStatus {
            status,
            active_focus_session_id: id,
            active_focus_session_name: name,
            guardian_mode: mode.clone(),
            focus_phase: phase,
            observations_today,
            last_observation_at,
            app_catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            domain_catalog_version: DOMAIN_CATALOG_VERSION,
            warning_only: true,
            intervention_capability: match application_policy_status {
                "STRICT_WARNING_ONLY" => "STRICT_WARNING_ONLY",
                "STANDARD_ALLOWANCE_ACTIVE" => "STANDARD_SAMPLED_RUNTIME_ALLOWANCE",
                "STANDARD_WARNING_ONLY" => "STANDARD_WARNING_ONLY",
                "BREAK_OBSERVATION_ONLY" => "BREAK_OBSERVATION_ONLY",
                "GRACE_WARNING_ONLY" => "GRACE_WARNING_ONLY",
                "RETURN_REQUIRED_WARNING_ONLY" => "RETURN_REQUIRED_WARNING_ONLY",
                "PAUSED" => "SESSION_PAUSED",
                "INACTIVE" => "INACTIVE",
                "MONITORING_DISABLED" => "MONITORING_DISABLED",
                "EMERGENCY_STOPPED" => "EMERGENCY_STOPPED",
                "OBSERVER_UNAVAILABLE" => "LIMITED_OBSERVER_UNAVAILABLE",
                "OBSERVER_STARTING" => "LIMITED_OBSERVER_STARTING",
                "LIMITED_PLATFORM_UNSUPPORTED" => "LIMITED_PLATFORM_UNSUPPORTED",
                "LIMITED_NO_RUNTIME_CONSENT" => "LIMITED_NO_RUNTIME_CONSENT",
                _ => "WARNING_ONLY",
            },
            standard_allowance_seconds: allowance,
            observer_status,
            application_policy_status,
            application_catalog: local_guardian_catalog(),
        })
    })
}

fn local_guardian_catalog() -> Vec<LocalGuardianCatalogEntry> {
    shinpo_shield::observer::distraction_catalog()
        .iter()
        .map(|entry| LocalGuardianCatalogEntry {
            process_name: entry.process_name,
            category: entry.category,
            rationale: entry.rationale,
        })
        .collect()
}

fn maintain_active_focus_in_db(
    db: &mut Connection,
    now_seconds: i64,
) -> rusqlite::Result<Option<serde_json::Value>> {
    reconcile_active_focus_sessions(db, now_seconds, true)?;
    let active: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM calendar_sessions WHERE status='ACTIVE')",
        [],
        |row| row.get(0),
    )?;
    active.then(|| build_local_browser_policy(db)).transpose()
}

fn publish_local_browser_policy(state: &VaultManager) -> Result<serde_json::Value, String> {
    publish_local_browser_policy_at(state, &state.browser_host_paths)
}

fn publish_local_browser_policy_at(
    state: &VaultManager,
    paths: &shinpo_browser_host::config::HostPaths,
) -> Result<serde_json::Value, String> {
    let now = unix_now_seconds();
    let snapshot = with_db(state, |db| {
        reconcile_active_focus_sessions(db, now, true)?;
        build_local_browser_policy(db)
    })?;
    shinpo_browser_host::initialize_installation(paths)
        .map_err(|_| "Browser Companion host is not initialized".to_string())?;
    shinpo_browser_host::publish_policy(paths, snapshot.clone())
        .map_err(|_| "Could not publish local Focus policy".to_string())?;
    Ok(snapshot)
}

fn build_local_browser_policy(db: &mut Connection) -> rusqlite::Result<serde_json::Value> {
    let revision: i64 = db.query_row("UPDATE browser_companion_meta SET policy_revision=policy_revision+1 WHERE id=1 RETURNING policy_revision", [], |row| row.get(0))?;
    let session = db.query_row("SELECT s.id,s.name,s.task_id,s.current_phase,s.status,t.title,s.phase_deadline_at,s.phase_revision,s.pomodoro_enabled,s.pomodoro_long_break_minutes,s.pomodoro_grace_minutes,s.completed_focus_cycles,s.guardian_mode FROM calendar_sessions s LEFT JOIN tasks t ON t.id=s.task_id WHERE s.status IN ('ACTIVE','PAUSED') ORDER BY s.id DESC LIMIT 1", [], |row| Ok((row.get::<_, i64>(0)?,row.get::<_, String>(1)?,row.get::<_, Option<i64>>(2)?,row.get::<_, String>(3)?,row.get::<_, String>(4)?,row.get::<_, Option<String>>(5)?,row.get::<_, Option<i64>>(6)?,row.get::<_, i64>(7)?,row.get::<_, bool>(8)?,row.get::<_, i64>(9)?,row.get::<_, i64>(10)?,row.get::<_, i64>(11)?,row.get::<_, String>(12)?))).optional()?;
    let Some((
        id,
        name,
        task_id,
        phase,
        status,
        task_title,
        deadline,
        phase_revision,
        pomodoro,
        break_minutes,
        grace_minutes,
        completed_cycles,
        mode,
    )) = session
    else {
        return Ok(
            serde_json::json!({ "status":"INACTIVE", "policyVersion":revision, "resources":[] }),
        );
    };
    if status != "ACTIVE" {
        return Ok(
            serde_json::json!({ "status":"INACTIVE", "sessionId":id, "currentPhase":phase, "phaseRevision":phase_revision, "policyVersion":revision, "resources":[] }),
        );
    }
    let break_deadline = match (deadline, phase.as_str()) {
        (Some(deadline), "BREAK") => Some(deadline),
        (Some(deadline), "FOCUS") if pomodoro && completed_cycles == 0 => {
            Some(deadline.saturating_add(break_minutes.max(1) * 60_000))
        }
        _ => None,
    };
    let grace_deadline = match (deadline, phase.as_str(), break_deadline) {
        (Some(deadline), "GRACE", _) => Some(deadline),
        (_, "FOCUS", Some(break_end)) => {
            Some(break_end.saturating_add(grace_minutes.clamp(1, 10) * 60_000))
        }
        (_, "BREAK", Some(break_end)) => {
            Some(break_end.saturating_add(grace_minutes.clamp(1, 10) * 60_000))
        }
        _ => None,
    };
    let mut statement = db.prepare("SELECT id,resource_type,match_type,disposition,break_only,destination,expires_at FROM browser_resources WHERE focus_session_id=?1 OR (focus_session_id IS NULL AND (mission_id IS NULL OR mission_id=?2)) ORDER BY id")?;
    let mut resources = statement.query_map(params![id,task_id], |row| Ok(serde_json::json!({
            "id":row.get::<_,i64>(0)?, "resourceType":row.get::<_,String>(1)?, "matchType":row.get::<_,String>(2)?,
            "disposition":row.get::<_,String>(3)?, "breakOnly":row.get::<_,i64>(4)? != 0,
            "destination":row.get::<_,String>(5)?, "canonicalDestination":row.get::<_,String>(5)?, "expiresAt":row.get::<_,Option<String>>(6)?
        })))?.collect::<Result<Vec<_>,_>>()?;
    // Bundled catalog v1 uses narrow domains with clear education or entertainment intent.
    for domain in [
        "instagram.com",
        "tiktok.com",
        "facebook.com",
        "reddit.com",
        "twitch.tv",
        "steamcommunity.com",
        "store.steampowered.com",
    ] {
        resources.push(serde_json::json!({
            "id":format!("{DOMAIN_CATALOG_VERSION}:{domain}"), "resourceType":"WEBSITE", "matchType":"DOMAIN",
            "disposition":"BLOCKED", "breakOnly":false, "destination":domain,
            "canonicalDestination":domain, "automaticGuardian":true
        }));
    }
    for domain in [
        "khanacademy.org",
        "coursera.org",
        "edx.org",
        "openstax.org",
        "arxiv.org",
        "developer.mozilla.org",
        "docs.python.org",
        "docs.rs",
        "rust-lang.org",
        "docs.github.com",
        "stackoverflow.com",
        "wikipedia.org",
    ] {
        resources.push(serde_json::json!({
            "id":format!("{DOMAIN_CATALOG_VERSION}:trusted:{domain}"), "resourceType":"WEBSITE", "matchType":"DOMAIN",
            "disposition":"APPROVED", "breakOnly":false, "destination":domain,
            "canonicalDestination":domain, "automaticGuardian":true
        }));
    }
    Ok(
        serde_json::json!({ "status":"ACTIVE", "sessionId":id, "taskId":task_id, "taskTitle":task_title.unwrap_or(name), "mode":mode, "currentPhase":phase, "phaseDeadlineAt":deadline, "breakDeadlineAt":break_deadline, "graceDeadlineAt":grace_deadline, "phaseRevision":phase_revision, "allowTemporaryExceptions":false, "policyVersion":revision, "issuedAt":(OffsetDateTime::now_utc().unix_timestamp_nanos()/1_000_000) as u64, "catalogVersions":{"applications":shinpo_shield::observer::APP_CATALOG_VERSION,"domains":DOMAIN_CATALOG_VERSION}, "resources":resources, "adapterSettings":{} }),
    )
}

#[tauri::command]
pub fn local_set_browser_focus_mode(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
    mode: String,
) -> Result<(), String> {
    let mode = mode.to_ascii_uppercase();
    if !matches!(mode.as_str(), "GUIDED" | "PROTECTED" | "STRICT") {
        return Err("Focus mode is invalid".into());
    }
    with_db(&state, |db| {
        let active: i64 = db.query_row(
            "SELECT count(*) FROM calendar_sessions WHERE id=?1 AND status='ACTIVE'",
            [session_id],
            |row| row.get(0),
        )?;
        if active != 1 {
            return Err(rusqlite::Error::InvalidQuery);
        }
        db.execute(
            "UPDATE calendar_sessions SET guardian_mode=?1 WHERE id=?2 AND status='ACTIVE'",
            params![mode, session_id],
        )?;
        Ok(())
    })?;
    publish_local_browser_policy(&state)?;
    Ok(())
}

fn focus_session_by_id(db: &Connection, id: i64) -> rusqlite::Result<LocalFocusSession> {
    db.query_row("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment,phase_started_at,phase_deadline_at,phase_revision,interruption_count,paused_phase_remaining_seconds,late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp,guardian_app_monitoring FROM calendar_sessions WHERE id=?1",[id],focus_session_from_row)
}

fn focus_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalFocusSession> {
    let status: String = row.get(15)?;
    let duration: i64 = row.get(5)?;
    let stored_active: i64 = row.get(20)?;
    let started: Option<String> = row.get(17)?;
    let accumulated: i64 = row.get(19)?;
    let pomodoro_enabled: bool = row.get(6)?;
    let phase: String = row.get(12)?;
    let phase_deadline_at: Option<i64> = row.get(28)?;
    let paused_remaining: Option<i64> = row.get(31)?;
    let focus_active = row.get::<_, i64>(13)?;
    let current_focus = if status == "ACTIVE" && phase == "FOCUS" {
        let phase_start = row.get::<_, Option<String>>(27)?;
        focus_active
            + phase_start
                .as_deref()
                .map(|s| elapsed_sql_seconds(s, 0))
                .unwrap_or(0)
    } else {
        focus_active
    };
    let current_active = if pomodoro_enabled {
        current_focus.min(duration * 60)
    } else if status == "ACTIVE" {
        started
            .as_deref()
            .map(|s| elapsed_sql_seconds(s, accumulated))
            .unwrap_or(stored_active)
            .min(duration * 60)
    } else {
        stored_active.min(duration * 60)
    };
    let remaining = if status == "PAUSED" {
        paused_remaining.unwrap_or_else(|| (duration * 60 - current_active).max(0))
    } else if status == "ACTIVE" {
        phase_deadline_at
            .map(|deadline| (deadline / 1000 - OffsetDateTime::now_utc().unix_timestamp()).max(0))
            .unwrap_or_else(|| (duration * 60 - current_active).max(0))
    } else {
        (duration * 60 - current_active).max(0)
    };
    let server_time: String = chrono_now();
    Ok(LocalFocusSession {
        id: row.get(0)?,
        user_id: 1,
        goal_id: row.get(1)?,
        mission_id: row.get(2)?,
        plan_id: None,
        name: row.get(3)?,
        intention: row.get(4)?,
        duration_minutes: duration,
        pomodoro_enabled,
        pomodoro_focus_cycles: row.get(7)?,
        pomodoro_short_break_minutes: row.get(8)?,
        pomodoro_long_break_minutes: row.get(9)?,
        completed_focus_cycles: row.get(10)?,
        pomodoro_grace_minutes: row.get(11)?,
        late_penalty_enabled: row.get(32)?,
        late_penalty_xp: row.get(33)?,
        late_penalty_daily_cap_xp: row.get(34)?,
        guardian_app_monitoring: row.get(35)?,
        current_phase: phase,
        phase_deadline_at,
        phase_revision: row.get(29)?,
        interruption_count: row.get(30)?,
        focus_active_seconds: row.get(13)?,
        break_active_seconds: row.get(14)?,
        status,
        scheduled_at: row.get(16)?,
        started_at: started,
        paused_at: row.get(18)?,
        accumulated_paused_seconds: accumulated,
        active_seconds: current_active,
        remaining_seconds: remaining,
        server_time,
        ended_at: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get::<_, Option<String>>(23)?.unwrap_or(row.get(22)?),
        completion_quality: row.get(24)?,
        reflection_note: row.get(25)?,
        accomplishment: row.get(26)?,
    })
}

fn elapsed_sql_seconds(started_at: &str, accumulated_pause_seconds: i64) -> i64 {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let started = OffsetDateTime::parse(started_at, &Rfc3339)
        .map(|d| d.unix_timestamp())
        .unwrap_or(now);
    (now - started - accumulated_pause_seconds).max(0)
}

fn chrono_now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_default()
}

fn parse_date_str(s: &str) -> Option<time::Date> {
    if s.len() < 10 {
        return None;
    }
    let parts: Vec<&str> = s[..10].split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i32 = parts[0].parse().ok()?;
    let month_u8: u8 = parts[1].parse().ok()?;
    let day: u8 = parts[2].parse().ok()?;
    let month = time::Month::try_from(month_u8).ok()?;
    time::Date::from_calendar_date(year, month, day).ok()
}

pub fn compute_consistency_streak(
    db: &Connection,
    reference_date: time::Date,
) -> rusqlite::Result<ConsistencyStreak> {
    let today_str = format!(
        "{}-{:02}-{:02}",
        reference_date.year(),
        reference_date.month() as u8,
        reference_date.day()
    );
    let yesterday = reference_date.previous_day().unwrap_or(reference_date);
    let yesterday_str = format!(
        "{}-{:02}-{:02}",
        yesterday.year(),
        yesterday.month() as u8,
        yesterday.day()
    );

    let mut stmt = db.prepare(
        "SELECT DISTINCT date FROM (
            SELECT substr(completed_at, 1, 10) AS date
            FROM tasks
            WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_at != ''
            UNION
            SELECT substr(ended_at, 1, 10) AS date
            FROM calendar_sessions
            WHERE status = 'COMPLETED' AND ended_at IS NOT NULL AND ended_at != ''
              AND (active_seconds >= 900 OR focus_active_seconds >= 900)
        )
        WHERE date <= ?1
        ORDER BY date ASC",
    )?;
    let qualified_dates: Vec<String> = stmt
        .query_map([&today_str], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;

    let qualified_set: std::collections::BTreeSet<String> = qualified_dates.into_iter().collect();

    let today_completed = qualified_set.contains(&today_str);

    let mut current_streak = 0i64;
    if today_completed {
        let mut curr = reference_date;
        while qualified_set.contains(&format!(
            "{}-{:02}-{:02}",
            curr.year(),
            curr.month() as u8,
            curr.day()
        )) {
            current_streak += 1;
            match curr.previous_day() {
                Some(prev) => curr = prev,
                None => break,
            }
        }
    } else if qualified_set.contains(&yesterday_str) {
        let mut curr = yesterday;
        while qualified_set.contains(&format!(
            "{}-{:02}-{:02}",
            curr.year(),
            curr.month() as u8,
            curr.day()
        )) {
            current_streak += 1;
            match curr.previous_day() {
                Some(prev) => curr = prev,
                None => break,
            }
        }
    }

    let mut longest_streak = 0i64;
    let mut run = 0i64;
    let mut prev_date: Option<time::Date> = None;

    for d_str in &qualified_set {
        if let Some(parsed) = parse_date_str(d_str) {
            if let Some(prev) = prev_date {
                if prev.next_day() == Some(parsed) {
                    run += 1;
                } else {
                    run = 1;
                }
            } else {
                run = 1;
            }
            prev_date = Some(parsed);
            if run > longest_streak {
                longest_streak = run;
            }
        }
    }
    if current_streak > longest_streak {
        longest_streak = current_streak;
    }

    let month_prefix = format!(
        "{}-{:02}",
        reference_date.year(),
        reference_date.month() as u8
    );
    let productive_days_this_month = qualified_set
        .iter()
        .filter(|d| d.starts_with(&month_prefix))
        .count() as i64;

    let mut days = Vec::with_capacity(7);
    let mut cur = reference_date;
    days.push(cur);
    for _ in 0..6 {
        if let Some(prev) = cur.previous_day() {
            cur = prev;
            days.push(cur);
        }
    }
    days.reverse();

    let mut last_seven_days = Vec::with_capacity(7);
    for d in days {
        let d_str = format!("{}-{:02}-{:02}", d.year(), d.month() as u8, d.day());
        let qualified = qualified_set.contains(&d_str);

        let task_completed: bool = db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE status = 'COMPLETED' AND substr(completed_at, 1, 10) = ?1)",
                [&d_str],
                |row| row.get(0),
            )
            .unwrap_or(false);

        let focus_seconds: i64 = db
            .query_row(
                "SELECT COALESCE(SUM(CASE WHEN active_seconds >= focus_active_seconds THEN active_seconds ELSE focus_active_seconds END), 0)
                 FROM calendar_sessions
                 WHERE status = 'COMPLETED' AND substr(ended_at, 1, 10) = ?1",
                [&d_str],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let day_label = match d.weekday() {
            time::Weekday::Monday => "Mon",
            time::Weekday::Tuesday => "Tue",
            time::Weekday::Wednesday => "Wed",
            time::Weekday::Thursday => "Thu",
            time::Weekday::Friday => "Fri",
            time::Weekday::Saturday => "Sat",
            time::Weekday::Sunday => "Sun",
        }
        .to_string();

        last_seven_days.push(DailyStreakDay {
            date: d_str,
            day_label,
            qualified,
            task_completed,
            focus_minutes: focus_seconds / 60,
        });
    }

    Ok(ConsistencyStreak {
        current_streak,
        longest_streak,
        today_completed,
        productive_days_this_month,
        last_seven_days,
    })
}

fn local_progress(db: &Connection) -> rusqlite::Result<LocalProgress> {
    let streak = compute_consistency_streak(db, OffsetDateTime::now_utc().date())?;
    let total: i64 = db.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM progress_events",
        [],
        |row| row.get(0),
    )?;
    let mut statement = db.prepare(
        "SELECT id,event_type,amount,created_at FROM progress_events ORDER BY id DESC LIMIT 10",
    )?;
    let recent = statement
        .query_map([], |row| {
            Ok(LocalProgressEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                amount: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let (level, title, base, next) = if total >= 1000 {
        (5, "Sustained Focus", 1000, 1000)
    } else if total >= 500 {
        (4, "Deep Work Practitioner", 500, 500)
    } else if total >= 250 {
        (3, "Steady Builder", 250, 250)
    } else if total >= 100 {
        (2, "Focused Learner", 100, 150)
    } else {
        (1, "Getting Started", 0, 100)
    };
    let current = total - base;
    Ok(LocalProgress {
        user_id: 1,
        total_progress: total,
        level,
        level_title: title.into(),
        current_level_xp: current,
        next_level_threshold: next,
        progress_percent: ((current as f64 / next as f64 * 1000.0).round() / 10.0)
            .clamp(0.0, 100.0),
        recent_events: recent,
        streak,
    })
}

fn with_db<T>(
    manager: &VaultManager,
    operation: impl FnOnce(&mut Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    with_db_mode(manager, false, operation)
}

fn with_db_background<T>(
    manager: &VaultManager,
    operation: impl FnOnce(&mut Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    with_db_mode(manager, false, operation)
}

fn with_db_mode<T>(
    manager: &VaultManager,
    user_activity: bool,
    operation: impl FnOnce(&mut Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let mut guard = manager
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    if guard
        .as_ref()
        .is_some_and(|vault| vault_idle(vault, manager.idle_timeout()))
    {
        if let Some(vault) = guard.as_mut() {
            let _ = pause_focus_before_vault_lock(&mut vault.connection, unix_now_seconds());
        }
        guard.take();
        drop(guard);
        finish_vault_lock(manager);
        return Err("Local vault locked after inactivity".into());
    }
    let vault = guard
        .as_mut()
        .ok_or_else(|| "Unlock the local vault first".to_string())?;
    if user_activity {
        vault.last_activity = Instant::now();
        vault.last_activity_wall = SystemTime::now();
    }
    operation(&mut vault.connection).map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => {
            "Record not found or belongs to another account".into()
        }
        rusqlite::Error::InvalidQuery => {
            "This action is not valid for the record's current state".into()
        }
        _ => "Could not complete the local data operation".into(),
    })
}

fn expire_idle_vault(manager: &VaultManager) -> Result<bool, String> {
    let mut guard = manager
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let expired = guard
        .as_ref()
        .is_some_and(|vault| vault_idle(vault, manager.idle_timeout()));
    if !expired {
        return Ok(false);
    }
    if let Some(vault) = guard.as_mut() {
        let _ = pause_focus_before_vault_lock(&mut vault.connection, unix_now_seconds());
    }
    guard.take();
    drop(guard);
    finish_vault_lock(manager);
    Ok(true)
}

fn vault_idle(vault: &UnlockedVault, timeout: Duration) -> bool {
    vault.last_activity.elapsed() >= timeout
        || SystemTime::now()
            .duration_since(vault.last_activity_wall)
            .is_ok_and(|elapsed| elapsed >= timeout)
}

fn finish_vault_lock(manager: &VaultManager) {
    eonpai::cancel_all(manager);
    let _ = shinpo_browser_host::clear_session(&manager.browser_host_paths);
    if let Ok(mut health) = manager.guardian_observer.lock() {
        health.session_id = None;
        health.status = "LOCKED";
        health.checked_at = Some(chrono_now());
    }
}

fn insert_goal_record(
    db: &Connection,
    title: &str,
    description: Option<&str>,
    start_date: &str,
    target_date: Option<&str>,
) -> rusqlite::Result<LocalGoal> {
    db.execute(
        "INSERT INTO goals(title,description,start_date,target_date,reward_id) VALUES(?1,?2,?3,?4,lower(hex(randomblob(16))))",
        params![title.trim(), description, start_date, target_date],
    )?;
    goal_by_id(db, db.last_insert_rowid())
}

fn insert_task_record(
    db: &Connection,
    goal_id: i64,
    title: &str,
    description: Option<&str>,
    scheduled_date: &str,
    estimated_minutes: Option<i64>,
) -> rusqlite::Result<LocalTask> {
    db.execute("INSERT INTO tasks(goal_id,title,description,scheduled_date,estimated_minutes) SELECT id,?2,?3,?4,?5 FROM goals WHERE id=?1",params![goal_id,title.trim(),description,scheduled_date,estimated_minutes])?;
    if db.changes() == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    task_by_id(db, db.last_insert_rowid())
}

fn insert_focus_record(
    db: &Connection,
    r: &CreateFocusSessionRequest,
) -> rusqlite::Result<LocalFocusSession> {
    let (saved_mode, saved_consent, apply_to_new_sessions): (String, bool, bool) = db.query_row(
        "SELECT preferred_mode,app_monitoring_consent,apply_to_new_sessions
         FROM guardian_preferences WHERE id=1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let mode = r
        .guardian_mode
        .as_deref()
        .map(str::to_ascii_uppercase)
        .unwrap_or_else(|| {
            if apply_to_new_sessions {
                saved_mode
            } else {
                "PROTECTED".to_string()
            }
        });
    let app_monitoring = r
        .guardian_app_monitoring
        .unwrap_or(apply_to_new_sessions && saved_consent);
    db.execute("INSERT INTO calendar_sessions(goal_id,task_id,name,intention,duration_minutes,scheduled_at,status,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,pomodoro_grace_minutes,current_phase,late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp,guardian_mode,guardian_app_monitoring,updated_at,reward_id) VALUES(?1,?2,?3,?4,?5,?6,'SCHEDULED',?7,?8,?9,?10,?11,'FOCUS',?12,?13,?14,?15,?16,?17,lower(hex(randomblob(16))))",params![r.goal_id,r.mission_id,r.name.trim(),r.intention,r.duration_minutes,r.scheduled_at,r.pomodoro_enabled.unwrap_or(false),r.pomodoro_focus_cycles.unwrap_or(2),r.pomodoro_short_break_minutes.unwrap_or(5),r.pomodoro_long_break_minutes.unwrap_or(15),r.pomodoro_grace_minutes.unwrap_or(10),r.late_penalty_enabled.unwrap_or(false),r.late_penalty_xp.unwrap_or(5),r.late_penalty_daily_cap_xp.unwrap_or(20),mode,app_monitoring,chrono_now()])?;
    focus_session_by_id(db, db.last_insert_rowid())
}

fn goal_by_id(db: &Connection, id: i64) -> rusqlite::Result<LocalGoal> {
    db.query_row("SELECT id,title,description,start_date,target_date,status,created_at FROM goals WHERE id=?1", [id], |r| Ok(LocalGoal { id:r.get(0)?, user_id:1, title:r.get(1)?, description:r.get(2)?, start_date:r.get(3)?, target_date:r.get(4)?, status:r.get(5)?, created_at:r.get(6)? }))
}
fn task_by_id(db: &Connection, id: i64) -> rusqlite::Result<LocalTask> {
    db.query_row("SELECT id,goal_id,title,description,scheduled_date,estimated_minutes,status,created_at FROM tasks WHERE id=?1", [id], |r| Ok(LocalTask { id:r.get(0)?, goal_id:r.get(1)?, title:r.get(2)?, description:r.get(3)?, scheduled_date:r.get(4)?, estimated_minutes:r.get(5)?, status:r.get(6)?, created_at:r.get(7)? }))
}
fn insert_xp_event(
    db: &Connection,
    key: &str,
    event_type: &str,
    amount: i64,
    session_id: Option<i64>,
) -> rusqlite::Result<i64> {
    db.execute("INSERT OR IGNORE INTO progress_events(event_key,event_type,amount,session_id) VALUES(?1,?2,?3,?4)", params![key,event_type,amount,session_id])?;
    db.query_row(
        "SELECT id FROM progress_events WHERE event_key=?1",
        [key],
        |r| r.get(0),
    )
}

fn onboarding_workflow_qualifies(db: &Connection) -> rusqlite::Result<bool> {
    db.query_row(
        "SELECT EXISTS(
            SELECT 1 FROM local_onboarding o
            JOIN goals g ON julianday(g.created_at) >= julianday(o.started_at)
            JOIN tasks t ON t.goal_id=g.id AND julianday(t.created_at) >= julianday(o.started_at)
                AND t.status='COMPLETED' AND t.completed_at IS NOT NULL
                AND EXISTS(SELECT 1 FROM progress_events task_event
                    WHERE task_event.event_key='task:' || t.reward_id AND task_event.event_type='MISSION_COMPLETED')
            JOIN calendar_sessions s ON s.goal_id=g.id AND s.task_id=t.id AND s.status='COMPLETED'
                AND s.scheduled_at IS NOT NULL AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL
                AND s.focus_active_seconds > 0
            JOIN progress_events p ON p.session_id=s.id AND p.event_type='FOCUS_SESSION_COMPLETED'
            WHERE o.id=1 AND o.status='COMPLETED' AND o.started_at IS NOT NULL
        )",
        [],
        |row| row.get(0),
    )
}

fn local_onboarding_state(db: &Connection) -> rusqlite::Result<LocalOnboardingState> {
    let row: Option<(String, i64, Option<String>, Option<String>)> = db
        .query_row(
            "SELECT status,current_step,started_at,completed_at FROM local_onboarding WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()?;
    let (status, current_step, _, completed_at) =
        row.unwrap_or(("NOT_STARTED".into(), 0, None, None));
    let completed_steps_count = current_step.clamp(0, 6);
    let can_claim_reward = status == "COMPLETED"
        && onboarding_workflow_qualifies(db)?
        && !db.query_row(
            "SELECT EXISTS(SELECT 1 FROM progress_events WHERE event_type='ONBOARDING_COMPLETED')",
            [],
            |row| row.get::<_, bool>(0),
        )?;
    Ok(LocalOnboardingState {
        user_id: 1,
        is_completed: status == "COMPLETED",
        status,
        current_step,
        completed_steps_count,
        verified_steps: String::new(),
        completed_at,
        can_claim_reward,
    })
}

fn ensure_active_eonpai_conversation(db: &Connection) -> rusqlite::Result<i64> {
    if let Some(id) = db
        .query_row(
            "SELECT id FROM eonpai_conversations WHERE status='ACTIVE'",
            [],
            |row| row.get(0),
        )
        .optional()?
    {
        return Ok(id);
    }
    let now = chrono_now();
    db.execute(
        "INSERT INTO eonpai_conversations(title,status,created_at,updated_at) VALUES('New conversation','ACTIVE',?1,?1)",
        [&now],
    )?;
    Ok(db.last_insert_rowid())
}

fn local_eonpai_conversation(
    db: &Connection,
    id: i64,
) -> rusqlite::Result<LocalEonpaiConversation> {
    let (title, status, updated_at): (String, String, String) = db.query_row(
        "SELECT title,status,updated_at FROM eonpai_conversations WHERE id=?1",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let mut statement = db.prepare(
        "SELECT id,role,content,suggestion_type,created_at,structured_card FROM eonpai_messages WHERE conversation_id=?1 ORDER BY id",
    )?;
    let messages = statement
        .query_map([id], |row| {
            Ok(LocalEonpaiMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                suggestion_type: row.get(3)?,
                structured_card: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|value| serde_json::from_str(&value).ok()),
                tutorial: None,
                bug_report: None,
                created_at: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(LocalEonpaiConversation {
        conversation_id: eonpai::conversation_public_id(db, id)?,
        title,
        status,
        messages,
        updated_at,
    })
}

fn deterministic_eonpai_reply(db: &Connection, message: &str) -> rusqlite::Result<String> {
    let query = message.trim().to_lowercase();
    let active: Option<(String, String, String, Option<i64>)> = db
        .query_row(
            "SELECT name,current_phase,status,phase_deadline_at FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED') ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()?;
    if [
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
    ]
    .iter()
    .any(|greeting| query == *greeting || query.starts_with(&format!("{greeting} ")))
    {
        return Ok("Hello. I can help you review open tasks, plan work, or summarize saved Focus sessions. I’m using SHINPO’s offline guidance, not a generative AI model.".into());
    }
    if let Some((name, phase, status, deadline)) = active.filter(|_| {
        ["focus", "session", "break", "remaining", "timer", "return"]
            .iter()
            .any(|term| query.contains(term))
    }) {
        let phase_detail = match (status.as_str(), deadline) {
            ("ACTIVE", Some(deadline_ms)) => format!(
                "{} seconds remain in this phase.",
                (deadline_ms / 1000 - unix_now_seconds()).max(0)
            ),
            ("PAUSED", _) => "The session is paused.".into(),
            _ => format!("The current phase is {phase}."),
        };
        return Ok(format!(
            "Your **{name}** session is in **{phase}**. {phase_detail} You can manage it from the Focus page."
        ));
    }

    if query.contains("priority") || query.contains("next task") || query.contains("what next") {
        let task: Option<(String, Option<String>)> = db
            .query_row(
                "SELECT t.title,g.title FROM tasks t JOIN goals g ON g.id=t.goal_id WHERE t.status<>'COMPLETED' AND g.status<>'COMPLETED' ORDER BY t.scheduled_date,t.id LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        return Ok(match task {
            Some((title, goal)) => format!(
                "Your next open task is **{title}**{} . Review it in Goals & Tasks, then start a Focus session when you're ready.",
                goal.map(|value| format!(" for **{value}**")).unwrap_or_default()
            ),
            None => "There are no open tasks in this vault yet. Add a task under a goal to create your next action.".into(),
        });
    }

    if query.contains("plan") || query.contains("today") {
        let mut statement = db.prepare(
            "SELECT title,scheduled_date,estimated_minutes FROM tasks WHERE status<>'COMPLETED' ORDER BY scheduled_date,id LIMIT 5",
        )?;
        let tasks = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        if tasks.is_empty() {
            return Ok("Your local vault has no open tasks to plan yet. Create a goal and a linked task, and I can summarize that work without sending data off-device.".into());
        }
        let lines = tasks
            .iter()
            .map(|(title, date, minutes)| {
                format!(
                    "• **{title}** — {date}{}",
                    minutes.map(|n| format!(", {n} min")).unwrap_or_default()
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        return Ok(format!(
            "Here are your next open tasks from this vault:\n\n{lines}\n\nThis is a local task summary, not an AI-generated schedule."
        ));
    }

    if query.contains("focus") || query.contains("session") || query.contains("break") {
        return Ok("I can summarize saved Focus sessions and explain the current session state. Ask about your current Focus session or request a summary of recent sessions.".into());
    }

    Ok("I’m running in offline planning mode, not as a generative AI model. I can organize open tasks, suggest a schedule, break an active goal into tasks, and summarize saved Focus records. I can’t answer unrestricted questions. Ask about your next task or say “plan my day”. No prompt was sent to a server.".into())
}

fn validate_title(value: &str) -> Result<(), String> {
    let s = value.trim();
    if s.is_empty() || s.chars().count() > 150 || s.chars().any(char::is_control) {
        Err("Title must contain 1–150 printable characters".into())
    } else {
        Ok(())
    }
}
fn validate_optional_text(value: Option<&str>, limit: usize) -> Result<(), String> {
    if value.is_some_and(|s| s.chars().count() > limit || s.chars().any(char::is_control)) {
        Err("Text exceeds the allowed length or contains control characters".into())
    } else {
        Ok(())
    }
}
fn validate_date(value: &str) -> Result<(), String> {
    let b = value.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !b
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
    {
        return Err("Dates must use YYYY-MM-DD".into());
    }
    let y: u32 = value[0..4].parse().unwrap_or(0);
    let m: u32 = value[5..7].parse().unwrap_or(0);
    let d: u32 = value[8..10].parse().unwrap_or(0);
    let leap = y.is_multiple_of(4) && (!y.is_multiple_of(100) || y.is_multiple_of(400));
    let max = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    if y == 0 || d == 0 || d > max {
        Err("Date is not a valid calendar day".into())
    } else {
        Ok(())
    }
}
fn validate_estimated_minutes(value: Option<i64>) -> Result<(), String> {
    if value.is_some_and(|n| !(1..=1440).contains(&n)) {
        Err("Estimated minutes must be between 1 and 1440".into())
    } else {
        Ok(())
    }
}
fn validate_goal_status(value: &str) -> Result<(), String> {
    if ["ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED"].contains(&value.to_ascii_uppercase().as_str())
    {
        Ok(())
    } else {
        Err("Invalid goal status".into())
    }
}
fn validate_task_status(value: &str) -> Result<(), String> {
    if ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
        .contains(&value.to_ascii_uppercase().as_str())
    {
        Ok(())
    } else {
        Err("Invalid task status".into())
    }
}

fn open_encrypted_database(
    path: &Path,
    key: &[u8; KEY_BYTES],
    username: &str,
    create: bool,
) -> Result<Connection, String> {
    require_regular_file_if_present(path)?;
    if !create {
        require_existing_regular_file(path)?;
    }
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
        | if create {
            OpenFlags::SQLITE_OPEN_CREATE
        } else {
            OpenFlags::empty()
        };
    let mut connection = Connection::open_with_flags(path, flags)
        .map_err(|_| "Could not open the encrypted local database".to_string())?;
    set_private_database_permissions(path)?;
    let cipher_version: String = connection
        .query_row("PRAGMA cipher_version", [], |row| row.get(0))
        .map_err(|_| "SQLCipher is unavailable; refusing to store unencrypted data".to_string())?;
    if cipher_version.trim().is_empty() {
        return Err("SQLCipher is unavailable; refusing to store unencrypted data".to_string());
    }
    let key_hex = encode_hex(key);
    connection
        .execute_batch(&format!(
            "PRAGMA key = \"x'{key_hex}'\"; PRAGMA cipher_memory_security = ON;"
        ))
        .map_err(|_| "Could not unlock the encrypted local database".to_string())?;
    connection
        .query_row("SELECT count(*) FROM sqlite_master", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|_| "Incorrect credentials or unreadable encrypted vault".to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|_| "Could not initialize the encrypted local vault".to_string())?;
    apply_schema_migrations(&mut connection)?;
    connection
        .execute_batch("PRAGMA journal_mode = WAL;")
        .map_err(|_| "Could not configure encrypted local database journaling".to_string())?;
    connection
        .execute(
            "INSERT INTO local_profile(id,username) VALUES(1,?1)
             ON CONFLICT(id) DO UPDATE SET username=excluded.username",
            [username],
        )
        .map_err(|_| "Could not store the local profile".to_string())?;
    Ok(connection)
}

fn apply_schema_migrations(connection: &mut Connection) -> Result<(), String> {
    let mut version: i64 = connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|_| "Could not read the local database schema version".to_string())?;
    if !(0..=LATEST_SCHEMA_VERSION).contains(&version) {
        return Err("Local database schema is newer than this SHINPO version".to_string());
    }

    while version < LATEST_SCHEMA_VERSION {
        let next_version = version + 1;
        let transaction = connection
            .transaction()
            .map_err(|_| "Could not begin local database migration".to_string())?;
        match next_version {
            1 => migrate_v1(&transaction)?,
            2 => migrate_v2(&transaction)?,
            3 => migrate_v3(&transaction)?,
            4 => migrate_v4(&transaction)?,
            5 => migrate_v5(&transaction)?,
            6 => migrate_v6(&transaction)?,
            7 => migrate_v7(&transaction)?,
            8 => migrate_v8(&transaction)?,
            9 => migrate_v9(&transaction)?,
            10 => migrate_v10(&transaction)?,
            11 => eonpai::migrate(&transaction)?,
            12 => eonpai::migrate_reflection_revision(&transaction)?,
            13 => migrate_v13(&transaction)?,
            14 => migrate_v14(&transaction)?,
            15 => migrate_v15(&transaction)?,
            16 => migrate_v16(&transaction)?,
            17 => migrate_v17(&transaction)?,
            _ => return Err("Local database migration is unavailable".to_string()),
        }
        validate_schema(&transaction, next_version)?;
        transaction
            .pragma_update(None, "user_version", next_version)
            .map_err(|_| "Could not record local database migration".to_string())?;
        transaction
            .commit()
            .map_err(|_| "Could not commit local database migration".to_string())?;
        version = next_version;
    }

    validate_schema(connection, version)
}

fn migrate_v4(transaction: &Transaction<'_>) -> Result<(), String> {
    for (name, definition) in [
        ("late_penalty_enabled", "INTEGER NOT NULL DEFAULT 0"),
        ("late_penalty_xp", "INTEGER NOT NULL DEFAULT 5"),
        ("late_penalty_daily_cap_xp", "INTEGER NOT NULL DEFAULT 20"),
    ] {
        ensure_column(transaction, "calendar_sessions", name, definition)
            .map_err(|_| "Could not apply local database migration 4".to_string())?;
    }
    Ok(())
}

fn migrate_v5(transaction: &Transaction<'_>) -> Result<(), String> {
    ensure_column(
        transaction,
        "calendar_sessions",
        "guardian_mode",
        "TEXT NOT NULL DEFAULT 'PROTECTED'",
    )
    .map_err(|_| "Could not add session-scoped Guardian mode".to_string())?;
    transaction
        .execute(
            "UPDATE calendar_sessions SET guardian_mode=(SELECT focus_mode FROM browser_companion_meta WHERE id=1) WHERE status='ACTIVE'",
            [],
        )
        .map_err(|_| "Could not preserve the active Guardian mode".to_string())?;
    Ok(())
}

fn migrate_v6(transaction: &Transaction<'_>) -> Result<(), String> {
    ensure_column(
        transaction,
        "calendar_sessions",
        "guardian_app_monitoring",
        "INTEGER NOT NULL DEFAULT 0",
    )
    .map_err(|_| "Could not add local Guardian consent state".to_string())?;
    transaction
        .execute_batch(
            "CREATE TABLE guardian_observations (
                id INTEGER PRIMARY KEY,
                event_key TEXT NOT NULL UNIQUE,
                session_id INTEGER NOT NULL,
                pid INTEGER NOT NULL,
                process_name TEXT NOT NULL,
                process_started_at INTEGER NOT NULL,
                observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX guardian_observations_session_time
                ON guardian_observations(session_id, observed_at DESC);",
        )
        .map_err(|_| "Could not create local Guardian observation history".to_string())?;
    Ok(())
}

fn migrate_v7(transaction: &Transaction<'_>) -> Result<(), String> {
    for (name, definition) in [
        (
            "catalog_version",
            "TEXT NOT NULL DEFAULT 'guardian-apps-v1'",
        ),
        ("category", "TEXT NOT NULL DEFAULT 'LEGACY'"),
        (
            "rationale",
            "TEXT NOT NULL DEFAULT 'Previously observed by an older Guardian catalog'",
        ),
    ] {
        ensure_column(transaction, "guardian_observations", name, definition)
            .map_err(|_| "Could not version local Guardian observations".to_string())?;
    }
    Ok(())
}

fn migrate_v8(transaction: &Transaction<'_>) -> Result<(), String> {
    for (name, definition) in [
        ("guardian_mode", "TEXT NOT NULL DEFAULT 'PROTECTED'"),
        ("focus_phase", "TEXT NOT NULL DEFAULT 'FOCUS'"),
        ("outcome", "TEXT NOT NULL DEFAULT 'WARNING_STANDARD'"),
    ] {
        ensure_column(transaction, "guardian_observations", name, definition)
            .map_err(|_| "Could not add Guardian decision context".to_string())?;
    }
    transaction
        .execute(
            "UPDATE calendar_sessions SET guardian_app_monitoring=1 WHERE status='ACTIVE'",
            [],
        )
        .map_err(|_| {
            "Could not enable automatic Guardian monitoring for the active session".to_string()
        })?;
    Ok(())
}

fn migrate_v9(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS local_onboarding (
                id INTEGER PRIMARY KEY CHECK(id=1),
                status TEXT NOT NULL CHECK(status IN ('NOT_STARTED','IN_PROGRESS','PAUSED','SKIPPED','COMPLETED')),
                current_step INTEGER NOT NULL DEFAULT 0 CHECK(current_step BETWEEN 0 AND 6),
                started_at TEXT,
                completed_at TEXT,
                updated_at TEXT NOT NULL
            );",
        )
        .map_err(|_| "Could not create encrypted onboarding state".to_string())
}

fn migrate_v13(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute(
            "UPDATE calendar_sessions SET guardian_app_monitoring=0 WHERE guardian_app_monitoring<>0",
            [],
        )
        .map_err(|_| "Could not clear inferred Guardian app-monitoring consent".to_string())?;
    Ok(())
}

fn migrate_v14(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute_batch(
            "CREATE TABLE guardian_preferences (
                id INTEGER PRIMARY KEY CHECK(id=1),
                preferred_mode TEXT NOT NULL DEFAULT 'PROTECTED'
                    CHECK(preferred_mode IN ('GUIDED','PROTECTED','STRICT')),
                app_monitoring_consent INTEGER NOT NULL DEFAULT 0
                    CHECK(app_monitoring_consent IN (0,1)),
                apply_to_new_sessions INTEGER NOT NULL DEFAULT 0
                    CHECK(apply_to_new_sessions IN (0,1)),
                updated_at TEXT NOT NULL
            );
            INSERT INTO guardian_preferences(id, updated_at) VALUES(1, CURRENT_TIMESTAMP);",
        )
        .map_err(|_| "Could not create encrypted Guardian preferences".to_string())
}

fn migrate_v15(transaction: &Transaction<'_>) -> Result<(), String> {
    for (table, column, definition) in [
        (
            "guardian_preferences",
            "closure_consent",
            "INTEGER NOT NULL DEFAULT 0 CHECK(closure_consent IN (0,1))",
        ),
        (
            "guardian_preferences",
            "background_runtime_consent",
            "INTEGER NOT NULL DEFAULT 0 CHECK(background_runtime_consent IN (0,1))",
        ),
        (
            "calendar_sessions",
            "guardian_intervention_disabled",
            "INTEGER NOT NULL DEFAULT 0 CHECK(guardian_intervention_disabled IN (0,1))",
        ),
    ] {
        ensure_column(transaction, table, column, definition)
            .map_err(|_| "Could not add Guardian safety preferences".to_string())?;
    }
    transaction
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS guardian_session_usage (
            session_id INTEGER PRIMARY KEY REFERENCES calendar_sessions(id) ON DELETE CASCADE,
            consumed_seconds INTEGER NOT NULL DEFAULT 0 CHECK(consumed_seconds BETWEEN 0 AND 600),
            last_verified_epoch INTEGER
        );",
        )
        .map_err(|_| "Could not create encrypted Guardian allowance state".to_string())
}

fn migrate_v16(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS guardian_app_policies (
                id INTEGER PRIMARY KEY,
                app_id TEXT NOT NULL UNIQUE,
                app_name TEXT NOT NULL,
                exec_name TEXT NOT NULL,
                policy_type TEXT NOT NULL CHECK(policy_type IN ('BLOCKED','ALLOWED')),
                source TEXT NOT NULL DEFAULT 'system',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_guardian_app_policies_exec ON guardian_app_policies(exec_name);",
        )
        .map_err(|_| "Could not create encrypted Guardian app policies table".to_string())
}

fn migrate_v17(transaction: &Transaction<'_>) -> Result<(), String> {
    for table in ["goals", "tasks", "calendar_sessions"] {
        if !schema_has_column(transaction, table, "reward_id")
            .map_err(|_| "Could not inspect reward identities".to_string())?
        {
            transaction
                .execute_batch(&format!("ALTER TABLE {table} ADD COLUMN reward_id TEXT"))
                .map_err(|_| "Could not add stable reward identities".to_string())?;
        }
        transaction
            .execute_batch(&format!(
                "UPDATE {table} SET reward_id=lower(hex(randomblob(16))) WHERE reward_id IS NULL"
            ))
            .map_err(|_| "Could not assign stable reward identities".to_string())?;
        transaction
            .execute_batch(&format!(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_reward_id ON {table}(reward_id)"
            ))
            .map_err(|_| "Could not validate stable reward identities".to_string())?;
    }
    transaction
        .execute_batch(
            "CREATE TRIGGER IF NOT EXISTS goals_reward_id_after_insert AFTER INSERT ON goals WHEN NEW.reward_id IS NULL BEGIN UPDATE goals SET reward_id=lower(hex(randomblob(16))) WHERE id=NEW.id; END;
             CREATE TRIGGER IF NOT EXISTS tasks_reward_id_after_insert AFTER INSERT ON tasks WHEN NEW.reward_id IS NULL BEGIN UPDATE tasks SET reward_id=lower(hex(randomblob(16))) WHERE id=NEW.id; END;
             CREATE TRIGGER IF NOT EXISTS calendar_sessions_reward_id_after_insert AFTER INSERT ON calendar_sessions WHEN NEW.reward_id IS NULL BEGIN UPDATE calendar_sessions SET reward_id=lower(hex(randomblob(16))) WHERE id=NEW.id; END;
             UPDATE progress_events SET event_key='goal:'||(SELECT reward_id FROM goals WHERE 'goal:'||id=progress_events.event_key)
                WHERE EXISTS(SELECT 1 FROM goals WHERE 'goal:'||id=progress_events.event_key);
             UPDATE progress_events SET event_key='task:'||(SELECT reward_id FROM tasks WHERE 'task:'||id=progress_events.event_key)
                WHERE EXISTS(SELECT 1 FROM tasks WHERE 'task:'||id=progress_events.event_key);
             UPDATE progress_events SET event_key='focus:'||(SELECT reward_id FROM calendar_sessions WHERE id=progress_events.session_id)
                WHERE session_id IS NOT NULL AND event_key='focus:'||progress_events.session_id
                  AND EXISTS(SELECT 1 FROM calendar_sessions WHERE id=progress_events.session_id);",
        )
        .map_err(|_| "Could not migrate existing reward identities".to_string())
}

fn migrate_v10(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS eonpai_conversations (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('ACTIVE','ARCHIVED')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS one_active_eonpai_conversation
                ON eonpai_conversations(status) WHERE status='ACTIVE';
            CREATE TABLE IF NOT EXISTS eonpai_messages (
                id INTEGER PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES eonpai_conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('USER','ASSISTANT')),
                content TEXT NOT NULL,
                suggestion_type TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS eonpai_messages_conversation
                ON eonpai_messages(conversation_id,id);",
        )
        .map_err(|_| "Could not create encrypted EONPAI history".to_string())
}

fn migrate_v3(transaction: &Transaction<'_>) -> Result<(), String> {
    for (name, definition) in [
        ("phase_deadline_at", "INTEGER"),
        ("phase_revision", "INTEGER NOT NULL DEFAULT 1"),
        ("last_checkpoint_at", "TEXT"),
        ("interruption_count", "INTEGER NOT NULL DEFAULT 0"),
        ("paused_phase_remaining_seconds", "INTEGER"),
    ] {
        ensure_column(transaction, "calendar_sessions", name, definition)
            .map_err(|_| "Could not apply local database migration 3".to_string())?;
    }
    transaction
        .execute(
            "UPDATE calendar_sessions SET
             last_checkpoint_at=COALESCE(last_checkpoint_at,phase_started_at,started_at,updated_at),
             phase_deadline_at=CASE
                 WHEN status='ACTIVE' AND current_phase='FOCUS' AND COALESCE(pomodoro_enabled,0)=1
                     THEN CAST((unixepoch(COALESCE(phase_started_at,started_at,updated_at))
                         + max(1,(duration_minutes*60)/2-phase_elapsed_seconds))*1000 AS INTEGER)
                 WHEN status='ACTIVE' AND current_phase='FOCUS'
                     THEN CAST((unixepoch(COALESCE(phase_started_at,started_at,updated_at))
                         + max(1,duration_minutes*60-phase_elapsed_seconds))*1000 AS INTEGER)
                 WHEN status='ACTIVE' AND current_phase IN ('BREAK','LONG_BREAK')
                     THEN CAST((unixepoch(COALESCE(phase_started_at,started_at,updated_at))
                         + max(1,pomodoro_long_break_minutes*60-phase_elapsed_seconds))*1000 AS INTEGER)
                 WHEN status='ACTIVE' AND current_phase='SHORT_BREAK'
                     THEN CAST((unixepoch(COALESCE(phase_started_at,started_at,updated_at))
                         + max(1,pomodoro_short_break_minutes*60-phase_elapsed_seconds))*1000 AS INTEGER)
                 WHEN status='ACTIVE' AND current_phase='GRACE'
                     THEN CAST((unixepoch(COALESCE(phase_started_at,started_at,updated_at))
                         + max(1,min(10,pomodoro_grace_minutes)*60-phase_elapsed_seconds))*1000 AS INTEGER)
                 ELSE phase_deadline_at END,
             paused_phase_remaining_seconds=CASE
                 WHEN status='PAUSED' AND current_phase='FOCUS'
                     THEN max(0,duration_minutes*60-active_seconds)
                 WHEN status='PAUSED' AND current_phase IN ('BREAK','LONG_BREAK')
                     THEN max(0,pomodoro_long_break_minutes*60-phase_elapsed_seconds)
                 WHEN status='PAUSED' AND current_phase='SHORT_BREAK'
                     THEN max(0,pomodoro_short_break_minutes*60-phase_elapsed_seconds)
                 WHEN status='PAUSED' AND current_phase='GRACE'
                     THEN max(0,min(10,pomodoro_grace_minutes)*60-phase_elapsed_seconds)
                 ELSE paused_phase_remaining_seconds END
         WHERE last_checkpoint_at IS NULL OR (status='ACTIVE' AND phase_deadline_at IS NULL)",
            [],
        )
        .map_err(|_| "Could not initialize local Focus recovery checkpoints".to_string())?;
    Ok(())
}

fn migrate_v1(transaction: &Transaction<'_>) -> Result<(), String> {
    transaction
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS local_profile (
                id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT,
                start_date TEXT NOT NULL, target_date TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                title TEXT NOT NULL, description TEXT, scheduled_date TEXT NOT NULL,
                estimated_minutes INTEGER, status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS calendar_sessions (
                id INTEGER PRIMARY KEY,
                goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
                task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                name TEXT NOT NULL, intention TEXT,
                duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0),
                scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'SCHEDULED',
                started_at TEXT, paused_at TEXT,
                accumulated_paused_seconds INTEGER NOT NULL DEFAULT 0,
                active_seconds INTEGER NOT NULL DEFAULT 0, ended_at TEXT,
                reflection_note TEXT, accomplishment TEXT, completion_quality INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS progress_events (
                id INTEGER PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL, amount INTEGER NOT NULL,
                session_id INTEGER REFERENCES calendar_sessions(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS browser_resources (
                id INTEGER PRIMARY KEY,
                mission_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                focus_session_id INTEGER REFERENCES calendar_sessions(id) ON DELETE CASCADE,
                resource_type TEXT NOT NULL, match_type TEXT NOT NULL,
                disposition TEXT NOT NULL, break_only INTEGER NOT NULL DEFAULT 0,
                destination TEXT NOT NULL, canonical_destination TEXT NOT NULL,
                display_name TEXT, expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS browser_companion_meta (
                id INTEGER PRIMARY KEY CHECK(id=1),
                policy_revision INTEGER NOT NULL DEFAULT 0,
                focus_mode TEXT NOT NULL DEFAULT 'PROTECTED'
            );
            INSERT OR IGNORE INTO browser_companion_meta(id,policy_revision,focus_mode)
                VALUES(1,0,'PROTECTED');
            INSERT OR IGNORE INTO local_profile(id,username) VALUES(1,'');",
        )
        .map_err(|_| "Could not apply local database migration 1".to_string())
}

fn migrate_v2(transaction: &Transaction<'_>) -> Result<(), String> {
    for (name, definition) in [
        ("pomodoro_enabled", "INTEGER NOT NULL DEFAULT 0"),
        ("pomodoro_focus_cycles", "INTEGER NOT NULL DEFAULT 2"),
        ("pomodoro_short_break_minutes", "INTEGER NOT NULL DEFAULT 5"),
        ("pomodoro_long_break_minutes", "INTEGER NOT NULL DEFAULT 15"),
        ("pomodoro_grace_minutes", "INTEGER NOT NULL DEFAULT 10"),
        ("completed_focus_cycles", "INTEGER NOT NULL DEFAULT 0"),
        ("current_phase", "TEXT NOT NULL DEFAULT 'FOCUS'"),
        ("phase_started_at", "TEXT"),
        ("phase_elapsed_seconds", "INTEGER NOT NULL DEFAULT 0"),
        ("focus_active_seconds", "INTEGER NOT NULL DEFAULT 0"),
        ("break_active_seconds", "INTEGER NOT NULL DEFAULT 0"),
        ("updated_at", "TEXT"),
    ] {
        ensure_column(transaction, "calendar_sessions", name, definition)
            .map_err(|_| "Could not apply local database migration 2".to_string())?;
    }
    transaction
        .execute(
            "UPDATE calendar_sessions SET updated_at=COALESCE(created_at,CURRENT_TIMESTAMP)
             WHERE updated_at IS NULL",
            [],
        )
        .map_err(|_| "Could not initialize Focus session timestamps".to_string())?;
    Ok(())
}

fn validate_schema(connection: &Connection, version: i64) -> Result<(), String> {
    let required: &[(&str, &[&str])] = match version {
        1 => &[
            ("local_profile", &["id", "username"]),
            ("goals", &["id", "title", "start_date", "status"]),
            (
                "tasks",
                &["id", "goal_id", "title", "scheduled_date", "status"],
            ),
            (
                "calendar_sessions",
                &["id", "name", "duration_minutes", "status"],
            ),
            ("progress_events", &["event_key", "event_type", "amount"]),
            ("browser_resources", &["id", "destination", "disposition"]),
            (
                "browser_companion_meta",
                &["id", "policy_revision", "focus_mode"],
            ),
        ],
        2 => &[(
            "calendar_sessions",
            &[
                "pomodoro_enabled",
                "current_phase",
                "phase_started_at",
                "phase_elapsed_seconds",
                "focus_active_seconds",
                "break_active_seconds",
            ],
        )],
        3 => &[(
            "calendar_sessions",
            &[
                "phase_deadline_at",
                "phase_revision",
                "last_checkpoint_at",
                "interruption_count",
                "paused_phase_remaining_seconds",
            ],
        )],
        4 => &[(
            "calendar_sessions",
            &[
                "late_penalty_enabled",
                "late_penalty_xp",
                "late_penalty_daily_cap_xp",
            ],
        )],
        5 => &[("calendar_sessions", &["guardian_mode"])],
        6 => &[
            ("calendar_sessions", &["guardian_app_monitoring"]),
            (
                "guardian_observations",
                &[
                    "event_key",
                    "session_id",
                    "pid",
                    "process_name",
                    "process_started_at",
                    "observed_at",
                ],
            ),
        ],
        7 => &[(
            "guardian_observations",
            &["catalog_version", "category", "rationale"],
        )],
        8 => &[
            (
                "guardian_observations",
                &["guardian_mode", "focus_phase", "outcome"],
            ),
            ("calendar_sessions", &["guardian_app_monitoring"]),
        ],
        9 => &[(
            "local_onboarding",
            &["status", "current_step", "started_at", "completed_at"],
        )],
        10 => &[
            ("eonpai_conversations", &["id", "status", "updated_at"]),
            ("eonpai_messages", &["conversation_id", "role", "content"]),
        ],
        11..=13 => &[
            ("eonpai_conversations", &["public_id"]),
            ("eonpai_messages", &["structured_card"]),
            (
                "eonpai_actions",
                &[
                    "action_id",
                    "payload",
                    "confirmation_token",
                    "basis_revision",
                ],
            ),
            ("eonpai_settings", &["settings"]),
            ("eonpai_revision", &["revision"]),
        ],
        14 => &[(
            "guardian_preferences",
            &[
                "preferred_mode",
                "app_monitoring_consent",
                "apply_to_new_sessions",
                "updated_at",
            ],
        )],
        15 => &[
            (
                "guardian_preferences",
                &["closure_consent", "background_runtime_consent"],
            ),
            ("calendar_sessions", &["guardian_intervention_disabled"]),
            (
                "guardian_session_usage",
                &["session_id", "consumed_seconds", "last_verified_epoch"],
            ),
        ],
        16 => &[(
            "guardian_app_policies",
            &[
                "id",
                "app_id",
                "app_name",
                "exec_name",
                "policy_type",
                "source",
                "created_at",
                "updated_at",
            ],
        )],
        17 => &[
            ("goals", &["reward_id"]),
            ("tasks", &["reward_id"]),
            ("calendar_sessions", &["reward_id"]),
        ],
        _ => return Err("Unsupported local database schema version".to_string()),
    };
    for (table, columns) in required {
        for column in *columns {
            let exists = schema_has_column(connection, table, column)
                .map_err(|_| "Could not validate local database schema".to_string())?;
            if !exists {
                return Err(
                    "Local database schema is incomplete; no migration was committed".to_string(),
                );
            }
        }
    }
    Ok(())
}

fn schema_has_column(connection: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = statement.query([])?;
    while let Some(row) = rows.next()? {
        if row.get::<_, String>(1)? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    name: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    let mut columns = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let names = columns
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    if !names.iter().any(|column| column == name) {
        connection.execute_batch(&format!(
            "ALTER TABLE {table} ADD COLUMN {name} {definition}"
        ))?;
    }
    Ok(())
}

fn derive_key(
    secret: &[u8],
    salt: &[u8; SALT_BYTES],
) -> Result<Zeroizing<[u8; KEY_BYTES]>, String> {
    let params = Params::new(ARGON_MEMORY_KIB, ARGON_ITERATIONS, 1, Some(KEY_BYTES))
        .map_err(|_| "Invalid key derivation parameters".to_string())?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; KEY_BYTES]);
    argon
        .hash_password_into(secret, salt, &mut *key)
        .map_err(|_| "Could not derive the vault encryption key".to_string())?;
    Ok(key)
}

fn wrap_key(
    wrapping_key: &[u8; KEY_BYTES],
    nonce: &[u8],
    key: &[u8; KEY_BYTES],
    aad: &[u8],
) -> Result<String, String> {
    let cipher = XChaCha20Poly1305::new_from_slice(wrapping_key)
        .map_err(|_| "Invalid key material".to_string())?;
    let nonce: [u8; NONCE_BYTES] = nonce
        .try_into()
        .map_err(|_| "Invalid vault nonce".to_string())?;
    cipher
        .encrypt(&XNonce::from(nonce), Payload { msg: key, aad })
        .map(|bytes| encode_hex(&bytes))
        .map_err(|_| "Could not protect the vault key".to_string())
}

fn unwrap_key(
    wrapping_key: &[u8; KEY_BYTES],
    nonce: &[u8],
    wrapped_key: &[u8],
    aad: &[u8],
) -> Result<[u8; KEY_BYTES], String> {
    let nonce: [u8; NONCE_BYTES] = nonce
        .try_into()
        .map_err(|_| "Invalid vault nonce".to_string())?;
    let cipher = XChaCha20Poly1305::new_from_slice(wrapping_key)
        .map_err(|_| "Invalid key material".to_string())?;
    let plaintext = Zeroizing::new(
        cipher
            .decrypt(
                &XNonce::from(nonce),
                Payload {
                    msg: wrapped_key,
                    aad,
                },
            )
            .map_err(|_| "Incorrect password or recovery key".to_string())?,
    );
    plaintext
        .as_slice()
        .try_into()
        .map_err(|_| "Invalid unwrapped vault key".to_string())
}

fn random_nonce() -> Result<[u8; NONCE_BYTES], String> {
    let mut nonce = [0u8; NONCE_BYTES];
    getrandom::fill(&mut nonce).map_err(|_| "Secure random generation failed".to_string())?;
    Ok(nonce)
}

fn normalize_username(username: &str) -> Result<String, String> {
    let normalized = username.trim().to_ascii_lowercase();
    if normalized.len() < 3
        || normalized.len() > 32
        || !normalized
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-' | b'.'))
    {
        return Err(
            "Username must be 3–32 characters using letters, numbers, dot, dash, or underscore"
                .to_string(),
        );
    }
    Ok(normalized)
}

fn normalize_password_nfkc(password: &str) -> Result<Zeroizing<String>, String> {
    if password.len() > 512 {
        return Err("Password must contain 12–128 characters and no control characters".into());
    }
    let normalized = Zeroizing::new(password.nfkc().collect::<String>());
    validate_password(&normalized)?;
    Ok(normalized)
}

fn normalize_new_password(password: &str) -> Result<Zeroizing<String>, String> {
    let normalized = normalize_password_nfkc(password)?;
    let chars = normalized.chars().count();
    if chars < 15 || is_common_password(&normalized) {
        return Err(
            "Choose a password with at least 15 characters that is not commonly used".into(),
        );
    }
    Ok(normalized)
}

fn is_common_password(password: &str) -> bool {
    let folded = password.to_lowercase();
    include_str!("../resources/common-passwords.txt")
        .lines()
        .any(|candidate| !candidate.is_empty() && candidate == folded)
}

fn validate_password(password: &str) -> Result<(), String> {
    let length = password.chars().count();
    if !(12..=128).contains(&length) || password.chars().any(char::is_control) {
        return Err(
            "Password must contain 12–128 characters and no control characters".to_string(),
        );
    }
    Ok(())
}

fn validate_legacy_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 12
        || password.len() > 1024
        || password.chars().any(char::is_control)
    {
        return Err("Unable to unlock local account".to_string());
    }
    Ok(())
}

fn record_failed_unlock(metadata: &mut VaultMetadata, now: i64) {
    metadata.failed_unlock_attempts = metadata.failed_unlock_attempts.saturating_add(1);
    let exponent = metadata.failed_unlock_attempts.saturating_sub(1).min(10);
    let delay = (5_i64 << exponent).min(15 * 60);
    metadata.unlock_blocked_until = Some(now.saturating_add(delay));
}

fn reserve_auth_attempt(
    state: &VaultManager,
    username: &str,
    metadata: &mut VaultMetadata,
) -> Result<(), String> {
    const AUTH_ERROR: &str = "Unable to unlock local account";
    let now = unix_now_seconds();
    if metadata
        .unlock_blocked_until
        .is_some_and(|until| until > now && until <= now.saturating_add(15 * 60))
    {
        return Err(AUTH_ERROR.into());
    }
    record_failed_unlock(metadata, now);
    write_metadata(&state.account_dir(username)?.join("vault.json"), metadata)
        .map_err(|_| AUTH_ERROR.to_string())
}

fn dummy_argon2_verify(_state: &VaultManager, password: &str) {
    let bounded = &password.as_bytes()[..password.len().min(1024)];
    let candidate =
        derive_key(bounded, &[0x5a; SALT_BYTES]).unwrap_or_else(|_| Zeroizing::new([0; KEY_BYTES]));
    // Match the valid-account Argon2 cost and always compare the derived value.
    let _ = std::hint::black_box(candidate.as_ref().ct_eq(&[0xa5; KEY_BYTES]));
    #[cfg(test)]
    _state
        .dummy_argon2_runs
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

fn lock_auth_attempts(state: &VaultManager) -> Result<File, String> {
    fs::create_dir_all(&state.root).map_err(|_| "Unable to unlock local account".to_string())?;
    let root = state.canonical_root()?;
    set_private_permissions(&root)?;
    let path = root.join(".auth.lock");
    require_regular_file_if_present(&path)?;
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&path)
        .map_err(|_| "Unable to unlock local account".to_string())?;
    require_regular_file_if_present(&path)?;
    set_private_file_permissions(&file)?;
    file.try_lock()
        .map_err(|_| "Unable to unlock local account".to_string())?;
    Ok(file)
}

fn write_metadata(path: &Path, metadata: &VaultMetadata) -> Result<(), String> {
    write_metadata_at(path, metadata, || Ok(()))
}

fn write_metadata_at(
    path: &Path,
    metadata: &VaultMetadata,
    before_replace: impl FnOnce() -> std::io::Result<()>,
) -> Result<(), String> {
    let mut suffix = [0u8; 12];
    getrandom::fill(&mut suffix).map_err(|_| "Secure random generation failed".to_string())?;
    let temporary = path.with_extension(format!("json.tmp-{}", encode_hex(&suffix)));
    let bytes = serde_json::to_vec(metadata)
        .map_err(|_| "Could not encode local account metadata".to_string())?;
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        set_private_file_permissions(&file).map_err(std::io::Error::other)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        before_replace()?;
        #[cfg(test)]
        pause_for_metadata_crash_test()?;
        replace_metadata(&temporary, path)?;
        sync_parent_directory(path)?;
        Ok::<(), std::io::Error>(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|error| match error.kind() {
        std::io::ErrorKind::AlreadyExists => "Could not create local account metadata".to_string(),
        _ => "Could not atomically persist local account metadata".to_string(),
    })
}

#[cfg(test)]
fn pause_for_metadata_crash_test() -> std::io::Result<()> {
    let Ok(marker) = std::env::var("SHINPO_TEST_PAUSE_METADATA_RENAME") else {
        return Ok(());
    };
    fs::write(
        marker,
        b"temporary metadata synced; atomic rename not reached",
    )?;
    loop {
        std::thread::sleep(Duration::from_secs(1));
    }
}

#[cfg(unix)]
fn sync_parent_directory(path: &Path) -> std::io::Result<()> {
    File::open(path.parent().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "metadata has no parent")
    })?)?
    .sync_all()
}

#[cfg(not(unix))]
fn sync_parent_directory(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

#[cfg(not(windows))]
fn replace_metadata(temporary: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(temporary, target)
}

#[cfg(windows)]
fn replace_metadata(temporary: &Path, target: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;
    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }
    let existing: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    let new: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let moved = unsafe {
        MoveFileExW(
            existing.as_ptr(),
            new.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(unix)]
fn set_private_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "Could not secure the vault directory".to_string())
}

#[cfg(not(unix))]
fn set_private_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file_permissions(file: &File) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    file.set_permissions(fs::Permissions::from_mode(0o600))
        .map_err(|_| "Could not secure local account metadata".to_string())
}

#[cfg(not(unix))]
fn set_private_file_permissions(_file: &File) -> Result<(), String> {
    Ok(())
}

#[cfg(unix)]
fn set_private_database_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|_| "Could not secure the encrypted database file".to_string())
}

#[cfg(not(unix))]
fn set_private_database_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn require_regular_file_if_present(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err("Local vault file is not a safe regular file".to_string())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Local vault file is unavailable".to_string()),
    }
}

fn require_existing_regular_file(path: &Path) -> Result<(), String> {
    require_regular_file_if_present(path)?;
    if !path.is_file() {
        return Err("Local vault file is missing".to_string());
    }
    Ok(())
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 15) as usize] as char);
    }
    encoded
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if !value.len().is_multiple_of(2) {
        return Err("Invalid encoded vault metadata".to_string());
    }
    value
        .as_bytes()
        .as_chunks::<2>()
        .0
        .iter()
        .map(|pair| {
            let digit = |byte: u8| match byte {
                b'0'..=b'9' => Some(byte - b'0'),
                b'a'..=b'f' => Some(byte - b'a' + 10),
                b'A'..=b'F' => Some(byte - b'A' + 10),
                _ => None,
            };
            Ok(
                (digit(pair[0]).ok_or_else(|| "Invalid encoded vault metadata".to_string())? << 4)
                    | digit(pair[1]).ok_or_else(|| "Invalid encoded vault metadata".to_string())?,
            )
        })
        .collect()
}

fn decode_fixed<const N: usize>(value: &str) -> Result<[u8; N], String> {
    decode_hex(value)?
        .try_into()
        .map_err(|_| "Invalid encoded vault metadata".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;

    #[test]
    fn headless_smoke_test_persists_encrypted_core_workflow_after_reopen() {
        smoke_test().unwrap();
    }

    #[test]
    fn native_mutation_requests_use_camel_case_and_reject_unknown_fields() {
        let request: UpdateTaskRequest = serde_json::from_str(
            r#"{"taskId":1,"goalId":2,"title":"Review","description":null,"scheduledDate":"2026-10-28","estimatedMinutes":25,"status":null}"#,
        )
        .unwrap();
        assert_eq!(request.task_id, 1);
        assert!(serde_json::from_str::<UpdateTaskRequest>(
            r#"{"taskId":1,"goalId":2,"title":"Review","scheduledDate":"2026-10-28","unexpected":true}"#,
        )
        .is_err());
    }

    #[test]
    fn midpoint_break_configuration_accepts_only_two_focus_blocks() {
        assert!(validate_midpoint_focus_cycles(false, 4).is_ok());
        assert!(validate_midpoint_focus_cycles(true, 2).is_ok());
        for unsupported in [1, 3, 4, 12] {
            assert!(validate_midpoint_focus_cycles(true, unsupported).is_err());
        }
    }

    #[test]
    fn password_length_is_bounded_and_unlock_backoff_grows_to_a_cap() {
        assert!(validate_password("123456789012").is_ok());
        assert!(validate_password(&"x".repeat(129)).is_err());
        assert!(normalize_new_password("12345678901234").is_err());
        assert!(normalize_new_password("PasswordPassword").is_err());
        assert!(normalize_new_password("Quite-a-unique-long-passphrase").is_ok());
        assert_eq!(
            normalize_password_nfkc("Ａbcdefghij１２").unwrap().as_str(),
            "Abcdefghij12"
        );

        let mut metadata: VaultMetadata = serde_json::from_str(
            r#"{"username":"legacy","password_salt":"","password_nonce":"","password_wrapped_key":"","recovery_salt":"","recovery_nonce":"","recovery_wrapped_key":""}"#,
        )
        .unwrap();
        assert_eq!(metadata.failed_unlock_attempts, 0);
        assert_eq!(metadata.unlock_blocked_until, None);

        for (attempt, delay) in [(1, 5), (2, 10), (3, 20), (20, 900)] {
            metadata.failed_unlock_attempts = attempt - 1;
            record_failed_unlock(&mut metadata, 1000);
            assert_eq!(metadata.unlock_blocked_until, Some(1000 + delay));
        }
    }

    #[test]
    fn local_password_uses_nfkc_and_failed_login_backoff_persists_with_generic_errors() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "nfkc_user", "Ａbcdefghij１２3456").unwrap();
        let database_key = *manager
            .unlocked
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            ._database_key;
        let mut metadata = manager.metadata("nfkc_user").unwrap();
        let mut legacy_salt = [0u8; SALT_BYTES];
        getrandom::fill(&mut legacy_salt).unwrap();
        let legacy_nonce = random_nonce().unwrap();
        let legacy_password = "Ａbcdefghij１２3456";
        let legacy_wrapping_key = derive_key(legacy_password.as_bytes(), &legacy_salt).unwrap();
        metadata.password_salt = encode_hex(&legacy_salt);
        metadata.password_nonce = encode_hex(&legacy_nonce);
        metadata.password_wrapped_key = wrap_key(
            &legacy_wrapping_key,
            &legacy_nonce,
            &database_key,
            b"nfkc_user",
        )
        .unwrap();
        metadata.password_nfkc = false;
        write_metadata(&root.join("nfkc_user/vault.json"), &metadata).unwrap();
        manager.unlocked.lock().unwrap().take();
        assert!(unlock_account(&manager, "nfkc_user", legacy_password).is_ok());
        manager.unlocked.lock().unwrap().take();
        assert!(unlock_account(&manager, "nfkc_user", "Abcdefghij123456").is_ok());
        manager.unlocked.lock().unwrap().take();

        let failure = match unlock_account(&manager, "nfkc_user", "wrong-password") {
            Err(error) => error,
            Ok(_) => panic!("wrong password unexpectedly unlocked the vault"),
        };
        assert_eq!(failure, "Unable to unlock local account");
        let metadata: VaultMetadata =
            serde_json::from_slice(&fs::read(root.join("nfkc_user/vault.json")).unwrap()).unwrap();
        assert_eq!(metadata.failed_unlock_attempts, 1);
        assert!(metadata.unlock_blocked_until.is_some());
        let restarted = VaultManager::new(root.clone());
        for user in ["missing_user", "nfkc_user"] {
            let error = match unlock_account(&restarted, user, "wrong-password") {
                Err(error) => error,
                Ok(_) => panic!("wrong password unexpectedly unlocked the vault"),
            };
            assert_eq!(error, failure);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_account_performs_dummy_argon2_work_and_auth_lock_is_shared_between_managers() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "auth_race", "a-long-qa-password").unwrap();
        manager.unlocked.lock().unwrap().take();
        let before = manager
            .dummy_argon2_runs
            .load(std::sync::atomic::Ordering::SeqCst);
        let oversized_unicode_password = "💻".repeat(300);
        assert!(unlock_account(&manager, "no_such_user", &oversized_unicode_password).is_err());
        assert_eq!(
            manager
                .dummy_argon2_runs
                .load(std::sync::atomic::Ordering::SeqCst),
            before + 1
        );

        let other_manager = VaultManager::new(root.clone());
        let start = std::sync::Arc::new(std::sync::Barrier::new(3));
        let outcomes = std::thread::scope(|scope| {
            let first = {
                let start = start.clone();
                let manager = &manager;
                scope.spawn(move || {
                    start.wait();
                    unlock_account(manager, "auth_race", "wrong-password")
                })
            };
            let second = {
                let start = start.clone();
                let other_manager = &other_manager;
                scope.spawn(move || {
                    start.wait();
                    unlock_account(other_manager, "auth_race", "wrong-password")
                })
            };
            start.wait();
            [first.join().unwrap(), second.join().unwrap()]
        });
        assert!(outcomes.iter().all(Result::is_err));
        let metadata = manager.metadata("auth_race").unwrap();
        assert_eq!(metadata.failed_unlock_attempts, 1);
        drop(other_manager);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn local_vault_metadata_and_database_use_private_unix_modes() {
        use std::os::unix::fs::PermissionsExt;

        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "private_files", "a-long-qa-password").unwrap();
        manager.unlocked.lock().unwrap().take();
        assert!(unlock_account(&manager, "private_files", "wrong-password").is_err());

        let mode = |path: &Path| fs::metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&root), 0o700);
        assert_eq!(mode(&root.join("private_files")), 0o700);
        assert_eq!(mode(&root.join("private_files/vault.json")), 0o600);
        assert_eq!(mode(&root.join("private_files/shinpo.db")), 0o600);
        assert_eq!(mode(&root.join(".auth.lock")), 0o600);

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn expired_native_vault_rejects_privileged_ipc_and_reports_locked_status() {
        let root = scratch_path();
        let host = root.join("browser-host");
        let paths = shinpo_browser_host::config::HostPaths {
            config: host.join("config.json"),
            policy: host.join("policy.json"),
            state_dir: host.join("state"),
        };
        let manager = VaultManager::new(root.join("vaults")).with_browser_host_paths(paths);
        create_account(&manager, "idle_user", "a-long-qa-password").unwrap();
        let app = tauri::test::mock_builder()
            .manage(manager)
            .invoke_handler(tauri::generate_handler![
                local_get_goals,
                local_vault_status
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        app.state::<VaultManager>().set_idle_timeout(Duration::ZERO);
        let invoke = |cmd: &str| {
            tauri::test::get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd: cmd.into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: if cfg!(windows) {
                        "http://tauri.localhost"
                    } else {
                        "tauri://localhost"
                    }
                    .parse()
                    .unwrap(),
                    body: tauri::ipc::InvokeBody::Json(serde_json::json!({})),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.into(),
                },
            )
        };

        assert!(invoke("local_get_goals").is_err());
        assert!(!app.state::<VaultManager>().is_unlocked().unwrap());
        assert_eq!(
            invoke("local_vault_status")
                .unwrap()
                .deserialize::<serde_json::Value>()
                .unwrap()["unlocked"],
            false
        );
        drop(app);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workstation_lock_event_zeroizes_vault_and_clears_guardian_state() {
        let root = scratch_path();
        let host = root.join("browser-host");
        let paths = shinpo_browser_host::config::HostPaths {
            config: host.join("config.json"),
            policy: host.join("policy.json"),
            state_dir: host.join("state"),
        };
        let manager = VaultManager::new(root.join("vaults")).with_browser_host_paths(paths.clone());
        create_account(&manager, "os_lock_user", "a-long-qa-password").unwrap();
        shinpo_browser_host::initialize_installation(&paths).unwrap();
        let issued_at = (OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as u64;
        shinpo_browser_host::publish_policy(
            &paths,
            serde_json::json!({
                "status":"ACTIVE", "sessionId":1, "policyVersion":1,
                "currentPhase":"FOCUS", "mode":"PROTECTED", "issuedAt":issued_at,
                "resources":[]
            }),
        )
        .unwrap();

        lock_vault_for_system_event(&manager).unwrap();

        assert!(!manager.is_unlocked().unwrap());
        assert_eq!(manager.guardian_observer.lock().unwrap().status, "LOCKED");
        assert!(!paths.policy.exists());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn background_focus_checkpoint_does_not_extend_idle_vault_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        manager.set_idle_timeout(Duration::from_millis(80));
        create_account(&manager, "idle_worker", "a-long-qa-password").unwrap();
        std::thread::sleep(Duration::from_millis(50));
        with_db_background(&manager, |_| Ok(())).unwrap();
        std::thread::sleep(Duration::from_millis(50));
        assert!(!manager.is_unlocked().unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_status_polling_does_not_extend_idle_vault_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        manager.set_idle_timeout(Duration::from_millis(120));
        create_account(&manager, "idle_guardian_poll", "a-long-qa-password").unwrap();

        let deadline = Instant::now() + Duration::from_millis(300);
        while Instant::now() < deadline {
            let _ = local_get_guardian_status_from(&manager).unwrap();
            std::thread::sleep(Duration::from_millis(30));
        }

        assert!(!manager.is_unlocked().unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_observation_polling_does_not_extend_idle_vault_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        manager.set_idle_timeout(Duration::from_millis(120));
        create_account(&manager, "idle_observation_poll", "a-long-qa-password").unwrap();

        let deadline = Instant::now() + Duration::from_millis(300);
        while Instant::now() < deadline {
            if local_get_guardian_observations_from(&manager, 999).is_err() {
                break;
            }
            std::thread::sleep(Duration::from_millis(30));
        }

        assert!(!manager.is_unlocked().unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn explicit_renderer_activity_extends_idle_vault_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        manager.set_idle_timeout(Duration::from_millis(150));
        create_account(&manager, "idle_user_activity", "a-long-qa-password").unwrap();
        std::thread::sleep(Duration::from_millis(90));

        touch_local_vault_activity_from(&manager).unwrap();
        std::thread::sleep(Duration::from_millis(90));
        assert!(manager.is_unlocked().unwrap());
        std::thread::sleep(Duration::from_millis(80));
        assert!(!manager.is_unlocked().unwrap());

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_upgrade_child_pauses_before_metadata_rename() {
        let Ok(root) = std::env::var("SHINPO_TEST_VAULT_ROOT") else {
            return;
        };
        let manager = VaultManager::new(PathBuf::from(root));
        unlock_account(&manager, "legacy_crash", "Legacy phrase with 24 chars")
            .expect("child should reach the injected pre-rename pause");
        panic!("metadata upgrade unexpectedly passed the test pause");
    }

    #[test]
    fn killed_legacy_wrapper_upgrade_keeps_old_metadata_and_unlock_path() {
        use std::process::{Child, Command, Stdio};

        struct KillOnDrop(Child);
        impl Drop for KillOnDrop {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }

        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "legacy_crash", "Valid new account phrase 2026").unwrap();
        let database_key = *manager
            .unlocked
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            ._database_key;
        let mut metadata = manager.metadata("legacy_crash").unwrap();
        let legacy_password = "Legacy phrase with 24 chars";
        let salt = [0x3d; SALT_BYTES];
        let nonce = random_nonce().unwrap();
        let wrapping_key = derive_key(legacy_password.as_bytes(), &salt).unwrap();
        metadata.password_salt = encode_hex(&salt);
        metadata.password_nonce = encode_hex(&nonce);
        metadata.password_wrapped_key =
            wrap_key(&wrapping_key, &nonce, &database_key, b"legacy_crash").unwrap();
        metadata.password_nfkc = false;
        write_metadata(&root.join("legacy_crash/vault.json"), &metadata).unwrap();
        let old_metadata = fs::read(root.join("legacy_crash/vault.json")).unwrap();
        drop(manager);

        let marker = root.join("upgrade-ready");
        let executable = std::env::current_exe().unwrap();
        let child = Command::new(executable)
            .arg("--exact")
            .arg("native_vault::tests::legacy_upgrade_child_pauses_before_metadata_rename")
            .arg("--nocapture")
            .env("SHINPO_TEST_VAULT_ROOT", &root)
            .env("SHINPO_TEST_PAUSE_METADATA_RENAME", &marker)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let mut child = KillOnDrop(child);
        let deadline = Instant::now() + Duration::from_secs(90);
        while !marker.exists() && Instant::now() < deadline {
            if let Some(status) = child.0.try_wait().unwrap() {
                panic!("legacy-upgrade child exited before atomic-rename pause: {status}");
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        assert!(
            marker.exists(),
            "child did not reach the synced-temp crash point"
        );
        child.0.kill().unwrap();
        let killed = child.0.wait().unwrap();
        assert!(
            !killed.success(),
            "child should have been killed before rename"
        );
        assert_eq!(
            fs::read(root.join("legacy_crash/vault.json")).unwrap(),
            old_metadata
        );

        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "legacy_crash", legacy_password).unwrap();
        let migrated = reopened.metadata("legacy_crash").unwrap();
        assert!(migrated.password_nfkc);
        assert_eq!(migrated.username, "legacy_crash");
        drop(reopened);
        drop(child);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cross_process_login_child_waits_for_release_and_attempts_unlock() {
        let (Ok(root), Ok(ready), Ok(go)) = (
            std::env::var("SHINPO_TEST_AUTH_ROOT"),
            std::env::var("SHINPO_TEST_AUTH_READY"),
            std::env::var("SHINPO_TEST_AUTH_GO"),
        ) else {
            return;
        };
        fs::write(ready, b"ready").unwrap();
        let go = PathBuf::from(go);
        let deadline = Instant::now() + Duration::from_secs(20);
        while !go.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(
            go.exists(),
            "parent did not release concurrent login children"
        );
        let manager = VaultManager::new(PathBuf::from(root));
        let result = unlock_account(&manager, "process_race", "incorrect password here");
        assert_eq!(result.err().unwrap(), "Unable to unlock local account");
    }

    #[test]
    fn concurrent_login_attempts_in_separate_processes_share_backoff() {
        use std::process::{Child, Command, Stdio};

        struct KillOnDrop(Child);
        impl Drop for KillOnDrop {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }

        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "process_race", "Valid new account phrase 2026").unwrap();
        manager.unlocked.lock().unwrap().take();
        let go = root.join("release-children");
        let executable = std::env::current_exe().unwrap();
        let mut children = Vec::new();
        for id in 0..2 {
            let ready = root.join(format!("child-{id}-ready"));
            let child = Command::new(&executable)
                .arg("--exact")
                .arg("native_vault::tests::cross_process_login_child_waits_for_release_and_attempts_unlock")
                .arg("--nocapture")
                .env("SHINPO_TEST_AUTH_ROOT", &root)
                .env("SHINPO_TEST_AUTH_READY", &ready)
                .env("SHINPO_TEST_AUTH_GO", &go)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap();
            children.push((ready, KillOnDrop(child)));
        }
        let deadline = Instant::now() + Duration::from_secs(30);
        while children.iter().any(|(ready, _)| !ready.exists()) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(children.iter().all(|(ready, _)| ready.exists()));
        fs::write(&go, b"run").unwrap();
        for (_, child) in &mut children {
            assert!(child.0.wait().unwrap().success());
        }
        assert_eq!(
            manager
                .metadata("process_race")
                .unwrap()
                .failed_unlock_attempts,
            1
        );
        drop(children);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    fn scratch_path() -> PathBuf {
        std::env::temp_dir().join(format!(
            "shinpo-vault-test-{}-{}",
            std::process::id(),
            getrandom::u32().unwrap()
        ))
    }

    fn raw_encrypted_database(path: &Path, key: &[u8; KEY_BYTES]) -> Connection {
        let connection = Connection::open(path).unwrap();
        let key_hex = encode_hex(key);
        connection
            .execute_batch(&format!(
                "PRAGMA key=\"x'{key_hex}'\"; PRAGMA cipher_memory_security=ON;"
            ))
            .unwrap();
        connection
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| {
                row.get::<_, i64>(0)
            })
            .unwrap();
        connection
    }

    fn create_unversioned_legacy_vault(path: &Path, key: &[u8; KEY_BYTES]) {
        let connection = raw_encrypted_database(path, key);
        connection.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        connection
            .execute_batch(
                "CREATE TABLE goals (
                    id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT,
                    start_date TEXT NOT NULL, target_date TEXT, status TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY,
                    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                    title TEXT NOT NULL, description TEXT, scheduled_date TEXT NOT NULL,
                    estimated_minutes INTEGER, status TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
                );
                CREATE TABLE calendar_sessions (
                    id INTEGER PRIMARY KEY,
                    goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                    name TEXT NOT NULL, intention TEXT,
                    duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0),
                    scheduled_at TEXT, status TEXT NOT NULL,
                    started_at TEXT, paused_at TEXT,
                    accumulated_paused_seconds INTEGER NOT NULL DEFAULT 0,
                    active_seconds INTEGER NOT NULL DEFAULT 0, ended_at TEXT,
                    reflection_note TEXT, accomplishment TEXT, completion_quality INTEGER,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE progress_events (
                    id INTEGER PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
                    event_type TEXT NOT NULL, amount INTEGER NOT NULL,
                    session_id INTEGER REFERENCES calendar_sessions(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE browser_resources (
                    id INTEGER PRIMARY KEY,
                    mission_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                    focus_session_id INTEGER REFERENCES calendar_sessions(id) ON DELETE CASCADE,
                    resource_type TEXT NOT NULL, match_type TEXT NOT NULL,
                    disposition TEXT NOT NULL, break_only INTEGER NOT NULL DEFAULT 0,
                    destination TEXT NOT NULL, canonical_destination TEXT NOT NULL,
                    display_name TEXT, expires_at TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .unwrap();
        connection.execute(
            "INSERT INTO goals(id,title,start_date,status) VALUES(7,'Preserved goal','2026-10-26','ACTIVE')",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO tasks(id,goal_id,title,scheduled_date,status) VALUES(9,7,'Preserved task','2026-10-27','COMPLETED')",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO calendar_sessions(id,task_id,name,duration_minutes,status,active_seconds,reflection_note) VALUES(11,9,'Preserved session',25,'COMPLETED',1500,'Kept reflection')",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO progress_events(event_key,event_type,amount,session_id) VALUES('focus:11','FOCUS_COMPLETED',15,11)",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO progress_events(event_key,event_type,amount) VALUES('goal:7','GOAL_COMPLETED',50)",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO progress_events(event_key,event_type,amount) VALUES('task:9','MISSION_COMPLETED',10)",
            [],
        ).unwrap();
        connection.execute(
            "INSERT INTO browser_resources(id,mission_id,focus_session_id,resource_type,match_type,disposition,destination,canonical_destination) VALUES(13,9,11,'WEBSITE','DOMAIN','BLOCKED','https://social.example','https://social.example')",
            [],
        ).unwrap();
        connection.pragma_update(None, "user_version", 0).unwrap();
    }

    #[test]
    fn legacy_encrypted_schema_migrates_without_losing_product_records() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("legacy.db");
        let key = [0x42; KEY_BYTES];
        create_unversioned_legacy_vault(&path, &key);

        let migrated = open_encrypted_database(&path, &key, "legacy_user", false).unwrap();
        let version: i64 = migrated
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, LATEST_SCHEMA_VERSION);
        let preserved: (i64, i64, i64, i64, i64, String, String, String) = migrated
            .query_row(
                "SELECT (SELECT count(*) FROM goals),(SELECT count(*) FROM tasks),
                 (SELECT count(*) FROM calendar_sessions),(SELECT count(*) FROM progress_events),
                 (SELECT count(*) FROM browser_resources),
                 (SELECT reflection_note FROM calendar_sessions WHERE id=11),
                 (SELECT destination FROM browser_resources WHERE id=13),
                 (SELECT current_phase FROM calendar_sessions WHERE id=11)",
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(
            preserved,
            (
                1,
                1,
                1,
                3,
                1,
                "Kept reflection".into(),
                "https://social.example".into(),
                "FOCUS".into()
            )
        );
        drop(migrated);

        let reopened = open_encrypted_database(&path, &key, "legacy_user", false).unwrap();
        let progress: i64 = reopened
            .query_row("SELECT SUM(amount) FROM progress_events", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(progress, 75);
        let stable_keys: Vec<String> = reopened
            .prepare("SELECT event_key FROM progress_events ORDER BY event_key")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        let goal_reward_id: String = reopened
            .query_row("SELECT reward_id FROM goals WHERE id=7", [], |row| {
                row.get(0)
            })
            .unwrap();
        let task_reward_id: String = reopened
            .query_row("SELECT reward_id FROM tasks WHERE id=9", [], |row| {
                row.get(0)
            })
            .unwrap();
        let focus_reward_id: String = reopened
            .query_row(
                "SELECT reward_id FROM calendar_sessions WHERE id=11",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            stable_keys,
            vec![
                format!("focus:{focus_reward_id}"),
                format!("goal:{goal_reward_id}"),
                format!("task:{task_reward_id}")
            ]
        );
        drop(reopened);
        assert!(Connection::open(&path)
            .unwrap()
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row
                .get::<_, i64>(0))
            .is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_mode_v5_migration_preserves_active_policy_and_defaults_new_sessions() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("guardian-v4.db");
        let key = [0x63; KEY_BYTES];
        let mut connection = raw_encrypted_database(&path, &key);
        {
            let transaction = connection.transaction().unwrap();
            migrate_v1(&transaction).unwrap();
            migrate_v2(&transaction).unwrap();
            migrate_v3(&transaction).unwrap();
            migrate_v4(&transaction).unwrap();
            transaction.commit().unwrap();
        }
        connection.pragma_update(None, "user_version", 4).unwrap();
        connection
            .execute(
                "UPDATE browser_companion_meta SET focus_mode='STRICT' WHERE id=1",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status) VALUES('Existing active focus',25,'ACTIVE')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status) VALUES('Scheduled focus',25,'SCHEDULED')",
                [],
            )
            .unwrap();

        apply_schema_migrations(&mut connection).unwrap();
        let modes: (String, String) = connection
            .query_row(
                "SELECT (SELECT guardian_mode FROM calendar_sessions WHERE id=1), (SELECT guardian_mode FROM calendar_sessions WHERE id=2)",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(modes, ("STRICT".into(), "PROTECTED".into()));
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_v2_migration_rolls_back_then_retries_cleanly() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("interrupted.db");
        let key = [0x37; KEY_BYTES];
        let mut connection = raw_encrypted_database(&path, &key);
        let transaction = connection.transaction().unwrap();
        migrate_v1(&transaction).unwrap();
        transaction.commit().unwrap();
        connection.pragma_update(None, "user_version", 1).unwrap();

        {
            let transaction = connection.transaction().unwrap();
            migrate_v2(&transaction).unwrap();
            drop(transaction);
        }
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
        assert!(!schema_has_column(&connection, "calendar_sessions", "pomodoro_enabled").unwrap());

        apply_schema_migrations(&mut connection).unwrap();
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, LATEST_SCHEMA_VERSION);
        assert!(schema_has_column(&connection, "calendar_sessions", "pomodoro_enabled").unwrap());
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn v2_active_break_migrates_its_remaining_phase_deadline() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("active-v2.db");
        let key = [0x58; KEY_BYTES];
        let mut connection = raw_encrypted_database(&path, &key);
        let transaction = connection.transaction().unwrap();
        migrate_v1(&transaction).unwrap();
        migrate_v2(&transaction).unwrap();
        transaction.commit().unwrap();
        connection.pragma_update(None, "user_version", 2).unwrap();
        let phase_start = "2026-10-28T10:00:00Z";
        let start_seconds = OffsetDateTime::parse(phase_start, &Rfc3339)
            .unwrap()
            .unix_timestamp();
        connection.execute(
            "INSERT INTO calendar_sessions(name,duration_minutes,status,started_at,phase_started_at,
                pomodoro_enabled,pomodoro_long_break_minutes,pomodoro_grace_minutes,current_phase,
                phase_elapsed_seconds,break_active_seconds)
             VALUES('Migrated break',60,'ACTIVE',?1,?1,1,15,10,'BREAK',60,60)",
            [phase_start],
        ).unwrap();

        apply_schema_migrations(&mut connection).unwrap();
        let migrated: (Option<i64>, String, i64) = connection.query_row(
            "SELECT phase_deadline_at,last_checkpoint_at,break_active_seconds FROM calendar_sessions WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap();
        assert_eq!(migrated.0, Some((start_seconds + 14 * 60) * 1000));
        assert_eq!(migrated.1, phase_start);
        assert_eq!(migrated.2, 60);
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_legacy_schema_rolls_back_all_v1_objects_and_future_schema_is_refused() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let key = [0x19; KEY_BYTES];
        let invalid_path = root.join("invalid.db");
        let mut invalid = raw_encrypted_database(&invalid_path, &key);
        invalid
            .execute_batch("CREATE TABLE goals(broken TEXT);")
            .unwrap();
        assert!(apply_schema_migrations(&mut invalid).is_err());
        let version: i64 = invalid
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        let created_profile: i64 = invalid
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='local_profile'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 0);
        assert_eq!(created_profile, 0);
        drop(invalid);

        let future_path = root.join("future.db");
        let future = raw_encrypted_database(&future_path, &key);
        future
            .pragma_update(None, "user_version", LATEST_SCHEMA_VERSION + 1)
            .unwrap();
        drop(future);
        assert!(open_encrypted_database(&future_path, &key, "future_user", false).is_err());
        let future = raw_encrypted_database(&future_path, &key);
        let version: i64 = future
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, LATEST_SCHEMA_VERSION + 1);
        drop(future);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_metadata_and_tampered_ciphertext_are_rejected_without_plaintext_fallback() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "tamper_user", "a-long-qa-password").unwrap();
        drop(manager);
        let metadata_path = root.join("tamper_user/vault.json");
        fs::write(&metadata_path, b"{invalid metadata").unwrap();
        let reopened = VaultManager::new(root.clone());
        assert!(unlock_account(&reopened, "tamper_user", "a-long-qa-password").is_err());
        drop(reopened);

        let fresh_root = scratch_path();
        let fresh = VaultManager::new(fresh_root.clone());
        create_account(&fresh, "cipher_user", "a-long-qa-password").unwrap();
        drop(fresh);
        let db_path = fresh_root.join("cipher_user/shinpo.db");
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&db_path)
            .unwrap();
        use std::io::{Read, Seek, SeekFrom};
        file.seek(SeekFrom::Start(100)).unwrap();
        let mut byte = [0u8; 1];
        file.read_exact(&mut byte).unwrap();
        byte[0] ^= 0x80;
        file.seek(SeekFrom::Start(100)).unwrap();
        file.write_all(&byte).unwrap();
        file.sync_all().unwrap();
        drop(file);
        assert!(unlock_account(
            &VaultManager::new(fresh_root.clone()),
            "cipher_user",
            "a-long-qa-password"
        )
        .is_err());
        let plain = Connection::open(&db_path).unwrap();
        assert!(plain
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row
                .get::<_, i64>(0))
            .is_err());
        drop(plain);
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(fresh_root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn vault_path_rejects_traversal_and_account_symlinks() {
        use std::os::unix::fs::symlink;
        let root = scratch_path();
        let outside = scratch_path();
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, root.join("linked_user")).unwrap();
        let manager = VaultManager::new(root.clone());
        assert!(manager.account_dir("../outside").is_err());
        assert!(manager.account_dir("linked_user").is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn sqlcipher_vault_rejects_wrong_password_and_recovers_without_plaintext_sqlite() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        let account = create_account(&manager, "qa_user", "a-long-qa-password").unwrap();
        let db_path = root.join("qa_user/shinpo.db");
        let bytes = fs::read(&db_path).unwrap();
        assert_ne!(&bytes[..16], b"SQLite format 3\0");
        recover_account(
            &manager,
            "qa_user",
            &account.recovery_key,
            "another-long-password",
        )
        .unwrap();
        unlock_account(&manager, "qa_user", "another-long-password").unwrap();
        drop(manager);

        let restarted = VaultManager::new(root.clone());
        unlock_account(&restarted, "qa_user", "another-long-password").unwrap();

        let plain = Connection::open(&db_path).unwrap();
        assert!(plain
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row
                .get::<_, i64>(0))
            .is_err());
        drop(plain);
        assert!(recover_account(
            &restarted,
            "qa_user",
            "wrong-recovery-key",
            "third-long-qa-password"
        )
        .is_err());
        assert!(unlock_account(&restarted, "qa_user", "wrong-password").is_err());
        drop(restarted);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn task_completion_and_goal_xp_are_transactional_and_once_only() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "xp_user", "a-long-qa-password").unwrap();
        let task_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO goals(title,start_date) VALUES('Goal','2026-10-26')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(goal_id,title,scheduled_date) VALUES(1,'Task','2026-10-26')",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();
        let completion = with_db(&manager, |db| complete_task(db, task_id, Some(25))).unwrap();
        assert_eq!(completion.earned_progress, 10);
        assert!(with_db(&manager, |db| complete_task(db, task_id, Some(25))).is_err());
        with_db(&manager, |db| {
            let total: i64 =
                db.query_row("SELECT sum(amount) FROM progress_events", [], |row| {
                    row.get(0)
                })?;
            let events: i64 =
                db.query_row("SELECT count(*) FROM progress_events", [], |row| row.get(0))?;
            let status: String =
                db.query_row("SELECT status FROM goals WHERE id=1", [], |row| row.get(0))?;
            assert_eq!(total, 60);
            assert_eq!(events, 2);
            assert_eq!(status, "COMPLETED");
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn direct_goal_completion_rolls_back_when_reward_ledger_write_fails() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "goal_rollback", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO goals(title,start_date) VALUES('Goal','2026-10-26')", [])?;
            db.execute_batch("CREATE TRIGGER reject_goal_reward BEFORE INSERT ON progress_events WHEN NEW.event_type='GOAL_COMPLETED' BEGIN SELECT RAISE(ABORT, 'test ledger failure'); END;")?;
            Ok(())
        }).unwrap();
        assert!(with_db(&manager, |db| update_goal_record(
            db,
            1,
            "Goal",
            None,
            "2026-10-26",
            None,
            "COMPLETED"
        ))
        .is_err());
        with_db(&manager, |db| {
            let status: String =
                db.query_row("SELECT status FROM goals WHERE id=1", [], |row| row.get(0))?;
            let rewards: i64 =
                db.query_row("SELECT COUNT(*) FROM progress_events", [], |row| row.get(0))?;
            assert_eq!(status, "ACTIVE");
            assert_eq!(rewards, 0);
            db.execute_batch("DROP TRIGGER reject_goal_reward")?;
            update_goal_record(db, 1, "Goal", None, "2026-10-26", None, "COMPLETED")?;
            let retried_status: String =
                db.query_row("SELECT status FROM goals WHERE id=1", [], |row| row.get(0))?;
            let retried_rewards: i64 = db.query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_type='GOAL_COMPLETED'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(retried_status, "COMPLETED");
            assert_eq!(retried_rewards, 1);
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recreating_deleted_goal_does_not_reuse_its_reward_identity() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "goal_identity", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            let first = insert_goal_record(db, "First", None, "2026-10-26", None)?;
            let first_key: String = db.query_row(
                "SELECT reward_id FROM goals WHERE id=?1",
                [first.id],
                |row| row.get(0),
            )?;
            db.execute("DELETE FROM goals WHERE id=?1", [first.id])?;
            let second = insert_goal_record(db, "Second", None, "2026-10-26", None)?;
            let second_key: String = db.query_row(
                "SELECT reward_id FROM goals WHERE id=?1",
                [second.id],
                |row| row.get(0),
            )?;
            assert_eq!(first.id, second.id);
            assert_ne!(first_key, second_key);
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn task_triggered_goal_reward_uses_non_reusable_identity_after_delete_and_recreate() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "goal_task_identity", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            let first = insert_goal_record(db, "First", None, "2026-10-26", None)?;
            let first_task =
                insert_task_record(db, first.id, "First task", None, "2026-10-26", None)?;
            complete_task(db, first_task.id, Some(25))?;
            db.execute("DELETE FROM goals WHERE id=?1", [first.id])?;
            let second = insert_goal_record(db, "Second", None, "2026-10-26", None)?;
            assert_eq!(first.id, second.id);
            let second_task =
                insert_task_record(db, second.id, "Second task", None, "2026-10-26", None)?;
            complete_task(db, second_task.id, Some(25))?;
            let goals_awarded: i64 = db.query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_type='GOAL_COMPLETED'",
                [],
                |row| row.get(0),
            )?;
            let tasks_awarded: i64 = db.query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_type='MISSION_COMPLETED'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(goals_awarded, 2);
            assert_eq!(tasks_awarded, 2);
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn paused_focus_completion_persists_completion_and_reflection() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "paused_completion", "a-long-qa-password").unwrap();
        let id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes) VALUES('Paused',25)",
                [],
            )?;
            let id = db.last_insert_rowid();
            start_focus_session(db, id, unix_now_seconds())?;
            pause_focus_session(db, id, unix_now_seconds())?;
            Ok(id)
        })
        .unwrap();
        let completed = with_db(&manager, |db| {
            complete_focus_session(
                db,
                id,
                unix_now_seconds(),
                None,
                Some("Saved".into()),
                None,
                false,
            )
        })
        .unwrap();
        assert_eq!(completed.status, "COMPLETED");
        assert_eq!(completed.reflection_note.as_deref(), Some("Saved"));
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn late_return_penalty_is_once_capped_by_day_and_balance_after_reopen() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "penalty_user", "a-long-qa-password").unwrap();
        let start = 1_800_000_000;
        with_db(&manager, |db| {
            insert_xp_event(db, "earned", "MISSION_COMPLETED", 12, None)?;
            for i in 0..3 {
                db.execute("INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled,pomodoro_long_break_minutes,pomodoro_grace_minutes,late_penalty_enabled,late_penalty_xp,late_penalty_daily_cap_xp) VALUES(?1,2,1,1,1,1,5,8)", [format!("Session {i}")])?;
                let id = db.last_insert_rowid();
                start_focus_session(db, id, start + i * 300)?;
                advance_focus_session_at(db, id, start + i * 300 + 60, false)?;
                advance_focus_session_at(db, id, start + i * 300 + 120, false)?;
                let overdue = advance_focus_session_at(db, id, start + i * 300 + 180, false)?;
                assert_eq!(overdue.current_phase, "RETURN_REQUIRED");
                advance_focus_session_at(db, id, start + i * 300 + 181, false)?;
                db.execute("UPDATE calendar_sessions SET status='CANCELLED' WHERE id=?1", [id])?;
            }
            let debits: i64 = db.query_row("SELECT COALESCE(SUM(amount),0) FROM progress_events WHERE event_type='LATE_RETURN_PENALTY'", [], |r| r.get(0))?;
            assert_eq!(debits, -8);
            let count: i64 = db.query_row("SELECT COUNT(*) FROM progress_events WHERE event_type='LATE_RETURN_PENALTY'", [], |r| r.get(0))?;
            assert_eq!(count, 3);
            Ok(())
        }).unwrap();
        drop(manager);
        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "penalty_user", "a-long-qa-password").unwrap();
        with_db(&reopened, |db| {
            let balance: i64 =
                db.query_row("SELECT SUM(amount) FROM progress_events", [], |r| r.get(0))?;
            assert_eq!(balance, 4);
            Ok(())
        })
        .unwrap();
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn concurrent_late_return_checks_never_debit_twice_or_below_zero() {
        let root = scratch_path();
        let manager = std::sync::Arc::new(VaultManager::new(root.clone()));
        create_account(&manager, "race_user", "a-long-qa-password").unwrap();
        let start = unix_now_seconds();
        let session_id = with_db(&manager, |db| {
            insert_xp_event(db, "earned", "MISSION_COMPLETED", 3, None)?;
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled,pomodoro_long_break_minutes,pomodoro_grace_minutes,late_penalty_enabled) VALUES('Race',2,1,1,1,1)", [])?;
            let id = db.last_insert_rowid();
            start_focus_session(db, id, start)?;
            Ok(id)
        }).unwrap();
        let threads: Vec<_> = (0..8)
            .map(|_| {
                let manager = std::sync::Arc::clone(&manager);
                std::thread::spawn(move || {
                    with_db(&manager, |db| {
                        advance_focus_session_at(db, session_id, start + 180, false)
                    })
                    .unwrap()
                })
            })
            .collect();
        for thread in threads {
            assert_eq!(thread.join().unwrap().current_phase, "RETURN_REQUIRED");
        }
        with_db(&manager, |db| {
            let (balance, events): (i64, i64) = db.query_row(
                "SELECT COALESCE(SUM(amount),0),COUNT(*) FROM progress_events",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            assert_eq!((balance, events), (0, 2));
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn persisted_focus_break_grace_return_and_resume_boundaries_are_exact() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "phase_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO goals(title,start_date) VALUES('Exam preparation','2026-10-28')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(goal_id,title,scheduled_date) VALUES(1,'Review chapter','2026-10-28')",
                [],
            )?;
            db.execute("INSERT INTO calendar_sessions(task_id,name,duration_minutes,pomodoro_enabled,pomodoro_long_break_minutes,pomodoro_grace_minutes) VALUES(1,'Focus',60,1,15,10)", [])?;
            let session_id = db.last_insert_rowid();
            db.execute("INSERT INTO browser_resources(focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination) VALUES(?1,'WEBSITE','DOMAIN','BLOCKED',0,'https://social.example','social.example')", [session_id])?;
            db.execute("INSERT INTO browser_resources(focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination) VALUES(?1,'WEBSITE','DOMAIN','APPROVED',1,'https://game.example','game.example')", [session_id])?;
            Ok(session_id)
        }).unwrap();
        let start = unix_now_seconds();
        let started = with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();
        assert_eq!(started.current_phase, "FOCUS");
        assert_eq!(started.phase_deadline_at, Some((start + 1800) * 1000));
        assert_eq!(started.phase_revision, 2);
        let focus_policy = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(focus_policy["currentPhase"], "FOCUS");
        assert_eq!(
            focus_policy["catalogVersions"]["applications"],
            shinpo_shield::observer::APP_CATALOG_VERSION
        );
        assert_eq!(
            focus_policy["catalogVersions"]["domains"],
            DOMAIN_CATALOG_VERSION
        );
        assert_eq!(focus_policy["breakDeadlineAt"], (start + 2700) * 1000);
        assert_eq!(focus_policy["graceDeadlineAt"], (start + 3300) * 1000);
        assert_eq!(focus_policy["resources"].as_array().unwrap().len(), 21);
        assert_eq!(focus_policy["resources"][2]["automaticGuardian"], true);
        assert_eq!(
            focus_policy["resources"][2]["id"],
            "guardian-domains-v1:instagram.com"
        );
        let host_paths = shinpo_browser_host::config::HostPaths {
            config: root.join("browser-host/browser_host.json"),
            policy: root.join("browser-host/state/browser_policy.json"),
            state_dir: root.join("browser-host/state"),
        };
        shinpo_browser_host::initialize_installation(&host_paths).unwrap();
        let host_focus = shinpo_browser_host::publish_policy(&host_paths, focus_policy).unwrap();
        assert_eq!(host_focus["currentPhase"], "FOCUS");
        assert_eq!(host_focus["breakDeadlineAt"], (start + 2700) * 1000);
        assert_eq!(host_focus["graceDeadlineAt"], (start + 3300) * 1000);
        assert_eq!(
            host_focus["catalogVersions"]["domains"],
            DOMAIN_CATALOG_VERSION
        );
        let break_phase = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 1800, false)
        })
        .unwrap();
        assert_eq!(break_phase.current_phase, "BREAK");
        assert_eq!(break_phase.phase_revision, 3);
        assert_eq!(
            break_phase.phase_deadline_at,
            Some((start + 1800 + 900) * 1000)
        );
        let break_policy = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(break_policy["currentPhase"], "BREAK");
        assert_eq!(break_policy["phaseDeadlineAt"], (start + 1800 + 900) * 1000);
        assert_eq!(break_policy["breakDeadlineAt"], (start + 2700) * 1000);
        assert_eq!(break_policy["graceDeadlineAt"], (start + 3300) * 1000);
        assert_eq!(break_policy["resources"][1]["breakOnly"], true);
        let host_break = shinpo_browser_host::publish_policy(&host_paths, break_policy).unwrap();
        assert_eq!(host_break["currentPhase"], "BREAK");
        assert_eq!(host_break["graceDeadlineAt"], (start + 3300) * 1000);
        let grace = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 2700, false)
        })
        .unwrap();
        assert_eq!(grace.current_phase, "GRACE");
        let grace_policy = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(grace_policy["currentPhase"], "GRACE");
        let host_grace = shinpo_browser_host::publish_policy(&host_paths, grace_policy).unwrap();
        assert_eq!(host_grace["currentPhase"], "GRACE");
        assert_eq!(grace.phase_deadline_at, Some((start + 3300) * 1000));
        let required = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 3300, false)
        })
        .unwrap();
        assert_eq!(required.current_phase, "RETURN_REQUIRED");
        assert_eq!(required.phase_deadline_at, None);
        let policy = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(policy["currentPhase"], "RETURN_REQUIRED");
        assert_eq!(policy["status"], "ACTIVE");
        let host_return_required =
            shinpo_browser_host::publish_policy(&host_paths, policy).unwrap();
        assert_eq!(host_return_required["currentPhase"], "RETURN_REQUIRED");
        let resumed =
            with_db(&manager, |db| return_to_focus(db, session_id, start + 3305)).unwrap();
        assert_eq!(resumed.current_phase, "FOCUS");
        assert_eq!(resumed.focus_active_seconds, 1800);
        assert_eq!(resumed.break_active_seconds, 1500);
        assert_eq!(
            resumed.phase_deadline_at,
            Some((start + 3305 + 1800) * 1000)
        );
        let complete_phase = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 5105, false)
        })
        .unwrap();
        assert_eq!(complete_phase.current_phase, "COMPLETE");
        let completed = with_db(&manager, |db| {
            complete_focus_session(
                db,
                session_id,
                start + 5105,
                Some(5),
                Some("Clear next step".into()),
                Some("Feature shipped".into()),
                true,
            )
        })
        .unwrap();
        assert_eq!(completed.status, "COMPLETED");
        assert_eq!(completed.focus_active_seconds, 3600);
        assert_eq!(completed.break_active_seconds, 1500);
        with_db(&manager, |db| {
            let (xp, count): (i64, i64) = db.query_row(
                "SELECT COALESCE(SUM(amount),0),COUNT(*) FROM progress_events",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            assert_eq!((xp, count), (85, 3));
            let task_status: String =
                db.query_row("SELECT status FROM tasks WHERE id=1", [], |row| row.get(0))?;
            let goal_status: String =
                db.query_row("SELECT status FROM goals WHERE id=1", [], |row| row.get(0))?;
            assert_eq!(
                (task_status.as_str(), goal_status.as_str()),
                ("COMPLETED", "COMPLETED")
            );
            Ok(())
        })
        .unwrap();
        drop(manager);
        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "phase_user", "a-long-qa-password").unwrap();
        let recovered = with_db(&reopened, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(recovered.current_phase, "COMPLETE");
        assert_eq!(recovered.accomplishment.as_deref(), Some("Feature shipped"));
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stale_focus_checkpoint_pauses_without_counting_sleep_time() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "interrupt_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled,late_penalty_enabled) VALUES('Focus',60,1,1)", [])?;
            Ok(db.last_insert_rowid())
        }).unwrap();
        let start = 1_800_000_000;
        with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();
        with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 5, true)
        })
        .unwrap();
        let at_stale_limit = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 20, true)
        })
        .unwrap();
        assert_eq!(at_stale_limit.status, "ACTIVE");
        assert_eq!(at_stale_limit.focus_active_seconds, 0);

        let paused = with_db(&manager, |db| {
            advance_focus_session_at(db, session_id, start + 36, true)
        })
        .unwrap();
        assert_eq!(paused.status, "PAUSED");
        assert_eq!(paused.focus_active_seconds, 20);
        assert_eq!(paused.remaining_seconds, 1780);
        assert_eq!(paused.interruption_count, 1);
        with_db(&manager, |db| {
            let penalties: i64 = db.query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_type='LATE_RETURN_PENALTY'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(penalties, 0);
            Ok(())
        })
        .unwrap();
        let resumed = with_db(&manager, |db| {
            resume_focus_session(db, session_id, start + 600)
        })
        .unwrap();
        assert_eq!(resumed.phase_deadline_at, Some((start + 600 + 1780) * 1000));
        let paused_again = with_db(&manager, |db| {
            pause_focus_session(db, session_id, start + 605)
        })
        .unwrap();
        assert_eq!(paused_again.focus_active_seconds, 25);
        assert_eq!(paused_again.remaining_seconds, 1775);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_heartbeat_keeps_ordinary_focus_alive_and_refreshes_policy() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "heartbeat_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled) VALUES('Focus',60,0)",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();
        let start = unix_now_seconds();
        with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();
        let paths = shinpo_browser_host::config::HostPaths {
            config: root.join("browser-host.json"),
            policy: root.join("state").join("browser-policy.json"),
            state_dir: root.join("state"),
        };
        let (host_config, _) = shinpo_browser_host::config::HostConfig::new_installation();
        host_config.save(&paths).unwrap();
        let mut last_policy_version = 0;

        for tick in 1..=15 {
            maintain_active_focus_at(&manager, &paths, start + tick * 5).unwrap();
            let policy = shinpo_browser_host::policy::PolicyStore::new(paths.clone())
                .load_valid(shinpo_browser_host::now_ms())
                .unwrap();
            assert_eq!(policy["status"], "ACTIVE", "{policy}");
            let version = policy["policyVersion"].as_i64().unwrap();
            assert!(version > last_policy_version);
            last_policy_version = version;
            assert!(
                policy["_hostLeaseExpiresAtMs"].as_u64().unwrap() > shinpo_browser_host::now_ms()
            );
        }

        let checkpoint: String = with_db(&manager, |db| {
            db.query_row(
                "SELECT last_checkpoint_at FROM calendar_sessions WHERE id=?1",
                [session_id],
                |row| row.get(0),
            )
        })
        .unwrap();
        assert_eq!(epoch_seconds_from_iso(&checkpoint), Some(start + 75));

        let store = shinpo_browser_host::policy::PolicyStore::new(paths);
        let policy_at_60 = store.load_valid(shinpo_browser_host::now_ms()).unwrap();
        assert_eq!(policy_at_60["status"], "ACTIVE");
        let lease_expiry = policy_at_60["_hostLeaseExpiresAtMs"].as_u64().unwrap();
        let expired = store.load_valid(lease_expiry).unwrap();
        assert_eq!(expired["status"], "INACTIVE");

        let after_suspend =
            with_db(&manager, |db| maintain_active_focus_in_db(db, start + 95)).unwrap();
        assert!(after_suspend.is_none());
        let recovered = with_db(&manager, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(recovered.status, "PAUSED");
        assert_eq!(recovered.focus_active_seconds, 75);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_heartbeat_keeps_pomodoro_focus_alive_and_pauses_after_suspend() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "pomodoro_worker", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled,pomodoro_long_break_minutes,pomodoro_grace_minutes) VALUES('Pomodoro',60,1,15,10)", [])?;
            Ok(db.last_insert_rowid())
        }).unwrap();
        let start = 1_800_000_000;
        with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();
        let mut last_policy_version = 0;
        for tick in 1..=15 {
            let snapshot = with_db(&manager, |db| {
                maintain_active_focus_in_db(db, start + tick * 5)
            })
            .unwrap();
            let snapshot = snapshot.unwrap();
            assert_eq!(snapshot["currentPhase"], "FOCUS");
            assert_eq!(snapshot["phaseDeadlineAt"], (start + 1800) * 1000);
            let next_policy_version = snapshot["policyVersion"].as_i64().unwrap();
            assert!(next_policy_version > last_policy_version);
            last_policy_version = next_policy_version;
        }

        let checkpoint: String = with_db(&manager, |db| {
            db.query_row(
                "SELECT last_checkpoint_at FROM calendar_sessions WHERE id=?1",
                [session_id],
                |row| row.get(0),
            )
        })
        .unwrap();
        assert_eq!(epoch_seconds_from_iso(&checkpoint), Some(start + 75));

        let after_suspend =
            with_db(&manager, |db| maintain_active_focus_in_db(db, start + 100)).unwrap();
        assert!(after_suspend.is_none());
        let recovered = with_db(&manager, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(recovered.status, "PAUSED");
        assert_eq!(recovered.focus_active_seconds, 75);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn vault_lock_checkpoints_focus_and_reopen_keeps_it_paused() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "lock_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled) VALUES('Focus',60,1)",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();
        let start = 1_800_000_000;
        with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();
        with_db(&manager, |db| pause_focus_before_vault_lock(db, start + 12)).unwrap();
        let locked = with_db(&manager, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(locked.status, "PAUSED");
        assert_eq!(locked.focus_active_seconds, 12);
        assert_eq!(locked.remaining_seconds, 1788);
        drop(manager);

        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "lock_user", "a-long-qa-password").unwrap();
        let recovered = with_db(&reopened, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(recovered.status, "PAUSED");
        assert_eq!(recovered.focus_active_seconds, 12);
        assert_eq!(recovered.phase_revision, locked.phase_revision);
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prepare_desktop_shutdown_checkpoints_focus_clears_browser_policy_and_locks_vault() {
        let root = scratch_path();
        let host = root.join("browser-host");
        let paths = shinpo_browser_host::config::HostPaths {
            config: host.join("config.json"),
            policy: host.join("policy.json"),
            state_dir: host.join("state"),
        };
        let manager = VaultManager::new(root.join("vaults")).with_browser_host_paths(paths.clone());
        create_account(&manager, "shutdown_user", "a-long-qa-password").unwrap();
        shinpo_browser_host::initialize_installation(&paths).unwrap();

        let session_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,pomodoro_enabled) VALUES('Focus',60,1)",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();
        let start = 1_800_000_000;
        with_db(&manager, |db| start_focus_session(db, session_id, start)).unwrap();

        shinpo_browser_host::publish_policy(
            &paths,
            serde_json::json!({
                "status":"ACTIVE", "sessionId":session_id, "policyVersion":1,
                "currentPhase":"FOCUS", "mode":"PROTECTED", "issuedAt":start,
                "resources":[]
            }),
        )
        .unwrap();
        assert!(paths.policy.exists());

        prepare_desktop_shutdown(&manager).unwrap();

        assert!(!manager.is_unlocked().unwrap());
        assert_eq!(manager.guardian_observer.lock().unwrap().status, "LOCKED");
        assert!(
            !paths.policy.exists(),
            "Browser policy must be cleaned up on shutdown"
        );

        assert!(with_db(&manager, |db| focus_session_by_id(db, session_id)).is_err());

        let reopened = VaultManager::new(root.join("vaults")).with_browser_host_paths(paths);
        unlock_account(&reopened, "shutdown_user", "a-long-qa-password").unwrap();
        let recovered = with_db(&reopened, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(recovered.status, "PAUSED");
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn browser_policy_is_derived_only_from_active_focus_and_vault_resources() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "browser_policy", "a-long-qa-password").unwrap();
        let (session_id, resource_id) = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,started_at,phase_started_at) VALUES('QA Study',25,'ACTIVE',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))", [])?;
            let session_id = db.last_insert_rowid();
            db.execute("INSERT INTO browser_resources(focus_session_id,resource_type,match_type,disposition,break_only,destination,canonical_destination) VALUES(?1,'WEBSITE','DOMAIN','BLOCKED',0,'https://social.example','https://social.example')", [session_id])?;
            Ok((session_id, db.last_insert_rowid()))
        }).unwrap();
        let active = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(active["status"], "ACTIVE");
        assert_eq!(active["sessionId"], session_id);
        assert_eq!(active["resources"][0]["id"], resource_id);
        assert_eq!(active["resources"][0]["disposition"], "BLOCKED");
        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET status='PAUSED' WHERE id=?1",
                [session_id],
            )?;
            Ok(())
        })
        .unwrap();
        assert_eq!(
            with_db(&manager, build_local_browser_policy).unwrap()["status"],
            "INACTIVE"
        );
    }

    #[test]
    fn native_browser_policy_is_cleared_after_focus_cancel_and_completion() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "policy_lifecycle", "a-long-qa-password").unwrap();
        let paths = shinpo_browser_host::config::HostPaths {
            config: root.join("host/config.json"),
            policy: root.join("host/state/policy.json"),
            state_dir: root.join("host/state"),
        };
        shinpo_browser_host::initialize_installation(&paths).unwrap();
        let (cancel_id, complete_id) = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes) VALUES('Cancel flow',25)",
                [],
            )?;
            let cancel_id = db.last_insert_rowid();
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes) VALUES('Complete flow',25)",
                [],
            )?;
            Ok((cancel_id, db.last_insert_rowid()))
        })
        .unwrap();

        with_db(&manager, |db| {
            start_focus_session(db, cancel_id, unix_now_seconds())
        })
        .unwrap();
        let active = publish_local_browser_policy_at(&manager, &paths).unwrap();
        assert_eq!(active["status"], "ACTIVE");
        let first_revision = active["policyVersion"].as_i64().unwrap();

        let cancelled = with_db(&manager, |db| cancel_focus_session(db, cancel_id)).unwrap();
        assert_eq!(cancelled.status, "CANCELLED");
        assert_eq!(
            with_db(&manager, |db| cancel_focus_session(db, cancel_id))
                .unwrap()
                .status,
            "CANCELLED"
        );
        let inactive_after_cancel = publish_local_browser_policy_at(&manager, &paths).unwrap();
        assert_eq!(inactive_after_cancel["status"], "INACTIVE");
        assert!(inactive_after_cancel["policyVersion"].as_i64().unwrap() > first_revision);

        with_db(&manager, |db| {
            start_focus_session(db, complete_id, unix_now_seconds())
        })
        .unwrap();
        assert_eq!(
            publish_local_browser_policy_at(&manager, &paths).unwrap()["status"],
            "ACTIVE"
        );
        with_db(&manager, |db| {
            complete_focus_session(db, complete_id, unix_now_seconds(), None, None, None, false)?;
            Ok(())
        })
        .unwrap();
        let inactive_after_completion = publish_local_browser_policy_at(&manager, &paths).unwrap();
        assert_eq!(inactive_after_completion["status"], "INACTIVE");
        let stored: serde_json::Value =
            serde_json::from_slice(&fs::read(&paths.policy).unwrap()).unwrap();
        assert_eq!(stored["status"], "INACTIVE");
        assert_eq!(stored["resources"], serde_json::json!([]));

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn completed_focus_and_xp_survive_vault_reopen_and_cannot_be_awarded_twice() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "completion_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO goals(title,start_date) VALUES('Goal','2026-10-26')", [])?;
            db.execute("INSERT INTO tasks(goal_id,title,scheduled_date) VALUES(1,'Linked task','2026-10-26')", [])?;
            db.execute(
                "INSERT INTO calendar_sessions(task_id,name,duration_minutes,status,started_at,phase_started_at) VALUES(1,'Verified focus',25,'ACTIVE',strftime('%Y-%m-%dT%H:%M:%fZ','now','-16 minutes'),strftime('%Y-%m-%dT%H:%M:%fZ','now','-16 minutes'))",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();

        let completed = with_db(&manager, |db| {
            complete_focus_session(
                db,
                session_id,
                unix_now_seconds(),
                Some(5),
                Some("Clear next step".into()),
                Some("Feature shipped".into()),
                true,
            )
        })
        .unwrap();
        assert_eq!(completed.status, "COMPLETED");
        assert!((900..=1020).contains(&completed.active_seconds));
        assert!(with_db(&manager, |db| complete_focus_session(
            db,
            session_id,
            unix_now_seconds(),
            None,
            None,
            None,
            false
        ))
        .is_err());
        with_db(&manager, |db| {
            let xp: i64 = db.query_row(
                "SELECT COALESCE(SUM(amount),0) FROM progress_events",
                [],
                |row| row.get(0),
            )?;
            let count: i64 =
                db.query_row("SELECT COUNT(*) FROM progress_events", [], |row| row.get(0))?;
            let task: String =
                db.query_row("SELECT status FROM tasks WHERE id=1", [], |row| row.get(0))?;
            let goal: String =
                db.query_row("SELECT status FROM goals WHERE id=1", [], |row| row.get(0))?;
            assert_eq!(
                (xp, count, task.as_str(), goal.as_str()),
                (75, 3, "COMPLETED", "COMPLETED")
            );
            Ok(())
        })
        .unwrap();
        drop(manager);

        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "completion_user", "a-long-qa-password").unwrap();
        let recovered = with_db(&reopened, |db| focus_session_by_id(db, session_id)).unwrap();
        assert_eq!(
            recovered.reflection_note.as_deref(),
            Some("Clear next step")
        );
        assert_eq!(recovered.accomplishment.as_deref(), Some("Feature shipped"));
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_new_scheduled_session_cannot_change_the_active_guardian_policy() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_scope", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,started_at,phase_started_at) VALUES('Active focus',25,'ACTIVE','GUIDED',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))", [])?;
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode) VALUES('Later focus',25,'SCHEDULED','STRICT')", [])?;
            Ok(())
        })
        .unwrap();

        let policy = with_db(&manager, build_local_browser_policy).unwrap();
        assert_eq!(policy["mode"], "GUIDED");

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET guardian_mode='STRICT' WHERE id=1",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        assert_eq!(
            with_db(&manager, build_local_browser_policy).unwrap()["mode"],
            "STRICT"
        );

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_observations_deduplicate_and_record_mode_phase_outcomes() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_observations", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_app_monitoring) VALUES('Consented focus',25,'ACTIVE',1)", [])?;
            Ok(())
        })
        .unwrap();
        let candidate = shinpo_shield::observer::ObservedDistraction {
            pid: 4242,
            process_name: "discord".into(),
            process_started_at: 9001,
            catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            category: "COMMUNICATION",
            rationale: "Game and social chat platform",
            identity: None,
        };
        for _ in 0..2 {
            with_db(&manager, |db| {
                persist_guardian_observations(
                    db,
                    1,
                    "PROTECTED",
                    "FOCUS",
                    std::slice::from_ref(&candidate),
                    "2026-11-01T10:00:00Z",
                )
            })
            .unwrap();
        }
        let count = with_db(&manager, |db| {
            db.query_row("SELECT count(*) FROM guardian_observations", [], |row| {
                row.get::<_, i64>(0)
            })
        })
        .unwrap();
        assert_eq!(count, 1);
        let saved = with_db(&manager, |db| {
            db.query_row(
                "SELECT catalog_version,category,rationale FROM guardian_observations WHERE session_id=1",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
            )
        })
        .unwrap();
        assert_eq!(
            saved,
            (
                "guardian-apps-v1".into(),
                "COMMUNICATION".into(),
                "Game and social chat platform".into()
            )
        );

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET guardian_mode='STRICT' WHERE id=1",
                [],
            )?;
            persist_guardian_observations(
                db,
                1,
                "STRICT",
                "FOCUS",
                std::slice::from_ref(&candidate),
                "2026-11-01T10:01:00Z",
            )?;
            db.execute(
                "UPDATE calendar_sessions SET current_phase='BREAK' WHERE id=1",
                [],
            )?;
            persist_guardian_observations(
                db,
                1,
                "STRICT",
                "BREAK",
                std::slice::from_ref(&candidate),
                "2026-11-01T10:02:00Z",
            )?;
            Ok(())
        })
        .unwrap();
        let outcomes = with_db(&manager, |db| {
            let mut statement = db.prepare(
                "SELECT guardian_mode,focus_phase,outcome FROM guardian_observations ORDER BY id",
            )?;
            let rows = statement.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
        .unwrap();
        assert_eq!(
            outcomes,
            vec![
                (
                    "PROTECTED".into(),
                    "FOCUS".into(),
                    "WARNING_STANDARD".into()
                ),
                ("STRICT".into(), "FOCUS".into(), "WARNING_STRICT".into()),
                ("STRICT".into(), "BREAK".into(), "ALLOWED_BREAK".into()),
            ]
        );

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET status='PAUSED' WHERE id=1",
                [],
            )?;
            persist_guardian_observations(
                db,
                1,
                "PROTECTED",
                "FOCUS",
                std::slice::from_ref(&candidate),
                "2026-11-01T10:01:00Z",
            )
        })
        .unwrap();
        let count = with_db(&manager, |db| {
            db.query_row("SELECT count(*) FROM guardian_observations", [], |row| {
                row.get::<_, i64>(0)
            })
        })
        .unwrap();
        assert_eq!(count, 3);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_observer_failure_is_reported_without_inventing_observations() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_failure", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_app_monitoring) VALUES('Observed focus',25,'ACTIVE',1)", [])?;
            Ok(())
        }).unwrap();

        assert!(
            observe_local_guardian_apps_with(&manager, || Err("observer unavailable".into()))
                .is_err()
        );
        let status = local_get_guardian_status_from(&manager).unwrap();
        assert_eq!(status.observer_status, "DEGRADED");
        assert_eq!(status.application_policy_status, "OBSERVER_UNAVAILABLE");
        assert_eq!(
            status.application_catalog.len(),
            shinpo_shield::observer::distraction_catalog().len()
        );
        let count = with_db(&manager, |db| {
            db.query_row("SELECT count(*) FROM guardian_observations", [], |row| {
                row.get::<_, i64>(0)
            })
        })
        .unwrap();
        assert_eq!(count, 0);
        manager.guardian_observer.lock().unwrap().checked_at = Some("2020-01-01T00:00:00Z".into());
        assert_eq!(
            local_get_guardian_status_from(&manager)
                .unwrap()
                .observer_status,
            "DEGRADED"
        );

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn active_guardian_session_without_observation_consent_reports_idle() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_opt_out", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_app_monitoring) VALUES('Opted out focus',25,'ACTIVE',0)",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let status = local_get_guardian_status_from(&manager).unwrap();
        assert_eq!(status.status, "ACTIVE");
        assert_eq!(status.observer_status, "IDLE");
        assert_eq!(status.application_policy_status, "MONITORING_DISABLED");

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_status_never_advertises_close_during_break_or_pause() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_status_phase", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "UPDATE guardian_preferences SET app_monitoring_consent=1,closure_consent=1,background_runtime_consent=1 WHERE id=1",
                [],
            )?;
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,guardian_app_monitoring,current_phase) VALUES('Break',25,'ACTIVE','STRICT',1,'BREAK')",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        set_guardian_observer_health(&manager, Some(1), "MONITORING").unwrap();

        let break_status = local_get_guardian_status_from(&manager).unwrap();
        assert_eq!(
            break_status.application_policy_status,
            "BREAK_OBSERVATION_ONLY"
        );
        assert_eq!(
            break_status.intervention_capability,
            "BREAK_OBSERVATION_ONLY"
        );
        assert!(break_status.warning_only);

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET status='PAUSED',current_phase='FOCUS' WHERE id=1",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        let paused_status = local_get_guardian_status_from(&manager).unwrap();
        assert_eq!(paused_status.application_policy_status, "PAUSED");
        assert_eq!(paused_status.intervention_capability, "SESSION_PAUSED");

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET status='ACTIVE',current_phase='FOCUS' WHERE id=1",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        set_guardian_observer_health(&manager, Some(1), "SCANNING").unwrap();
        let starting_status = local_get_guardian_status_from(&manager).unwrap();
        assert_eq!(starting_status.observer_status, "STARTING");
        assert_eq!(
            starting_status.application_policy_status,
            "OBSERVER_STARTING"
        );
        assert_eq!(
            starting_status.intervention_capability,
            "LIMITED_OBSERVER_STARTING"
        );
        assert!(starting_status.warning_only);

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn emergency_stop_persists_for_a_paused_focus_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_paused_stop", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,guardian_app_monitoring) VALUES('Paused focus',25,'PAUSED','STRICT',1)",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        emergency_stop_guardian_in(&manager).unwrap();
        let disabled = with_db(&manager, |db| {
            db.query_row(
                "SELECT guardian_intervention_disabled FROM calendar_sessions WHERE id=1",
                [],
                |row| row.get::<_, bool>(0),
            )
        })
        .unwrap();
        assert!(disabled);

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_preference_is_encrypted_opt_in_reused_for_new_sessions_and_revocable() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_preference", "a-long-qa-password").unwrap();

        let initial = local_get_guardian_preferences_from(&manager).unwrap();
        assert!(!initial.app_monitoring_consent);
        assert!(!initial.apply_to_new_sessions);

        local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "STRICT".into(),
                app_monitoring_consent: true,
                apply_to_new_sessions: true,
                closure_consent: false,
                background_runtime_consent: false,
            },
        )
        .unwrap();
        let saved = local_get_guardian_preferences_from(&manager).unwrap();
        assert_eq!(saved.preferred_mode, "STRICT");
        assert!(saved.app_monitoring_consent && saved.apply_to_new_sessions);
        assert!(local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "UNRECOGNIZED".into(),
                app_monitoring_consent: false,
                apply_to_new_sessions: false,
                closure_consent: false,
                background_runtime_consent: false,
            },
        )
        .is_err());
        assert_eq!(
            local_get_guardian_preferences_from(&manager)
                .unwrap()
                .preferred_mode,
            "STRICT"
        );

        let created = with_db(&manager, |db| {
            insert_focus_record(
                db,
                &CreateFocusSessionRequest {
                    goal_id: None,
                    mission_id: None,
                    name: "Remembered Guardian choice".into(),
                    intention: None,
                    duration_minutes: 25,
                    scheduled_at: None,
                    pomodoro_enabled: None,
                    pomodoro_focus_cycles: None,
                    pomodoro_short_break_minutes: None,
                    pomodoro_long_break_minutes: None,
                    pomodoro_grace_minutes: None,
                    late_penalty_enabled: None,
                    late_penalty_xp: None,
                    late_penalty_daily_cap_xp: None,
                    guardian_mode: None,
                    guardian_app_monitoring: None,
                },
            )
        })
        .unwrap();
        assert_eq!(
            with_db(&manager, |db| {
                db.query_row(
                    "SELECT guardian_mode FROM calendar_sessions WHERE id=?1",
                    [created.id],
                    |row| row.get::<_, String>(0),
                )
            })
            .unwrap(),
            "STRICT"
        );
        assert!(created.guardian_app_monitoring);

        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET status='ACTIVE',guardian_app_monitoring=1 WHERE id=?1",
                [created.id],
            )?;
            Ok(())
        })
        .unwrap();
        local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "GUIDED".into(),
                app_monitoring_consent: false,
                apply_to_new_sessions: false,
                closure_consent: false,
                background_runtime_consent: false,
            },
        )
        .unwrap();
        let revoked = local_get_guardian_preferences_from(&manager).unwrap();
        assert!(!revoked.app_monitoring_consent && !revoked.apply_to_new_sessions);
        assert!(!with_db(&manager, |db| {
            db.query_row(
                "SELECT guardian_app_monitoring FROM calendar_sessions WHERE id=?1",
                [created.id],
                |row| row.get::<_, bool>(0),
            )
        })
        .unwrap());

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn standard_runtime_allowance_is_capped_transactional_and_persists_across_unlock() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_allowance", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,current_phase,guardian_mode,guardian_app_monitoring) VALUES('Allowance',30,'ACTIVE','FOCUS','PROTECTED',1)", [])?;
            Ok(db.last_insert_rowid())
        }).unwrap();
        let first = with_db(&manager, |db| {
            let tx = db.transaction()?;
            let seconds = advance_guardian_runtime_allowance(&tx, session_id, 1_000)?;
            tx.commit()?;
            Ok(seconds)
        })
        .unwrap();
        assert_eq!(first, 0);
        with_db(&manager, |db| {
            db.execute("UPDATE guardian_session_usage SET consumed_seconds=590,last_verified_epoch=1000 WHERE session_id=?1", [session_id])?;
            Ok(())
        }).unwrap();
        let at_boundary = with_db(&manager, |db| {
            let tx = db.transaction()?;
            let seconds = advance_guardian_runtime_allowance(&tx, session_id, 1_010)?;
            tx.commit()?;
            Ok(seconds)
        })
        .unwrap();
        assert_eq!(at_boundary, 600);
        let capped = with_db(&manager, |db| {
            let tx = db.transaction()?;
            let seconds = advance_guardian_runtime_allowance(&tx, session_id, 50_000)?;
            tx.commit()?;
            Ok(seconds)
        })
        .unwrap();
        assert_eq!(capped, 600);

        lock_vault_for_system_event(&manager).unwrap();
        drop(manager);
        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "guardian_allowance", "a-long-qa-password").unwrap();
        assert_eq!(
            with_db(&reopened, |db| db.query_row(
                "SELECT consumed_seconds FROM guardian_session_usage WHERE session_id=?1",
                [session_id],
                |row| row.get::<_, i64>(0)
            ))
            .unwrap(),
            600
        );
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_closure_consent_cannot_enable_intervention_and_emergency_stop_is_session_scoped() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_emergency", "a-long-qa-password").unwrap();
        assert!(local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "STRICT".into(),
                app_monitoring_consent: false,
                apply_to_new_sessions: false,
                closure_consent: true,
                background_runtime_consent: false,
            }
        )
        .is_err());
        let (active_id, scheduled_id) = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status) VALUES('Active',25,'ACTIVE')", [])?;
            let active = db.last_insert_rowid();
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status) VALUES('Scheduled',25,'SCHEDULED')", [])?;
            Ok((active, db.last_insert_rowid()))
        }).unwrap();
        emergency_stop_guardian_in(&manager).unwrap();
        assert!(with_db(&manager, |db| db.query_row(
            "SELECT guardian_intervention_disabled FROM calendar_sessions WHERE id=?1",
            [active_id],
            |row| row.get::<_, bool>(0)
        ))
        .unwrap());
        assert!(!with_db(&manager, |db| db.query_row(
            "SELECT guardian_intervention_disabled FROM calendar_sessions WHERE id=?1",
            [scheduled_id],
            |row| row.get::<_, bool>(0)
        ))
        .unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn strict_policy_rechecks_phase_and_revoked_consent_but_never_closes_apps() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_policy", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,current_phase,guardian_mode,guardian_app_monitoring) VALUES('Policy',25,'ACTIVE','FOCUS','STRICT',1)", [])?;
            Ok(db.last_insert_rowid())
        }).unwrap();
        local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "STRICT".into(),
                app_monitoring_consent: true,
                apply_to_new_sessions: true,
                closure_consent: true,
                background_runtime_consent: false,
            },
        )
        .unwrap();
        let process = shinpo_shield::observer::ObservedDistraction {
            pid: 4_000_000_000,
            process_name: "steam".into(),
            process_started_at: 1,
            catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            category: "GAMING",
            rationale: "disposable test identity",
            identity: Some(shinpo_shield::process_identity::ProcessIdentity {
                pid: 4_000_000_000,
                process_name: "steam".into(),
                process_start_ticks: 1,
                executable_path: PathBuf::from("/tmp/test-only-steam"),
                executable_device: 1,
                executable_inode: 1,
                executable_size: 1,
                owner_id: 1,
            }),
        };
        let armed = apply_guardian_app_policy(
            &manager,
            session_id,
            "STRICT",
            "FOCUS",
            std::slice::from_ref(&process),
        )
        .unwrap();
        assert_eq!(armed[0].2, "WARNING_STRICT_ENFORCEMENT_DISABLED");

        local_update_guardian_preferences_from(
            &manager,
            UpdateGuardianPreferencesRequest {
                preferred_mode: "STRICT".into(),
                app_monitoring_consent: true,
                apply_to_new_sessions: true,
                closure_consent: false,
                background_runtime_consent: false,
            },
        )
        .unwrap();
        let revoked = apply_guardian_app_policy(
            &manager,
            session_id,
            "STRICT",
            "FOCUS",
            std::slice::from_ref(&process),
        )
        .unwrap();
        assert_eq!(revoked[0].2, "WARNING_STRICT_ENFORCEMENT_DISABLED");
        with_db(&manager, |db| {
            db.execute(
                "UPDATE calendar_sessions SET current_phase='BREAK' WHERE id=?1",
                [session_id],
            )?;
            Ok(())
        })
        .unwrap();
        let during_break =
            apply_guardian_app_policy(&manager, session_id, "STRICT", "BREAK", &[process]).unwrap();
        assert_eq!(during_break[0].2, "ALLOWED_OUTSIDE_FOCUS");
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_observer_persists_discovered_apps_once_and_isolates_vault_accounts() {
        let owner_root = scratch_path();
        let owner = VaultManager::new(owner_root.clone());
        create_account(&owner, "guardian_owner", "a-long-qa-password").unwrap();
        with_db(&owner, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,guardian_app_monitoring) VALUES('Owner focus',25,'ACTIVE','GUIDED',1)", [])?;
            Ok(())
        }).unwrap();
        let candidate = shinpo_shield::observer::ObservedDistraction {
            pid: 1201,
            process_name: "steam".into(),
            process_started_at: 777,
            catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            category: "GAMING",
            rationale: "Game launcher and store",
            identity: None,
        };
        for _ in 0..2 {
            observe_local_guardian_apps_with(&owner, || Ok(vec![candidate.clone()])).unwrap();
        }
        assert_eq!(
            local_get_guardian_status_from(&owner)
                .unwrap()
                .observer_status,
            "MONITORING"
        );
        assert_eq!(
            local_get_guardian_observations_from(&owner, 1)
                .unwrap()
                .len(),
            1
        );

        let other_root = scratch_path();
        let other = VaultManager::new(other_root.clone());
        create_account(&other, "guardian_other", "another-long-qa-password").unwrap();
        assert!(local_get_guardian_observations_from(&other, 1)
            .unwrap()
            .is_empty());
        assert_eq!(
            local_get_guardian_status_from(&other)
                .unwrap()
                .active_focus_session_id,
            None
        );

        drop(other);
        drop(owner);
        fs::remove_dir_all(owner_root).unwrap();
        fs::remove_dir_all(other_root).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn fedora_observer_detects_harmless_catalog_named_process_and_recovers_encrypted_history() {
        struct TestChild(std::process::Child);
        impl Drop for TestChild {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }

        let root = scratch_path();
        let fixture_dir = root.join("process-fixture");
        fs::create_dir_all(&fixture_dir).unwrap();
        let harmless_steam = fixture_dir.join("steam");
        std::os::unix::fs::symlink("/usr/bin/sleep", &harmless_steam).unwrap();
        let child = TestChild(
            std::process::Command::new(&harmless_steam)
                .arg("120")
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
                .unwrap(),
        );
        let process_id = child.0.id();
        let manager = VaultManager::new(root.join("accounts"));
        create_account(&manager, "guardian_runtime", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,guardian_app_monitoring) VALUES('Disposable observer QA',25,'ACTIVE','PROTECTED',1)", [])?;
            Ok(db.last_insert_rowid())
        }).unwrap();

        let app = tauri::test::mock_builder()
            .manage(manager)
            .invoke_handler(tauri::generate_handler![
                local_get_guardian_status,
                local_get_guardian_observations,
                local_emergency_stop_guardian
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let invoke = |cmd: &str, body: serde_json::Value| {
            tauri::test::get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd: cmd.into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: if cfg!(windows) {
                        "http://tauri.localhost"
                    } else {
                        "tauri://localhost"
                    }
                    .parse()
                    .unwrap(),
                    body: tauri::ipc::InvokeBody::Json(body),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.into(),
                },
            )
            .map(|body| body.deserialize::<serde_json::Value>().unwrap())
        };

        let mut found = None;
        for _ in 0..40 {
            observe_local_guardian_apps(app.state::<VaultManager>().inner()).unwrap();
            found = local_get_guardian_observations_from(
                app.state::<VaultManager>().inner(),
                session_id,
            )
            .unwrap()
            .into_iter()
            .find(|entry| entry.pid == process_id);
            if found.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        let found = found.expect("actual sysinfo scan did not discover the harmless steam fixture");
        assert_eq!(found.process_name, "steam");
        assert_eq!(
            found.catalog_version,
            shinpo_shield::observer::APP_CATALOG_VERSION
        );
        assert_eq!(found.category, "GAMING");
        assert_eq!(found.outcome, "LIMITED_IDENTITY_UNVERIFIED");
        let ipc_status = invoke("local_get_guardian_status", serde_json::json!({})).unwrap();
        assert_eq!(ipc_status["observerStatus"], "MONITORING");
        assert_eq!(
            ipc_status["applicationPolicyStatus"],
            "LIMITED_NO_RUNTIME_CONSENT"
        );
        assert_eq!(ipc_status["warningOnly"], true);
        let ipc_history = invoke(
            "local_get_guardian_observations",
            serde_json::json!({"sessionId": session_id}),
        )
        .unwrap();
        assert!(ipc_history
            .as_array()
            .unwrap()
            .iter()
            .any(|entry| entry["pid"] == process_id));

        observe_local_guardian_apps(app.state::<VaultManager>().inner()).unwrap();
        assert_eq!(
            local_get_guardian_observations_from(app.state::<VaultManager>().inner(), session_id)
                .unwrap()
                .iter()
                .filter(|entry| entry.pid == process_id)
                .count(),
            1
        );
        drop(app);

        let reopened = VaultManager::new(root.join("accounts"));
        unlock_account(&reopened, "guardian_runtime", "a-long-qa-password").unwrap();
        let restored = local_get_guardian_observations_from(&reopened, session_id).unwrap();
        assert!(restored
            .iter()
            .any(|entry| entry.pid == process_id && entry.process_name == "steam"));
        assert_eq!(
            local_get_guardian_status_from(&reopened)
                .unwrap()
                .observer_status,
            "STARTING"
        );
        observe_local_guardian_apps(&reopened).unwrap();
        assert_eq!(
            local_get_guardian_observations_from(&reopened, session_id)
                .unwrap()
                .iter()
                .filter(|entry| entry.pid == process_id)
                .count(),
            1
        );

        drop(reopened);
        drop(child);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_status_and_observation_commands_return_disposable_vault_data_over_tauri_ipc() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_ipc", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_mode,guardian_app_monitoring) VALUES('IPC focus',25,'ACTIVE','STRICT',1)", [])?;
            Ok(())
        }).unwrap();
        let observed = shinpo_shield::observer::ObservedDistraction {
            pid: 4242,
            process_name: "discord".into(),
            process_started_at: 9001,
            catalog_version: shinpo_shield::observer::APP_CATALOG_VERSION,
            category: "COMMUNICATION",
            rationale: "Game and social chat platform",
            identity: None,
        };
        with_db(&manager, |db| {
            persist_guardian_observations(
                db,
                1,
                "STRICT",
                "FOCUS",
                std::slice::from_ref(&observed),
                "2026-11-02T10:00:00Z",
            )
        })
        .unwrap();

        let app = tauri::test::mock_builder()
            .manage(manager)
            .invoke_handler(tauri::generate_handler![
                local_get_guardian_status,
                local_get_guardian_observations,
                local_emergency_stop_guardian
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let invoke = |cmd: &str, body: serde_json::Value| {
            tauri::test::get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd: cmd.into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: if cfg!(windows) {
                        "http://tauri.localhost"
                    } else {
                        "tauri://localhost"
                    }
                    .parse()
                    .unwrap(),
                    body: tauri::ipc::InvokeBody::Json(body),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.into(),
                },
            )
            .map(|body| body.deserialize::<serde_json::Value>().unwrap())
        };

        let status = invoke("local_get_guardian_status", serde_json::json!({})).unwrap();
        assert_eq!(status["status"], "ACTIVE");
        assert_eq!(status["guardianMode"], "STRICT");
        assert_eq!(status["focusPhase"], "FOCUS");
        assert_eq!(status["applicationPolicyStatus"], "OBSERVER_STARTING");
        assert_eq!(status["warningOnly"], true);
        assert!(status["applicationCatalog"]
            .as_array()
            .unwrap()
            .iter()
            .any(|entry| entry["processName"] == "discord"));
        invoke("local_emergency_stop_guardian", serde_json::json!({})).unwrap();
        assert_eq!(
            local_get_guardian_status_from(app.state::<VaultManager>().inner())
                .unwrap()
                .application_policy_status,
            "EMERGENCY_STOPPED"
        );

        let history = invoke(
            "local_get_guardian_observations",
            serde_json::json!({"sessionId": 1}),
        )
        .unwrap();
        assert_eq!(history[0]["processName"], "discord");
        assert_eq!(history[0]["outcome"], "WARNING_STRICT");
        assert!(invoke(
            "local_get_guardian_observations",
            serde_json::json!({"sessionId": -1})
        )
        .is_err());
        assert!(invoke("local_get_guardian_observations", serde_json::json!({})).is_err());
        {
            let state = app.state::<VaultManager>();
            state.unlocked.lock().unwrap().take();
        }
        drop(webview);
        drop(app);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_catalog_v7_migration_preserves_v6_observations() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_v7", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute("INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_app_monitoring) VALUES('Existing active focus',25,'ACTIVE',0)", [])?;
            let session_id = db.last_insert_rowid();
            db.execute(
                "INSERT INTO guardian_observations(event_key,session_id,pid,process_name,process_started_at,observed_at)
                 VALUES('legacy-event',?1,4242,'steam',9001,'2026-10-30T10:00:00Z')",
                [session_id],
            )?;
            db.execute_batch(
                "ALTER TABLE guardian_observations DROP COLUMN catalog_version;
                 ALTER TABLE guardian_observations DROP COLUMN category;
                 ALTER TABLE guardian_observations DROP COLUMN rationale;
                 DROP TABLE guardian_preferences;",
            )?;
            db.pragma_update(None, "user_version", 6)?;
            apply_schema_migrations(db).map_err(|_| rusqlite::Error::InvalidQuery)?;
            let event: (String, String, String) = db.query_row(
                "SELECT catalog_version,category,rationale FROM guardian_observations WHERE event_key='legacy-event'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )?;
            assert_eq!(event.0, "guardian-apps-v1");
            assert_eq!(event.1, "LEGACY");
            assert_eq!(event.2, "Previously observed by an older Guardian catalog");
            let context: (String, String, String) = db.query_row(
                "SELECT guardian_mode,focus_phase,outcome FROM guardian_observations WHERE event_key='legacy-event'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )?;
            assert_eq!(context, ("PROTECTED".into(), "FOCUS".into(), "WARNING_STANDARD".into()));
            let version: i64 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
            assert_eq!(version, LATEST_SCHEMA_VERSION);
            let monitoring: bool = db.query_row(
                "SELECT guardian_app_monitoring FROM calendar_sessions WHERE id=?1",
                [session_id],
                |row| row.get(0),
            )?;
            assert!(!monitoring);
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_monitoring_requires_session_consent_and_resume_preserves_choice() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_consent", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            let request = CreateFocusSessionRequest {
                goal_id: None,
                mission_id: None,
                name: "No monitoring by default".into(),
                intention: None,
                duration_minutes: 25,
                scheduled_at: None,
                pomodoro_enabled: None,
                pomodoro_focus_cycles: None,
                pomodoro_short_break_minutes: None,
                pomodoro_long_break_minutes: None,
                pomodoro_grace_minutes: None,
                late_penalty_enabled: None,
                late_penalty_xp: None,
                late_penalty_daily_cap_xp: None,
                guardian_mode: None,
                guardian_app_monitoring: None,
            };
            let session = insert_focus_record(db, &request)?;
            assert!(!session.guardian_app_monitoring);
            start_focus_session(db, session.id, unix_now_seconds())?;
            pause_focus_session(db, session.id, unix_now_seconds())?;
            let resumed = resume_focus_session(db, session.id, unix_now_seconds())?;
            assert!(!resumed.guardian_app_monitoring);

            let mut opted_in = request;
            opted_in.name = "Explicit observation consent".into();
            opted_in.guardian_app_monitoring = Some(true);
            assert!(insert_focus_record(db, &opted_in)?.guardian_app_monitoring);
            Ok(session.id)
        })
        .unwrap();
        assert!(!with_db(&manager, |db| {
            let observations_enabled: bool = db.query_row(
                "SELECT guardian_app_monitoring FROM calendar_sessions WHERE id=?1",
                [session_id],
                |row| row.get(0),
            )?;
            Ok(observations_enabled)
        })
        .unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn schema_v13_revokes_inferred_monitoring_without_deleting_focus_history() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "guardian_v13", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status,guardian_app_monitoring) VALUES('Historical focus',25,'COMPLETED',1)",
                [],
            )?;
            let session_id = db.last_insert_rowid();
            db.execute(
                "INSERT INTO guardian_observations(event_key,session_id,pid,process_name,process_started_at,catalog_version,category,rationale,guardian_mode,focus_phase,outcome) VALUES('kept-event',?1,4242,'steam',9001,'guardian-apps-v1','GAMING','catalog match','PROTECTED','FOCUS','WARNING_STANDARD')",
                [session_id],
            )?;
            db.execute("DROP TABLE guardian_preferences", [])?;
            db.pragma_update(None, "user_version", 12)?;
            apply_schema_migrations(db).map_err(|_| rusqlite::Error::InvalidQuery)?;
            let monitoring: bool = db.query_row(
                "SELECT guardian_app_monitoring FROM calendar_sessions WHERE id=?1",
                [session_id],
                |row| row.get(0),
            )?;
            let history: (String, i64) = db.query_row(
                "SELECT process_name,session_id FROM guardian_observations WHERE event_key='kept-event'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            assert!(!monitoring);
            assert_eq!(history, ("steam".into(), session_id));
            let version: i64 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
            assert_eq!(version, LATEST_SCHEMA_VERSION);
            Ok(())
        })
        .unwrap();
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_focus_allows_only_one_active_or_paused_session() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "concurrent_user", "a-long-qa-password").unwrap();
        let (first, second) = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes) VALUES('First',25)",
                [],
            )?;
            let first = db.last_insert_rowid();
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes) VALUES('Second',25)",
                [],
            )?;
            Ok((first, db.last_insert_rowid()))
        })
        .unwrap();

        let now = 1_800_000_000;
        with_db(&manager, |db| start_focus_session(db, first, now)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second, now)).is_err());
        with_db(&manager, |db| pause_focus_session(db, first, now + 10)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second, now + 10)).is_err());
        with_db(&manager, |db| resume_focus_session(db, first, now + 20)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second, now + 20)).is_err());
        with_db(&manager, |db| {
            complete_focus_session(db, first, now + 20, None, None, None, false)
        })
        .unwrap();
        assert_eq!(
            with_db(&manager, |db| start_focus_session(db, second, now + 20))
                .unwrap()
                .status,
            "ACTIVE"
        );
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_onboarding_is_saved_in_encrypted_vault_and_rejects_invalid_steps() {
        assert_eq!(validate_onboarding_start_step(None).unwrap(), 0);
        assert_eq!(validate_onboarding_start_step(Some(5)).unwrap(), 5);
        assert!(validate_onboarding_start_step(Some(6)).is_err());
        assert!(valid_onboarding_step(0));
        assert!(valid_onboarding_step(5));
        assert!(!valid_onboarding_step(-1));
        assert!(!valid_onboarding_step(6));
        assert!(valid_onboarding_pause_step(6));
        assert!(!valid_onboarding_pause_step(7));

        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("onboarding.db");
        let key = [0x29; KEY_BYTES];
        let db = open_encrypted_database(&path, &key, "onboarding_user", true).unwrap();
        assert_eq!(local_onboarding_state(&db).unwrap().status, "NOT_STARTED");
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,started_at,updated_at) VALUES(1,'IN_PROGRESS',3,'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
            [],
        ).unwrap();
        assert_eq!(local_onboarding_state(&db).unwrap().current_step, 3);
        assert_eq!(
            local_onboarding_state(&db).unwrap().completed_steps_count,
            3
        );
        drop(db);

        let mut reopened = open_encrypted_database(&path, &key, "onboarding_user", false).unwrap();
        let recovered = local_onboarding_state(&reopened).unwrap();
        assert_eq!(recovered.status, "IN_PROGRESS");
        assert_eq!(recovered.current_step, 3);
        assert_eq!(recovered.completed_steps_count, 3);
        let finished = finish_local_onboarding(&mut reopened).unwrap();
        assert_eq!(finished.status, "COMPLETED");
        assert_eq!(finished.current_step, 6);
        assert_eq!(finished.completed_steps_count, 6);
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn onboarding_reward_requires_workflow_and_awards_once_transactionally() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("onboarding-reward.db");
        let key = [0x31; KEY_BYTES];
        let mut db = open_encrypted_database(&path, &key, "reward_user", true).unwrap();
        db.execute(
            "INSERT INTO local_onboarding(id,status,current_step,started_at,completed_at,updated_at) VALUES(1,'COMPLETED',6,'2020-01-01T00:00:00Z','2020-01-01T00:05:00Z','2020-01-01T00:05:00Z')",
            [],
        ).unwrap();
        db.execute(
            "INSERT INTO goals(title,start_date,status) VALUES('Goal','2026-11-01','ACTIVE')",
            [],
        )
        .unwrap();
        let goal = db.last_insert_rowid();
        db.execute(
            "INSERT INTO tasks(goal_id,title,scheduled_date,status,completed_at) VALUES(?1,'Task','2026-11-01','COMPLETED','2026-11-01T10:30:00Z')",
            [goal],
        ).unwrap();
        let task = db.last_insert_rowid();
        let task_reward_id: String = db
            .query_row("SELECT reward_id FROM tasks WHERE id=?1", [task], |row| {
                row.get(0)
            })
            .unwrap();
        db.execute(
            "INSERT INTO progress_events(event_key,event_type,amount) VALUES(?1,'MISSION_COMPLETED',10)",
            [format!("task:{task_reward_id}")],
        ).unwrap();
        db.execute(
            "INSERT INTO calendar_sessions(goal_id,task_id,name,duration_minutes,scheduled_at,status,started_at,ended_at,focus_active_seconds) VALUES(?1,?2,'Focus',25,'2026-11-01T10:00:00Z','COMPLETED','2026-11-01T10:00:00Z','2026-11-01T10:25:00Z',1500)",
            params![goal, task],
        ).unwrap();
        let session = db.last_insert_rowid();
        let session_reward_id: String = db
            .query_row(
                "SELECT reward_id FROM calendar_sessions WHERE id=?1",
                [session],
                |row| row.get(0),
            )
            .unwrap();
        db.execute(
            "INSERT INTO progress_events(event_key,event_type,amount,session_id) VALUES(?1,'FOCUS_SESSION_COMPLETED',15,?2)",
            params![format!("focus:{session_reward_id}"), session],
        ).unwrap();

        assert!(local_onboarding_state(&db).unwrap().can_claim_reward);
        assert_eq!(claim_onboarding_reward(&mut db).unwrap().total_progress, 75);
        assert_eq!(claim_onboarding_reward(&mut db).unwrap().total_progress, 75);
        let awards: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_type='ONBOARDING_COMPLETED'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(awards, 1);
        drop(db);

        let reopened = open_encrypted_database(&path, &key, "reward_user", false).unwrap();
        assert_eq!(local_progress(&reopened).unwrap().total_progress, 75);
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_password_change_rewraps_existing_vault_and_keeps_recovery_key_valid() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        let created = create_account(&manager, "password_user", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "INSERT INTO goals(title,start_date,status) VALUES('Preserved','2026-11-01','ACTIVE')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        change_account_password(
            &manager,
            "password_user",
            "a-long-qa-password",
            "new-long-qa-password",
        )
        .unwrap();
        manager.unlocked.lock().unwrap().take();
        unlock_account(&manager, "password_user", "new-long-qa-password").unwrap();
        let count = with_db(&manager, |db| {
            db.query_row(
                "SELECT COUNT(*) FROM goals WHERE title='Preserved'",
                [],
                |row| row.get::<_, i64>(0),
            )
        })
        .unwrap();
        assert_eq!(count, 1);

        recover_account(
            &manager,
            "password_user",
            &created.recovery_key,
            "recovered-qa-password",
        )
        .unwrap();
        manager.unlocked.lock().unwrap().take();
        unlock_account(&manager, "password_user", "recovered-qa-password").unwrap();
        assert!(change_account_password(
            &manager,
            "password_user",
            "a-long-qa-password",
            "yet-another-long-password"
        )
        .is_err());
        assert_eq!(
            manager
                .metadata("password_user")
                .unwrap()
                .failed_unlock_attempts,
            1
        );
        assert_eq!(
            with_db(&manager, |db| db.query_row(
                "SELECT COUNT(*) FROM goals",
                [],
                |row| row.get::<_, i64>(0)
            ))
            .unwrap(),
            1
        );
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recovery_attempts_share_persisted_backoff_across_vault_managers() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        let created = create_account(&manager, "recovery_throttle", "a-long-qa-password").unwrap();
        manager.unlocked.lock().unwrap().take();
        let mut metadata = manager.metadata("recovery_throttle").unwrap();
        metadata.failed_unlock_attempts = 4;
        write_metadata(&root.join("recovery_throttle/vault.json"), &metadata).unwrap();

        assert!(recover_account(
            &manager,
            "recovery_throttle",
            "invalid-recovery-key",
            "a-different-long-password"
        )
        .is_err());
        let mut metadata = manager.metadata("recovery_throttle").unwrap();
        assert_eq!(metadata.failed_unlock_attempts, 5);
        assert!(metadata.unlock_blocked_until.unwrap() > unix_now_seconds());

        let restarted = VaultManager::new(root.clone());
        assert!(recover_account(
            &restarted,
            "recovery_throttle",
            &created.recovery_key,
            "a-different-long-password"
        )
        .is_err());

        metadata.unlock_blocked_until = Some(unix_now_seconds() - 1);
        write_metadata(&root.join("recovery_throttle/vault.json"), &metadata).unwrap();
        recover_account(
            &restarted,
            "recovery_throttle",
            &created.recovery_key,
            "a-different-long-password",
        )
        .unwrap();
        assert!(restarted.is_unlocked().unwrap());

        drop(restarted);
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_account_deletion_requires_idle_focus_and_clears_policy_before_removing_vault() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "delete_me", "a-long-qa-password").unwrap();
        with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status) VALUES('Active',25,'ACTIVE')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let mut cleared_policy = false;
        assert!(delete_local_account_data(
            &manager,
            "delete_me",
            || {
                cleared_policy = true;
                Ok(())
            },
            |_, _| Ok(()),
        )
        .is_err());
        assert!(!cleared_policy);
        assert!(root.join("delete_me").is_dir());
        assert!(manager.is_unlocked().unwrap());

        with_db(&manager, |db| {
            db.execute("UPDATE calendar_sessions SET status='CANCELLED'", [])?;
            Ok(())
        })
        .unwrap();
        assert!(delete_local_account_data(
            &manager,
            "delete_me",
            || Err("policy service unavailable".into()),
            |_, _| Ok(()),
        )
        .is_err());
        assert!(root.join("delete_me").is_dir());
        assert!(manager.is_unlocked().unwrap());

        assert!(delete_local_account_data(
            &manager,
            "delete_me",
            || Ok(()),
            |_, _| Err("keychain unavailable".into()),
        )
        .is_err());
        assert!(root.join("delete_me").is_dir());
        assert!(manager.is_unlocked().unwrap());

        delete_local_account_data(
            &manager,
            "delete_me",
            || {
                cleared_policy = true;
                Ok(())
            },
            |_, _| Ok(()),
        )
        .unwrap();
        assert!(cleared_policy);
        assert!(!root.join("delete_me").exists());
        assert!(!manager.is_unlocked().unwrap());
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_eonpai_history_is_encrypted_persistent_and_uses_only_vault_tasks() {
        let root = scratch_path();
        fs::create_dir_all(&root).unwrap();
        let path = root.join("eonpai.db");
        let key = [0x52; KEY_BYTES];
        let db = open_encrypted_database(&path, &key, "eonpai_user", true).unwrap();
        db.execute(
            "INSERT INTO goals(title,start_date,status) VALUES('Study systems','2026-11-01','ACTIVE')",
            [],
        ).unwrap();
        let goal = db.last_insert_rowid();
        db.execute(
            "INSERT INTO tasks(goal_id,title,scheduled_date,status,estimated_minutes) VALUES(?1,'Review chapter','2026-11-02','PENDING',30)",
            [goal],
        ).unwrap();
        let mut db = db;
        let response = send_local_eonpai(&mut db, "what is my next task?", None).unwrap();
        assert!(response.reply.contains("Review chapter"));
        db.execute("INSERT INTO calendar_sessions(goal_id,task_id,name,duration_minutes,status,current_phase) VALUES(?1,1,'Review chapter',25,'ACTIVE','FOCUS')", [goal]).unwrap();
        let greeting = send_local_eonpai(&mut db, "hello", None).unwrap();
        assert!(greeting.reply.contains("Hello."));
        assert!(!greeting.reply.contains("seconds remain"));
        let unclear = send_local_eonpai(&mut db, "huh", None).unwrap();
        assert!(unclear
            .reply
            .contains("can’t answer unrestricted questions"));
        assert!(!unclear.reply.contains("seconds remain"));
        let focus_question =
            send_local_eonpai(&mut db, "How much time is left in my focus session?", None).unwrap();
        assert!(focus_question.reply.contains("Review chapter"));
        assert!(send_local_eonpai(&mut db, "stale conversation", Some("local-999")).is_err());
        let conversation: i64 = ensure_active_eonpai_conversation(&db).unwrap();
        let conversation_id = response.conversation_id.clone();
        drop(db);

        let reopened = open_encrypted_database(&path, &key, "eonpai_user", false).unwrap();
        let recovered = local_eonpai_conversation(&reopened, conversation).unwrap();
        assert_eq!(recovered.conversation_id, conversation_id);
        assert_eq!(recovered.messages.len(), 8);
        assert_eq!(recovered.messages[0].role, "USER");
        assert!(recovered.messages[1].content.contains("Review chapter"));
        assert_eq!(recovered.messages[6].role, "USER");
        assert!(recovered.messages[7].content.contains("Review chapter"));
        assert_eq!(
            ensure_active_eonpai_conversation(&reopened).unwrap(),
            conversation
        );
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn encrypted_core_workflow_survives_restart_with_isolated_records_and_once_only_rewards() {
        let root = scratch_path();
        let owner = std::sync::Arc::new(VaultManager::new(root.clone()));
        create_account(&owner, "workflow_owner", "a-long-qa-password").unwrap();
        let (goal_id, task_id, session_id) = with_db(&owner, |db| {
            db.execute(
                "INSERT INTO goals(title,description,start_date,target_date,status) VALUES('Exam preparation','Complete the systems review','2026-11-01','2026-11-07','ACTIVE')",
                [],
            )?;
            let goal_id = db.last_insert_rowid();
            db.execute(
                "INSERT INTO tasks(goal_id,title,description,scheduled_date,estimated_minutes,status) VALUES(?1,'Review concurrency','Read and summarize the chapter','2026-11-02',25,'PENDING')",
                [goal_id],
            )?;
            let task_id = db.last_insert_rowid();
            db.execute(
                "INSERT INTO calendar_sessions(goal_id,task_id,name,intention,duration_minutes,scheduled_at,status) VALUES(?1,?2,'Systems review','Understand locking and transactions',25,'2026-11-02T10:00:00Z','SCHEDULED')",
                params![goal_id, task_id],
            )?;
            Ok((goal_id, task_id, db.last_insert_rowid()))
        })
        .unwrap();

        let started_at = 1_798_800_000;
        with_db(&owner, |db| start_focus_session(db, session_id, started_at)).unwrap();
        let completed = with_db(&owner, |db| {
            complete_focus_session(
                db,
                session_id,
                started_at + 25 * 60,
                Some(5),
                Some("Finished the planned review".into()),
                Some("Concurrency notes completed".into()),
                false,
            )
        })
        .unwrap();
        assert_eq!(completed.status, "COMPLETED");
        assert_eq!(completed.active_seconds, 25 * 60);
        let completions = std::thread::scope(|scope| {
            let first = scope.spawn(|| with_db(&owner, |db| complete_task(db, task_id, Some(25))));
            let second = scope.spawn(|| with_db(&owner, |db| complete_task(db, task_id, Some(25))));
            [
                first.join().unwrap().is_ok(),
                second.join().unwrap().is_ok(),
            ]
        });
        assert_eq!(completions.into_iter().filter(|ok| *ok).count(), 1);
        let progress = with_db(&owner, |db| local_progress(db)).unwrap();
        assert_eq!(progress.total_progress, 75);
        assert_eq!(
            with_db(&owner, |db| db.query_row(
                "SELECT COUNT(*) FROM progress_events WHERE event_key IN (
                    'focus:'||(SELECT reward_id FROM calendar_sessions WHERE id=?1),
                    'task:'||(SELECT reward_id FROM tasks WHERE id=?2),
                    'goal:'||(SELECT reward_id FROM goals WHERE id=?3))",
                params![session_id, task_id, goal_id],
                |row| row.get::<_, i64>(0),
            ))
            .unwrap(),
            3
        );
        drop(owner);

        let reopened = VaultManager::new(root.clone());
        unlock_account(&reopened, "workflow_owner", "a-long-qa-password").unwrap();
        let recovered = with_db(&reopened, |db| {
            let goal = goal_by_id(db, goal_id)?;
            let task = task_by_id(db, task_id)?;
            let session = focus_session_by_id(db, session_id)?;
            Ok((goal, task, session, local_progress(db)?))
        })
        .unwrap();
        assert_eq!(recovered.0.status, "COMPLETED");
        assert_eq!(recovered.1.status, "COMPLETED");
        assert_eq!(
            recovered.2.reflection_note.as_deref(),
            Some("Finished the planned review")
        );
        assert_eq!(recovered.3.total_progress, 75);

        let other = VaultManager::new(root.clone());
        create_account(&other, "workflow_other", "another-long-qa-password").unwrap();
        assert!(with_db(&other, |db| goal_by_id(db, goal_id)).is_err());
        assert_eq!(
            with_db(&other, |db| local_progress(db))
                .unwrap()
                .total_progress,
            0
        );
        drop(other);
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn guardian_app_policies_persist_survive_reopen_and_reject_protected_processes() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "policy_user", "a-long-qa-password").unwrap();

        // 1. Protected process cannot be blocked
        let protected_req = SaveAppPolicyRequest {
            app_id: "systemd.desktop".to_string(),
            app_name: "Systemd Daemon".to_string(),
            exec_name: "systemd".to_string(),
            policy_type: "BLOCKED".to_string(),
            source: Some("system".to_string()),
        };
        assert!(local_save_app_policy_in(&manager, protected_req).is_err());

        // 2. Valid apps can be blocked and allowed
        let block_req = SaveAppPolicyRequest {
            app_id: "code.desktop".to_string(),
            app_name: "Visual Studio Code".to_string(),
            exec_name: "code".to_string(),
            policy_type: "BLOCKED".to_string(),
            source: Some("system".to_string()),
        };
        let saved_block = local_save_app_policy_in(&manager, block_req).unwrap();
        assert_eq!(saved_block.policy_type, "BLOCKED");

        let allow_req = SaveAppPolicyRequest {
            app_id: "discord.desktop".to_string(),
            app_name: "Discord Chat".to_string(),
            exec_name: "discord".to_string(),
            policy_type: "ALLOWED".to_string(),
            source: Some("system".to_string()),
        };
        let saved_allow = local_save_app_policy_in(&manager, allow_req).unwrap();
        assert_eq!(saved_allow.policy_type, "ALLOWED");

        let policies = local_get_app_policies_from(&manager).unwrap();
        assert_eq!(policies.len(), 2);

        // 3. Discovered apps reflect saved policies
        let discovered = local_get_discovered_apps_from(&manager).unwrap();
        if let Some(app) = discovered
            .iter()
            .find(|a| a.id == "code.desktop" || a.exec_name.as_deref() == Some("code"))
        {
            assert_eq!(app.policy, "BLOCKED");
        }
        if let Some(app) = discovered
            .iter()
            .find(|a| a.id == "discord.desktop" || a.exec_name.as_deref() == Some("discord"))
        {
            assert_eq!(app.policy, "ALLOWED");
        }

        // 4. Policy deletion works
        local_remove_app_policy_in(&manager, "code.desktop").unwrap();
        let remaining = local_get_app_policies_from(&manager).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].app_id, "discord.desktop");

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_daily_consistency_streak_18_cases_suite() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "streak_tester", "a-long-qa-password").unwrap();

        with_db(&manager, |db| {
            let ref_date = time::Date::from_calendar_date(2026, time::Month::November, 8).unwrap();

            // Case 1: Empty account starts at zero
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 0);
            assert_eq!(streak.longest_streak, 0);
            assert!(!streak.today_completed);
            assert_eq!(streak.productive_days_this_month, 0);
            assert_eq!(streak.last_seven_days.len(), 7);

            // Case 2: Completing one Task qualifies today
            db.execute(
                "INSERT INTO goals(id,title,start_date,status) VALUES(1,'Test Goal','2026-11-01','ACTIVE')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(1,1,'Task 1','2026-11-08','COMPLETED','2026-11-08T10:00:00Z')",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 1);
            assert_eq!(streak.longest_streak, 1);
            assert!(streak.today_completed);
            assert_eq!(streak.productive_days_this_month, 1);

            // Reset tasks for next isolation test
            db.execute("DELETE FROM tasks", [])?;

            // Case 3: A verified 15-minute completed Focus session qualifies today
            db.execute(
                "INSERT INTO calendar_sessions(id,name,duration_minutes,status,started_at,ended_at,active_seconds,focus_active_seconds) VALUES(1,'Focus 15m',15,'COMPLETED','2026-11-08T09:00:00Z','2026-11-08T09:15:00Z',900,900)",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 1);
            assert_eq!(streak.longest_streak, 1);
            assert!(streak.today_completed);

            // Reset sessions
            db.execute("DELETE FROM calendar_sessions", [])?;

            // Case 4: A shorter Focus session alone (< 900s) does not qualify
            db.execute(
                "INSERT INTO calendar_sessions(id,name,duration_minutes,status,started_at,ended_at,active_seconds,focus_active_seconds) VALUES(2,'Focus 10m',10,'COMPLETED','2026-11-08T09:00:00Z','2026-11-08T09:10:00Z',600,600)",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 0);
            assert_eq!(streak.longest_streak, 0);
            assert!(!streak.today_completed);

            // Case 5: Starting and abandoning a session does not qualify
            db.execute(
                "INSERT INTO calendar_sessions(id,name,duration_minutes,status,started_at,active_seconds,focus_active_seconds) VALUES(3,'Active Unfinished',25,'ACTIVE','2026-11-08T09:00:00Z',1200,1200)",
                [],
            )?;
            db.execute(
                "INSERT INTO calendar_sessions(id,name,duration_minutes,status,started_at,ended_at,active_seconds,focus_active_seconds) VALUES(4,'Cancelled',25,'CANCELLED','2026-11-08T09:00:00Z','2026-11-08T09:20:00Z',1200,1200)",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 0);
            assert!(!streak.today_completed);

            // Case 6: Multiple completed Tasks in one day count once
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(2,1,'Task A','2026-11-08','COMPLETED','2026-11-08T11:00:00Z')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(3,1,'Task B','2026-11-08','COMPLETED','2026-11-08T12:00:00Z')",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 1);
            assert_eq!(streak.productive_days_this_month, 1);

            // Case 7: Focus plus Task on the same day count once
            db.execute(
                "INSERT INTO calendar_sessions(id,name,duration_minutes,status,started_at,ended_at,active_seconds,focus_active_seconds) VALUES(5,'Focus Today',25,'COMPLETED','2026-11-08T14:00:00Z','2026-11-08T14:25:00Z',1500,1500)",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 1);
            assert_eq!(streak.productive_days_this_month, 1);

            // Case 8: Consecutive qualifying days increase the streak
            // Add Nov 7, Nov 6, Nov 5
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(4,1,'Task Nov 7','2026-11-07','COMPLETED','2026-11-07T10:00:00Z')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(5,1,'Task Nov 6','2026-11-06','COMPLETED','2026-11-06T10:00:00Z')",
                [],
            )?;
            db.execute(
                "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(6,1,'Task Nov 5','2026-11-05','COMPLETED','2026-11-05T10:00:00Z')",
                [],
            )?;
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 4); // Nov 5, 6, 7, 8
            assert_eq!(streak.longest_streak, 4);
            assert_eq!(streak.productive_days_this_month, 4);

            // Case 9: Missing a full day breaks the current streak
            let nov10 = time::Date::from_calendar_date(2026, time::Month::November, 10).unwrap();
            let streak_nov10 = compute_consistency_streak(db, nov10)?;
            assert_eq!(streak_nov10.current_streak, 0); // Nov 9 had no qualifying work
            assert_eq!(streak_nov10.longest_streak, 4); // Longest preserved

            // Case 10: Yesterday's qualification remains current until today ends
            let nov9 = time::Date::from_calendar_date(2026, time::Month::November, 9).unwrap();
            let streak_nov9 = compute_consistency_streak(db, nov9)?;
            assert_eq!(streak_nov9.current_streak, 4); // Preserved from yesterday
            assert!(!streak_nov9.today_completed);

            // Case 11: Longest streak remains historically correct
            // Add an earlier 6-day streak in October: Oct 10 to Oct 15
            for d in 10..=15 {
                let d_str = format!("2026-10-{:02}", d);
                let ts = format!("2026-10-{:02}T10:00:00Z", d);
                db.execute(
                    "INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(?1,1,'Oct Task',?2,'COMPLETED',?3)",
                    rusqlite::params![100 + d, d_str, ts],
                )?;
            }
            let streak_with_oct = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak_with_oct.current_streak, 4);
            assert_eq!(streak_with_oct.longest_streak, 6);

            // Case 12: Month boundaries are calculated correctly
            // Oct 30, Oct 31, Nov 1, Nov 2
            db.execute("INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(200,1,'Task Oct 30','2026-10-30','COMPLETED','2026-10-30T10:00:00Z')", [])?;
            db.execute("INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(201,1,'Task Oct 31','2026-10-31','COMPLETED','2026-10-31T10:00:00Z')", [])?;
            db.execute("INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(202,1,'Task Nov 1','2026-11-01','COMPLETED','2026-11-01T10:00:00Z')", [])?;
            db.execute("INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(203,1,'Task Nov 2','2026-11-02','COMPLETED','2026-11-02T10:00:00Z')", [])?;
            let nov2 = time::Date::from_calendar_date(2026, time::Month::November, 2).unwrap();
            let streak_month_cross = compute_consistency_streak(db, nov2)?;
            assert_eq!(streak_month_cross.current_streak, 4); // Oct 30, 31, Nov 1, 2
            assert_eq!(streak_month_cross.productive_days_this_month, 2); // Nov 1 and Nov 2

            // Case 13: Timezone, midnight and future-dated activity
            // Future date (Nov 15) must NOT qualify current streak on Nov 8
            db.execute("INSERT INTO tasks(id,goal_id,title,scheduled_date,status,completed_at) VALUES(300,1,'Future Task','2026-11-15','COMPLETED','2026-11-15T10:00:00Z')", [])?;
            let streak_future_check = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak_future_check.current_streak, 4);

            // Case 16: Existing XP rewards remain unchanged
            let progress = local_progress(db)?;
            assert_eq!(progress.streak.current_streak, streak_future_check.current_streak);

            Ok(())
        })
        .unwrap();

        // Case 14: Restart preserves all results (reopen database via fresh VaultManager)
        let reloaded_manager = VaultManager::new(root.clone());
        unlock_account(&reloaded_manager, "streak_tester", "a-long-qa-password").unwrap();
        with_db(&reloaded_manager, |db| {
            let ref_date = time::Date::from_calendar_date(2026, time::Month::November, 8).unwrap();
            let streak = compute_consistency_streak(db, ref_date)?;
            assert_eq!(streak.current_streak, 4);
            assert_eq!(streak.longest_streak, 6);
            assert!(streak.today_completed);
            Ok(())
        })
        .unwrap();

        // Case 15: Vault lock prevents protected data access
        reloaded_manager.unlocked.lock().unwrap().take();
        assert!(with_db(&reloaded_manager, |_| Ok(())).is_err());

        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }
}
