use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{Disks, Networks, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreTelemetry {
    pub name: String,
    pub usage_percent: f32,
    pub frequency_mhz: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskTelemetry {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkTelemetry {
    pub interface_name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemTelemetry {
    pub device_name: String,
    pub os_name: String,
    pub os_version: String,
    pub os_arch: String,
    pub available_processors: usize,
    pub cpu_usage_percent: f32,
    pub cores: Vec<CoreTelemetry>,
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub free_memory_bytes: u64,
    pub available_memory_bytes: u64,
    pub total_swap_bytes: u64,
    pub used_swap_bytes: u64,
    pub free_swap_bytes: u64,
    pub disks: Vec<DiskTelemetry>,
    pub networks: Vec<NetworkTelemetry>,
    pub process_count: usize,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDeviceSystemInfo {
    pub device_name: String,
    pub os_name: String,
    pub os_version: String,
    pub os_arch: String,
    pub available_processors: usize,
    pub system_cpu_load: Option<f32>,
    pub total_memory_bytes: u64,
    pub free_memory_bytes: u64,
    pub process_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProcessInfo {
    pub pid: u32,
    pub name: String,
    pub executable_path: String,
    pub cpu_percent: Option<f32>,
    pub memory_bytes: Option<u64>,
    pub status: String,
    pub started_at: Option<String>,
    pub user: String,
    pub shinpo_policy_state: String,
    pub policy_reason: String,
    pub can_control: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProcessSnapshot {
    pub system_info: LocalDeviceSystemInfo,
    pub processes: Vec<LocalProcessInfo>,
    pub telemetry: SystemTelemetry,
    pub timestamp: String,
}

static SYSTEM_INSTANCE: Mutex<Option<System>> = Mutex::new(None);

fn now_iso() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

#[tauri::command]
pub fn local_get_system_telemetry() -> Result<SystemTelemetry, String> {
    let mut guard = SYSTEM_INSTANCE
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    let sys = guard.get_or_insert_with(|| {
        let mut s = System::new_all();
        s.refresh_all();
        s
    });
    sys.refresh_all();

    let cpu_usage_percent = sys.global_cpu_usage();
    let cores = sys
        .cpus()
        .iter()
        .map(|c| CoreTelemetry {
            name: c.name().to_string(),
            usage_percent: c.cpu_usage(),
            frequency_mhz: c.frequency(),
        })
        .collect();

    let disks_info = Disks::new_with_refreshed_list();
    let disks = disks_info
        .iter()
        .map(|d| DiskTelemetry {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_bytes: d.total_space(),
            available_bytes: d.available_space(),
            file_system: d.file_system().to_string_lossy().to_string(),
        })
        .collect();

    let networks_info = Networks::new_with_refreshed_list();
    let networks = networks_info
        .iter()
        .map(|(name, net)| NetworkTelemetry {
            interface_name: name.clone(),
            rx_bytes: net.total_received(),
            tx_bytes: net.total_transmitted(),
        })
        .collect();

    Ok(SystemTelemetry {
        device_name: System::host_name().unwrap_or_else(|| "Local Machine".to_string()),
        os_name: System::name().unwrap_or_else(|| "Linux".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        os_arch: System::cpu_arch(),
        available_processors: sys.cpus().len(),
        cpu_usage_percent,
        cores,
        total_memory_bytes: sys.total_memory(),
        used_memory_bytes: sys.used_memory(),
        free_memory_bytes: sys.free_memory(),
        available_memory_bytes: sys.available_memory(),
        total_swap_bytes: sys.total_swap(),
        used_swap_bytes: sys.used_swap(),
        free_swap_bytes: sys.free_swap(),
        disks,
        networks,
        process_count: sys.processes().len(),
        timestamp: now_iso(),
    })
}

#[tauri::command]
pub fn local_get_process_snapshot(
    search: Option<String>,
    policy: Option<String>,
) -> Result<LocalProcessSnapshot, String> {
    let telemetry = local_get_system_telemetry()?;

    let mut guard = SYSTEM_INSTANCE
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    let sys = guard.as_mut().ok_or("System not initialized")?;

    let search_lower = search
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());
    let policy_filter = policy
        .map(|p| p.trim().to_uppercase())
        .filter(|p| !p.is_empty());

    let mut processes: Vec<LocalProcessInfo> = sys
        .processes()
        .iter()
        .filter_map(|(pid, p)| {
            let name = p.name().to_string_lossy().to_string();
            let exe = p
                .exe()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default();

            if let Some(ref q) = search_lower {
                if !name.to_lowercase().contains(q) && !exe.to_lowercase().contains(q) {
                    return None;
                }
            }

            // Safe classifications: system vs user processes
            let pid_u32 = pid.as_u32();
            let is_protected_os =
                pid_u32 <= 100 || name == "systemd" || name == "init" || name == "kthreadd";
            let state = if is_protected_os {
                "PROTECTED".to_string()
            } else {
                "ALLOWED".to_string()
            };

            if let Some(ref pol) = policy_filter {
                if pol != "ALL" && state != *pol {
                    return None;
                }
            }

            let status_str = format!("{:?}", p.status());

            Some(LocalProcessInfo {
                pid: pid_u32,
                name,
                executable_path: exe,
                cpu_percent: Some(p.cpu_usage()),
                memory_bytes: Some(p.memory()),
                status: status_str,
                started_at: Some(format!("{}", p.start_time())),
                user: p
                    .user_id()
                    .map(|u| format!("{:?}", u))
                    .unwrap_or_else(|| "user".to_string()),
                shinpo_policy_state: state.clone(),
                policy_reason: if is_protected_os {
                    "Protected OS daemon".to_string()
                } else {
                    "Standard application process".to_string()
                },
                can_control: !is_protected_os,
            })
        })
        .collect();

    // Sort by CPU percent descending, then memory descending
    processes.sort_by(|a, b| {
        let cpu_b = b.cpu_percent.unwrap_or(0.0);
        let cpu_a = a.cpu_percent.unwrap_or(0.0);
        cpu_b
            .partial_cmp(&cpu_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let system_info = LocalDeviceSystemInfo {
        device_name: telemetry.device_name.clone(),
        os_name: telemetry.os_name.clone(),
        os_version: telemetry.os_version.clone(),
        os_arch: telemetry.os_arch.clone(),
        available_processors: telemetry.available_processors,
        system_cpu_load: Some(telemetry.cpu_usage_percent),
        total_memory_bytes: telemetry.total_memory_bytes,
        free_memory_bytes: telemetry.free_memory_bytes,
        process_count: Some(telemetry.process_count),
    };

    Ok(LocalProcessSnapshot {
        system_info,
        processes,
        telemetry,
        timestamp: now_iso(),
    })
}
