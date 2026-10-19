use serde_json::json;
use shinpo_browser_host::config::{HostConfig, HostPaths};
use shinpo_browser_host::policy::PolicyStore;
use shinpo_browser_host::{
    clear_credentials, clear_session, configure_backend, disconnect_installation,
    initialize_installation, now_ms, publish_policy, read_credentials_from, read_json_file,
    read_json_from, rotate_pairing, run_native_loop, write_status_json, HostError,
};
use std::env;
use std::io;
use std::path::PathBuf;
use std::process::ExitCode;

fn run() -> Result<(), HostError> {
    let args: Vec<String> = env::args().collect();
    let paths = HostPaths::default();

    if args.len() <= 1 {
        return run_native_loop(paths, &mut io::stdin(), &mut io::stdout());
    }

    match args[1].as_str() {
        "init" => {
            let init_res = initialize_installation(&paths)?;
            write_status_json(&mut io::stdout(), &init_res)
        }
        "rotate-pairing" => {
            let new_code = rotate_pairing(&paths)?;
            println!("{}", new_code);
            Ok(())
        }
        "configure-backend" => {
            let update = if args.len() > 2 {
                let mut slice = io::Cursor::new(args[2].as_bytes());
                read_credentials_from(&mut slice)?
            } else {
                read_credentials_from(&mut io::stdin())?
            };
            configure_backend(&paths, update)
        }
        "publish-policy" => {
            let snapshot = if args.len() > 2 {
                read_json_file(&PathBuf::from(&args[2]))?
            } else {
                read_json_from(&mut io::stdin())?
            };
            let stored = publish_policy(&paths, snapshot)?;
            write_status_json(&mut io::stdout(), &stored)
        }
        "clear" | "clear-session" => clear_session(&paths),
        "clear-credentials" => clear_credentials(&paths),
        "disconnect" => disconnect_installation(&paths),
        "status" => {
            let config = HostConfig::load(&paths)?;
            let store = PolicyStore::new(paths.clone());
            let policy = store.load_valid(now_ms())?;
            let status_val = json!({
                "installationId": config.installation_id,
                "backendConfigured": config.backend.is_some(),
                "maxLeaseSeconds": config.max_lease_seconds,
                "reviewUrl": config.review_url,
                "policy": policy,
            });
            write_status_json(&mut io::stdout(), &status_val)
        }
        arg if arg.starts_with("chrome-extension://")
            || arg.starts_with("moz-extension://")
            || arg.ends_with(".json")
            || arg == "--native" =>
        {
            run_native_loop(paths, &mut io::stdin(), &mut io::stdout())
        }
        unknown => {
            eprintln!("Unknown subcommand: {unknown}");
            eprintln!("Usage: shinpo-browser-host [init|rotate-pairing|configure-backend|publish-policy|clear|clear-credentials|disconnect|status]");
            Err(HostError::InvalidRequest(format!("Unknown subcommand: {unknown}")))
        }
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("Host error [{}]: {}", err.code(), err);
            ExitCode::FAILURE
        }
    }
}

