// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args().skip(1);
    match (args.next().as_deref(), args.next()) {
        (Some("--smoke-test"), None) => {
            if let Err(error) = shinpo_desktop_lib::smoke_test() {
                eprintln!("FAIL: SHINPO native smoke test: {error}");
                std::process::exit(1);
            }
            return;
        }
        (Some("--smoke-test"), Some(_)) => {
            eprintln!("Usage: shinpo-desktop --smoke-test");
            std::process::exit(2);
        }
        _ => {}
    }
    shinpo_desktop_lib::run();
}
