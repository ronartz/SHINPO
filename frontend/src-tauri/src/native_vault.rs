use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use zeroize::{Zeroize, Zeroizing};

const KEY_BYTES: usize = 32;
const SALT_BYTES: usize = 16;
const NONCE_BYTES: usize = 24;
const ARGON_MEMORY_KIB: u32 = 65_536;
const ARGON_ITERATIONS: u32 = 3;
const LATEST_SCHEMA_VERSION: i64 = 2;

#[derive(Serialize, Deserialize)]
struct VaultMetadata {
    username: String,
    password_salt: String,
    password_nonce: String,
    password_wrapped_key: String,
    recovery_salt: String,
    recovery_nonce: String,
    recovery_wrapped_key: String,
}

struct UnlockedVault {
    connection: Connection,
    _database_key: Zeroizing<[u8; KEY_BYTES]>,
}

pub struct VaultManager {
    root: PathBuf,
    unlocked: Mutex<Option<UnlockedVault>>,
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
    pub current_phase: String,
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
        }
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
        fs::canonicalize(&self.root).map_err(|_| "Local vault directory is unavailable".to_string())
    }

    pub fn is_unlocked(&self) -> Result<bool, String> {
        self.unlocked
            .lock()
            .map(|guard| guard.is_some())
            .map_err(|_| "Vault state is unavailable".to_string())
    }

    fn metadata(&self, username: &str) -> Result<VaultMetadata, String> {
        let account_dir = self.account_dir(username)?;
        let path = account_dir.join("vault.json");
        require_regular_file_if_present(&path)?;
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
    validate_password(password)?;
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
            _database_key: database_key,
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
    let username = normalize_username(username)?;
    validate_password(password)?;
    let metadata = state.metadata(&username)?;
    let salt = decode_fixed::<SALT_BYTES>(&metadata.password_salt)?;
    let wrapping_key = derive_key(password.as_bytes(), &salt)?;
    let nonce = decode_hex(&metadata.password_nonce)?;
    let wrapped = decode_hex(&metadata.password_wrapped_key)?;
    let db_key = Zeroizing::new(unwrap_key(
        &wrapping_key,
        &nonce,
        &wrapped,
        username.as_bytes(),
    )?);
    let db_path = state.account_dir(&username)?.join("shinpo.db");
    require_existing_regular_file(&db_path)?;
    let connection = open_encrypted_database(&db_path, &db_key, &username, false)?;
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *unlocked = Some(UnlockedVault {
        connection,
        _database_key: db_key,
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
    let username = normalize_username(username)?;
    validate_password(new_password)?;
    decode_fixed::<KEY_BYTES>(recovery_key)?;
    let mut metadata = state.metadata(&username)?;
    let recovery_salt = decode_fixed::<SALT_BYTES>(&metadata.recovery_salt)?;
    let recovery_nonce = decode_hex(&metadata.recovery_nonce)?;
    let recovery_wrapped = decode_hex(&metadata.recovery_wrapped_key)?;
    let recovery_derived = derive_key(recovery_key.as_bytes(), &recovery_salt)?;
    let db_key = Zeroizing::new(unwrap_key(
        &recovery_derived,
        &recovery_nonce,
        &recovery_wrapped,
        username.as_bytes(),
    )?);
    let db_path = state.account_dir(&username)?.join("shinpo.db");
    require_existing_regular_file(&db_path)?;

    let mut salt = [0u8; SALT_BYTES];
    let nonce = random_nonce()?;
    getrandom::fill(&mut salt).map_err(|_| "Secure random generation failed".to_string())?;
    let wrapping_key = derive_key(new_password.as_bytes(), &salt)?;
    metadata.password_salt = encode_hex(&salt);
    metadata.password_nonce = encode_hex(&nonce);
    metadata.password_wrapped_key = wrap_key(&wrapping_key, &nonce, &db_key, username.as_bytes())?;
    let connection = open_encrypted_database(&db_path, &db_key, &username, false)?;
    write_metadata(&state.account_dir(&username)?.join("vault.json"), &metadata)?;
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *unlocked = Some(UnlockedVault {
        connection,
        _database_key: db_key,
    });
    Ok(())
}

#[tauri::command]
pub fn lock_local_account(state: tauri::State<'_, VaultManager>) -> Result<(), String> {
    crate::halt_shield_for_vault_lock();
    let mut unlocked = state
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *unlocked = None;
    let _ = shinpo_browser_host::clear_session(&shinpo_browser_host::config::HostPaths::default());
    Ok(())
}

#[tauri::command]
pub fn local_vault_status(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalVaultStatus, String> {
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
        db.execute(
            "INSERT INTO goals(title,description,start_date,target_date) VALUES(?1,?2,?3,?4)",
            params![title.trim(), description, start_date, target_date],
        )?;
        goal_by_id(db, db.last_insert_rowid())
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
        let old: String = db
            .query_row("SELECT status FROM goals WHERE id=?1", [goal_id], |row| {
                row.get(0)
            })
            .optional()?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let next = status
            .as_deref()
            .map(str::to_ascii_uppercase)
            .unwrap_or(old.clone());
        db.execute("UPDATE goals SET title=?1,description=?2,start_date=?3,target_date=?4,status=?5 WHERE id=?6", params![title.trim(),description,start_date,target_date,next,goal_id])?;
        if old != "COMPLETED" && next == "COMPLETED" {
            insert_xp_event(db, &format!("goal:{goal_id}"), "GOAL_COMPLETED", 50, None)?;
        }
        goal_by_id(db, goal_id)
    })
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
        db.execute("INSERT INTO tasks(goal_id,title,description,scheduled_date,estimated_minutes) SELECT id,?2,?3,?4,?5 FROM goals WHERE id=?1", params![goal_id,title.trim(),description,scheduled_date,estimated_minutes])?;
        if db.changes() == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        task_by_id(db, db.last_insert_rowid())
    })
}

#[tauri::command]
pub fn local_update_task(
    state: tauri::State<'_, VaultManager>,
    task_id: i64,
    goal_id: i64,
    title: String,
    description: Option<String>,
    scheduled_date: String,
    estimated_minutes: Option<i64>,
    status: Option<String>,
) -> Result<LocalTask, String> {
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
    let goal_id: i64 = tx.query_row(
        "SELECT goal_id FROM tasks WHERE id=?1 AND status<>'COMPLETED'",
        [task_id],
        |row| row.get(0),
    )?;
    tx.execute("UPDATE tasks SET status='COMPLETED',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1", [task_id])?;
    let completed_at: String = tx.query_row(
        "SELECT completed_at FROM tasks WHERE id=?1",
        [task_id],
        |row| row.get(0),
    )?;
    let event_id = insert_xp_event(
        &tx,
        &format!("task:{task_id}"),
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
            insert_xp_event(&tx, &format!("goal:{goal_id}"), "GOAL_COMPLETED", 50, None)?;
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
pub fn local_claim_onboarding_reward(
    state: tauri::State<'_, VaultManager>,
) -> Result<LocalProgress, String> {
    with_db(&state, |db| {
        insert_xp_event(
            db,
            "onboarding:first-completion",
            "ONBOARDING_COMPLETED",
            50,
            None,
        )?;
        local_progress(db)
    })
}

#[tauri::command]
pub fn local_create_focus_session(
    state: tauri::State<'_, VaultManager>,
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
) -> Result<LocalFocusSession, String> {
    validate_title(&name)?;
    validate_optional_text(intention.as_deref(), 4000)?;
    if !(1..=1440).contains(&duration_minutes) {
        return Err("Duration must be between 1 and 1440 minutes".into());
    }
    validate_optional_text(scheduled_at.as_deref(), 64)?;
    let cycles = pomodoro_focus_cycles.unwrap_or(4);
    let short_break = pomodoro_short_break_minutes.unwrap_or(5);
    let long_break = pomodoro_long_break_minutes.unwrap_or(15);
    let grace = pomodoro_grace_minutes.unwrap_or(10);
    if !(1..=12).contains(&cycles)
        || !(1..=60).contains(&short_break)
        || !(1..=120).contains(&long_break)
        || !(1..=60).contains(&grace)
    {
        return Err("Pomodoro settings are outside the supported ranges".into());
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
        db.execute("INSERT INTO calendar_sessions(goal_id,task_id,name,intention,duration_minutes,scheduled_at,status,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,pomodoro_grace_minutes,current_phase) VALUES(?1,?2,?3,?4,?5,?6,'SCHEDULED',?7,?8,?9,?10,?11,'FOCUS')", params![goal_id,mission_id,name.trim(),intention,duration_minutes,scheduled_at,pomodoro_enabled.unwrap_or(false),cycles,short_break,long_break,grace])?;
        focus_session_by_id(db, db.last_insert_rowid())
    })
}

#[tauri::command]
pub fn local_get_focus_sessions(
    state: tauri::State<'_, VaultManager>,
) -> Result<Vec<LocalFocusSession>, String> {
    with_db(&state, |db| {
        let mut query=db.prepare("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment FROM calendar_sessions ORDER BY COALESCE(scheduled_at,created_at),id")?;
        let rows = query.query_map([], focus_session_from_row)?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_get_focus_sessions_by_date(
    state: tauri::State<'_, VaultManager>,
    date: String,
) -> Result<Vec<LocalFocusSession>, String> {
    validate_date(&date)?;
    with_db(&state, |db| {
        let mut query=db.prepare("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment FROM calendar_sessions WHERE substr(COALESCE(scheduled_at,started_at,created_at),1,10)=?1 ORDER BY COALESCE(scheduled_at,created_at),id")?;
        let rows = query.query_map([date], focus_session_from_row)?;
        rows.collect()
    })
}

#[tauri::command]
pub fn local_update_focus_session(
    state: tauri::State<'_, VaultManager>,
    session_id: i64,
    goal_id: Option<i64>,
    mission_id: Option<i64>,
    name: String,
    intention: Option<String>,
    duration_minutes: i64,
    scheduled_at: Option<String>,
) -> Result<LocalFocusSession, String> {
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
    with_db(&state, |db| start_focus_session(db, session_id))
}

fn start_focus_session(db: &Connection, session_id: i64) -> rusqlite::Result<LocalFocusSession> {
    let changed = db.execute(
        "UPDATE calendar_sessions SET status='ACTIVE',started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),phase_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status='SCHEDULED' AND NOT EXISTS(SELECT 1 FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED'))",
        [session_id],
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
    with_db(&state, |db| pause_focus_session(db, session_id))
}

fn pause_focus_session(db: &Connection, session_id: i64) -> rusqlite::Result<LocalFocusSession> {
    let changed = db.execute(
        "UPDATE calendar_sessions SET active_seconds=min(duration_minutes*60,max(0,unixepoch('now')-unixepoch(started_at)-accumulated_paused_seconds)),focus_active_seconds=CASE WHEN pomodoro_enabled=0 THEN min(duration_minutes*60,max(0,unixepoch('now')-unixepoch(started_at)-accumulated_paused_seconds)) ELSE focus_active_seconds END,phase_elapsed_seconds=phase_elapsed_seconds+max(0,unixepoch('now')-unixepoch(phase_started_at)),phase_started_at=NULL,paused_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),status='PAUSED',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status='ACTIVE'",
        [session_id],
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
    with_db(&state, |db| resume_focus_session(db, session_id))
}

fn resume_focus_session(db: &Connection, session_id: i64) -> rusqlite::Result<LocalFocusSession> {
    let changed = db.execute(
        "UPDATE calendar_sessions SET accumulated_paused_seconds=accumulated_paused_seconds+max(0,unixepoch('now')-unixepoch(paused_at)),paused_at=NULL,phase_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),status='ACTIVE',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status='PAUSED' AND NOT EXISTS(SELECT 1 FROM calendar_sessions WHERE status IN ('ACTIVE','PAUSED') AND id<>?1)",
        [session_id],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    focus_session_by_id(db, session_id)
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
    with_db(&state, |db| {
        complete_focus_session(
            db,
            session_id,
            quality,
            reflection_note,
            accomplishment,
            mark_mission_completed.unwrap_or(false),
        )
    })
}

fn complete_focus_session(
    db: &mut Connection,
    session_id: i64,
    quality: Option<i64>,
    reflection_note: Option<String>,
    accomplishment: Option<String>,
    mark_mission_completed: bool,
) -> rusqlite::Result<LocalFocusSession> {
    let tx = db.transaction()?;
    let changed=tx.execute("UPDATE calendar_sessions SET active_seconds=min(duration_minutes*60,CASE WHEN status='ACTIVE' THEN max(0,unixepoch('now')-unixepoch(started_at)-accumulated_paused_seconds) ELSE active_seconds END),focus_active_seconds=CASE WHEN pomodoro_enabled=0 THEN min(duration_minutes*60,CASE WHEN status='ACTIVE' THEN max(0,unixepoch('now')-unixepoch(started_at)-accumulated_paused_seconds) ELSE active_seconds END) ELSE focus_active_seconds END,phase_elapsed_seconds=phase_elapsed_seconds+CASE WHEN status='ACTIVE' THEN max(0,unixepoch('now')-unixepoch(phase_started_at)) ELSE 0 END,status='COMPLETED',ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),phase_started_at=NULL,paused_at=NULL,completion_quality=?2,reflection_note=?3,accomplishment=?4,current_phase='COMPLETE',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status IN ('ACTIVE','PAUSED') AND current_phase<>'RETURN_REQUIRED'",params![session_id,quality,reflection_note,accomplishment])?;
    if changed == 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let active_seconds:i64=tx.query_row("SELECT CASE WHEN pomodoro_enabled=1 THEN focus_active_seconds+phase_elapsed_seconds ELSE active_seconds END FROM calendar_sessions WHERE id=?1",[session_id],|r|r.get(0))?;
    let linked_task: Option<i64> = tx.query_row(
        "SELECT task_id FROM calendar_sessions WHERE id=?1",
        [session_id],
        |r| r.get(0),
    )?;
    let minutes = active_seconds / 60;
    if minutes >= 15 {
        insert_xp_event(
            &tx,
            &format!("focus:{session_id}"),
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
    with_db(&state, |db| {
        let changed=db.execute("UPDATE calendar_sessions SET status='CANCELLED',ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1 AND status IN ('SCHEDULED','ACTIVE','PAUSED')",[session_id])?;
        if changed == 0 {
            return Err(rusqlite::Error::InvalidQuery);
        }
        focus_session_by_id(db, session_id)
    })
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
    mission_id: Option<i64>,
    focus_session_id: Option<i64>,
    resource_type: String,
    match_type: String,
    disposition: String,
    break_only: bool,
    destination: String,
    display_name: Option<String>,
    expires_at: Option<String>,
) -> Result<LocalStudyResource, String> {
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
    let snapshot = with_db(&state, build_local_browser_policy)?;
    let paths = shinpo_browser_host::config::HostPaths::default();
    shinpo_browser_host::initialize_installation(&paths)
        .map_err(|_| "Browser Companion host is not initialized".to_string())?;
    shinpo_browser_host::publish_policy(&paths, snapshot.clone())
        .map_err(|_| "Could not publish local Focus policy".to_string())?;
    Ok(snapshot)
}

fn build_local_browser_policy(db: &mut Connection) -> rusqlite::Result<serde_json::Value> {
    let revision: i64 = db.query_row("UPDATE browser_companion_meta SET policy_revision=policy_revision+1 WHERE id=1 RETURNING policy_revision", [], |row| row.get(0))?;
    let mode: String = db.query_row(
        "SELECT focus_mode FROM browser_companion_meta WHERE id=1",
        [],
        |row| row.get(0),
    )?;
    let session = db.query_row("SELECT s.id,s.name,s.task_id,s.current_phase,s.status,t.title FROM calendar_sessions s LEFT JOIN tasks t ON t.id=s.task_id WHERE s.status IN ('ACTIVE','PAUSED') ORDER BY s.id DESC LIMIT 1", [], |row| Ok((row.get::<_, i64>(0)?,row.get::<_, String>(1)?,row.get::<_, Option<i64>>(2)?,row.get::<_, String>(3)?,row.get::<_, String>(4)?,row.get::<_, Option<String>>(5)?))).optional()?;
    let Some((id, name, task_id, phase, status, task_title)) = session else {
        return Ok(
            serde_json::json!({ "status":"INACTIVE", "policyVersion":revision, "resources":[] }),
        );
    };
    if status != "ACTIVE" || phase != "FOCUS" {
        return Ok(
            serde_json::json!({ "status":"INACTIVE", "sessionId":id, "currentPhase":phase, "policyVersion":revision, "resources":[] }),
        );
    }
    let mut statement = db.prepare("SELECT id,resource_type,match_type,disposition,break_only,destination,expires_at FROM browser_resources WHERE focus_session_id=?1 OR (focus_session_id IS NULL AND (mission_id IS NULL OR mission_id=?2)) ORDER BY id")?;
    let resources = statement.query_map(params![id,task_id], |row| Ok(serde_json::json!({
            "id":row.get::<_,i64>(0)?, "resourceType":row.get::<_,String>(1)?, "matchType":row.get::<_,String>(2)?,
            "disposition":row.get::<_,String>(3)?, "breakOnly":row.get::<_,i64>(4)? != 0,
            "destination":row.get::<_,String>(5)?, "canonicalDestination":row.get::<_,String>(5)?, "expiresAt":row.get::<_,Option<String>>(6)?
        })))?.collect::<Result<Vec<_>,_>>()?;
    Ok(
        serde_json::json!({ "status":"ACTIVE", "sessionId":id, "taskId":task_id, "taskTitle":task_title.unwrap_or(name), "mode":mode, "currentPhase":"FOCUS", "allowTemporaryExceptions":false, "policyVersion":revision, "issuedAt":(OffsetDateTime::now_utc().unix_timestamp_nanos()/1_000_000) as u64, "resources":resources, "adapterSettings":{} }),
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
            "UPDATE browser_companion_meta SET focus_mode=?1 WHERE id=1",
            [mode],
        )?;
        Ok(())
    })
}

fn focus_session_by_id(db: &Connection, id: i64) -> rusqlite::Result<LocalFocusSession> {
    db.query_row("SELECT id,goal_id,task_id,name,intention,duration_minutes,pomodoro_enabled,pomodoro_focus_cycles,pomodoro_short_break_minutes,pomodoro_long_break_minutes,completed_focus_cycles,pomodoro_grace_minutes,current_phase,focus_active_seconds,break_active_seconds,status,scheduled_at,started_at,paused_at,accumulated_paused_seconds,active_seconds,ended_at,created_at,updated_at,completion_quality,reflection_note,accomplishment FROM calendar_sessions WHERE id=?1",[id],focus_session_from_row)
}

fn focus_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalFocusSession> {
    let status: String = row.get(15)?;
    let duration: i64 = row.get(5)?;
    let active: i64 = row.get(20)?;
    let started: Option<String> = row.get(17)?;
    let accumulated: i64 = row.get(19)?;
    let current_active = (if status == "ACTIVE" {
        started
            .as_deref()
            .map(|s| elapsed_sql_seconds(s, accumulated))
            .unwrap_or(active)
    } else {
        active
    })
    .min(duration * 60);
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
        pomodoro_enabled: row.get::<_, bool>(6)?,
        pomodoro_focus_cycles: row.get(7)?,
        pomodoro_short_break_minutes: row.get(8)?,
        pomodoro_long_break_minutes: row.get(9)?,
        completed_focus_cycles: row.get(10)?,
        pomodoro_grace_minutes: row.get(11)?,
        current_phase: row.get(12)?,
        focus_active_seconds: row.get(13)?,
        break_active_seconds: row.get(14)?,
        status,
        scheduled_at: row.get(16)?,
        started_at: started,
        paused_at: row.get(18)?,
        accumulated_paused_seconds: accumulated,
        active_seconds: current_active,
        remaining_seconds: (duration * 60 - current_active).max(0),
        server_time,
        ended_at: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
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

fn local_progress(db: &Connection) -> rusqlite::Result<LocalProgress> {
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
    })
}

fn with_db<T>(
    manager: &VaultManager,
    operation: impl FnOnce(&mut Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let mut guard = manager
        .unlocked
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let vault = guard
        .as_mut()
        .ok_or_else(|| "Unlock the local vault first".to_string())?;
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
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
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
    if version < 0 || version > LATEST_SCHEMA_VERSION {
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
        ("pomodoro_focus_cycles", "INTEGER NOT NULL DEFAULT 4"),
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

fn validate_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 12
        || password.len() > 1024
        || password.chars().any(char::is_control)
    {
        return Err(
            "Password must contain 12–1024 characters and no control characters".to_string(),
        );
    }
    Ok(())
}

fn write_metadata(path: &Path, metadata: &VaultMetadata) -> Result<(), String> {
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(metadata)
        .map_err(|_| "Could not encode local account metadata".to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Could not create local account metadata".to_string())?;
    set_private_file_permissions(&file)?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Could not persist local account metadata".to_string())?;
    replace_metadata(&temporary, path)
        .map_err(|_| "Could not finalize local account metadata".to_string())
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
    if value.len() % 2 != 0 {
        return Err("Invalid encoded vault metadata".to_string());
    }
    value
        .as_bytes()
        .chunks_exact(2)
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
                1,
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
        assert_eq!(progress, 15);
        drop(reopened);
        assert!(Connection::open(&path)
            .unwrap()
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row
                .get::<_, i64>(0))
            .is_err());
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
        assert!(unlock_account(&manager, "qa_user", "wrong-password").is_err());
        assert!(recover_account(
            &manager,
            "qa_user",
            "wrong-recovery-key",
            "another-long-password"
        )
        .is_err());
        recover_account(
            &manager,
            "qa_user",
            &account.recovery_key,
            "another-long-password",
        )
        .unwrap();
        assert!(unlock_account(&manager, "qa_user", "a-long-qa-password").is_err());
        unlock_account(&manager, "qa_user", "another-long-password").unwrap();
        drop(manager);

        let restarted = VaultManager::new(root.clone());
        unlock_account(&restarted, "qa_user", "another-long-password").unwrap();
        drop(restarted);

        let plain = Connection::open(&db_path).unwrap();
        assert!(plain
            .query_row("SELECT count(*) FROM sqlite_master", [], |row| row
                .get::<_, i64>(0))
            .is_err());
        drop(plain);
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
    fn focus_pause_resume_does_not_double_count_earlier_active_intervals() {
        let root = scratch_path();
        let manager = VaultManager::new(root.clone());
        create_account(&manager, "focus_user", "a-long-qa-password").unwrap();
        let session_id = with_db(&manager, |db| {
            db.execute(
                "INSERT INTO calendar_sessions(name,duration_minutes,status,started_at,accumulated_paused_seconds,phase_started_at) VALUES('Focus',60,'ACTIVE',strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 minutes'),600,strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes'))",
                [],
            )?;
            Ok(db.last_insert_rowid())
        })
        .unwrap();

        let paused = {
            let mut state = manager.unlocked.lock().unwrap();
            pause_focus_session(&state.as_mut().unwrap().connection, session_id).unwrap()
        };
        assert_eq!(paused.active_seconds, 600);

        let resumed = with_db(&manager, |db| {
            db.execute("UPDATE calendar_sessions SET paused_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes') WHERE id=?1", [session_id])?;
            resume_focus_session(db, session_id)
        })
        .unwrap();
        assert_eq!(resumed.accumulated_paused_seconds, 900);

        let paused_again = with_db(&manager, |db| {
            db.execute("UPDATE calendar_sessions SET started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-25 minutes') WHERE id=?1", [session_id])?;
            pause_focus_session(db, session_id)
        })
        .unwrap();
        assert_eq!(paused_again.active_seconds, 600);
        drop(manager);
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
            db, session_id, None, None, None, false
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

        with_db(&manager, |db| start_focus_session(db, first)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second)).is_err());
        with_db(&manager, |db| pause_focus_session(db, first)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second)).is_err());
        with_db(&manager, |db| resume_focus_session(db, first)).unwrap();
        assert!(with_db(&manager, |db| start_focus_session(db, second)).is_err());
        with_db(&manager, |db| {
            complete_focus_session(db, first, None, None, None, false)
        })
        .unwrap();
        assert_eq!(
            with_db(&manager, |db| start_focus_session(db, second))
                .unwrap()
                .status,
            "ACTIVE"
        );
        drop(manager);
        fs::remove_dir_all(root).unwrap();
    }
}
