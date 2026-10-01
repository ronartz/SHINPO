use std::env;
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShieldConfig {
    #[serde(default = "default_api_url")]
    pub api_url: String,

    #[serde(default = "default_poll_seconds")]
    pub poll_interval_seconds: u64,

    #[serde(default = "default_blacklist")]
    pub fallback_blacklist: Vec<String>,

    #[serde(default)]
    pub auth_token: Option<String>,

    #[serde(default = "default_true")]
    pub auto_kill: bool,

    #[serde(default = "default_true")]
    pub notify_desktop: bool,
}

fn default_api_url() -> String {
    "http://localhost:8080".to_string()
}

fn default_poll_seconds() -> u64 {
    2
}

fn default_true() -> bool {
    true
}

fn default_blacklist() -> Vec<String> {
    vec![
        "discord".to_string(),
        "steam".to_string(),
        "spotify".to_string(),
        "telegram-desktop".to_string(),
        "vlc".to_string(),
        "obs".to_string(),
        "epicgameslauncher".to_string(),
        "riotclientux".to_string(),
        "battlenet".to_string(),
    ]
}

impl Default for ShieldConfig {
    fn default() -> Self {
        Self {
            api_url: default_api_url(),
            auth_token: None,
            poll_interval_seconds: default_poll_seconds(),
            fallback_blacklist: default_blacklist(),
            auto_kill: true,
            notify_desktop: true,
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ShieldCommand {
    Run,
    Status,
    Sweep,
}

#[derive(Debug)]
pub struct CliOptions {
    pub command: ShieldCommand,
    pub dry_run: bool,
    pub custom_url: Option<String>,
    pub custom_token: Option<String>,
    pub custom_interval: Option<u64>,
}

impl CliOptions {
    pub fn parse() -> Self {
        let args: Vec<String> = env::args().collect();
        let mut command = ShieldCommand::Run;
        let mut dry_run = false;
        let mut custom_url = None;
        let mut custom_token = None;
        let mut custom_interval = None;

        let mut i = 1;
        while i < args.len() {
            match args[i].as_str() {
                "status" => command = ShieldCommand::Status,
                "sweep" => command = ShieldCommand::Sweep,
                "run" | "--daemon" => command = ShieldCommand::Run,
                "--dry-run" | "-d" => dry_run = true,
                "--url" if i + 1 < args.len() => {
                    i += 1;
                    custom_url = Some(args[i].clone());
                }
                "--token" if i + 1 < args.len() => {
                    i += 1;
                    custom_token = Some(args[i].clone());
                }
                "--interval" if i + 1 < args.len() => {
                    i += 1;
                    custom_interval = args[i].parse::<u64>().ok();
                }
                "--help" | "-h" => {
                    print_help();
                    std::process::exit(0);
                }
                _ => {}
            }
            i += 1;
        }

        Self {
            command,
            dry_run,
            custom_url,
            custom_token,
            custom_interval,
        }
    }
}

fn print_help() {
    println!(r#"
進歩 (SHINPO) NATIVE FOCUS ENFORCEMENT SHIELD DAEMON

USAGE:
    shinpo-shield [COMMAND] [OPTIONS]

COMMANDS:
    run            Start the persistent enforcement loop (default)
    status         Query Sentinel API, check active sprint, and display policy rules
    sweep          Perform a single one-shot scan and quarantine, then exit

OPTIONS:
    -d, --dry-run          Audit-only mode (logs matches but does not terminate processes)
    --url <URL>            Spring Boot base URL (default: http://localhost:8080)
    --token <JWT>          Bearer token for authenticated API requests
    --interval <SECONDS>   Polling interval in seconds (default: 2)
    -h, --help             Print help information
"#);
}

pub fn load_config(opts: &CliOptions) -> ShieldConfig {
    let candidates = [
        "daemon/shield_config.json",
        "shield_config.json",
        "../daemon/shield_config.json",
        "/etc/shinpo/shield_config.json",
    ];

    let mut cfg = ShieldConfig::default();

    for candidate in &candidates {
        if Path::new(candidate).exists() {
            if let Ok(content) = fs::read_to_string(candidate) {
                if let Ok(loaded) = serde_json::from_str::<ShieldConfig>(&content) {
                    cfg = loaded;
                    break;
                }
            }
        }
    }

    // CLI overrides
    if let Some(url) = &opts.custom_url {
        cfg.api_url = url.clone();
    }
    if let Some(token) = &opts.custom_token {
        cfg.auth_token = Some(token.clone());
    } else if let Ok(env_token) = env::var("SHINPO_AUTH_TOKEN") {
        if !env_token.trim().is_empty() {
            cfg.auth_token = Some(env_token);
        }
    }
    if let Some(interval) = opts.custom_interval {
        cfg.poll_interval_seconds = interval;
    }

    // Normalize api_url: strip trailing slash and subpaths like /api/focus-sessions
    if cfg.api_url.contains("/api") {
        if let Some(idx) = cfg.api_url.find("/api") {
            cfg.api_url = cfg.api_url[..idx].trim_end_matches('/').to_string();
        }
    }
    cfg.api_url = cfg.api_url.trim_end_matches('/').to_string();

    cfg
}
