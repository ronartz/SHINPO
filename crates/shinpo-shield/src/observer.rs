use sysinfo::{ProcessesToUpdate, System};

pub const APP_CATALOG_VERSION: &str = "guardian-apps-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppCatalogEntry {
    pub process_name: &'static str,
    pub category: &'static str,
    pub rationale: &'static str,
}

const DISTRACTION_APPS: &[AppCatalogEntry] = &[
    AppCatalogEntry {
        process_name: "discord",
        category: "COMMUNICATION",
        rationale: "Game and social chat platform",
    },
    AppCatalogEntry {
        process_name: "steam",
        category: "GAMING",
        rationale: "Game launcher and store",
    },
    AppCatalogEntry {
        process_name: "steamwebhelper",
        category: "GAMING",
        rationale: "Steam game platform component",
    },
    AppCatalogEntry {
        process_name: "epicgameslauncher",
        category: "GAMING",
        rationale: "Game launcher and store",
    },
    AppCatalogEntry {
        process_name: "epicwebhelper",
        category: "GAMING",
        rationale: "Epic Games launcher component",
    },
    AppCatalogEntry {
        process_name: "lutris",
        category: "GAMING",
        rationale: "Game launcher",
    },
    AppCatalogEntry {
        process_name: "heroic",
        category: "GAMING",
        rationale: "Game launcher",
    },
    AppCatalogEntry {
        process_name: "battle.net",
        category: "GAMING",
        rationale: "Game launcher and social platform",
    },
    AppCatalogEntry {
        process_name: "battlenet",
        category: "GAMING",
        rationale: "Game launcher and social platform",
    },
    AppCatalogEntry {
        process_name: "riotclientservices",
        category: "GAMING",
        rationale: "Game launcher component",
    },
    AppCatalogEntry {
        process_name: "leagueclient",
        category: "GAMING",
        rationale: "Game client",
    },
    AppCatalogEntry {
        process_name: "robloxplayerbeta",
        category: "GAMING",
        rationale: "Game client",
    },
    AppCatalogEntry {
        process_name: "minecraft",
        category: "GAMING",
        rationale: "Game client",
    },
    AppCatalogEntry {
        process_name: "twitch",
        category: "ENTERTAINMENT",
        rationale: "Live-streaming platform",
    },
    AppCatalogEntry {
        process_name: "telegram",
        category: "MESSAGING",
        rationale: "Messaging platform",
    },
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservedDistraction {
    pub pid: u32,
    pub process_name: String,
    pub process_started_at: u64,
    pub catalog_version: &'static str,
    pub category: &'static str,
    pub rationale: &'static str,
}

pub fn classify_distraction(process_name: &str) -> Option<&'static AppCatalogEntry> {
    let normalized = process_name.trim().to_ascii_lowercase();
    let normalized = normalized.strip_suffix(".exe").unwrap_or(&normalized);
    DISTRACTION_APPS
        .iter()
        .find(|entry| entry.process_name == normalized)
}

pub fn is_known_distraction(process_name: &str) -> bool {
    classify_distraction(process_name).is_some()
}

pub fn distraction_catalog() -> &'static [AppCatalogEntry] {
    DISTRACTION_APPS
}

pub fn observe_known_distractions() -> Vec<ObservedDistraction> {
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    let own_pid = std::process::id();

    system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let name = process.name().to_string_lossy().into_owned();
            if pid.as_u32() == own_pid {
                return None;
            }
            let classification = classify_distraction(&name)?;
            Some(ObservedDistraction {
                pid: pid.as_u32(),
                process_name: name,
                process_started_at: process.start_time(),
                catalog_version: APP_CATALOG_VERSION,
                category: classification.category,
                rationale: classification.rationale,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{classify_distraction, is_known_distraction, APP_CATALOG_VERSION};

    #[test]
    fn catalog_matches_exact_names_and_never_uses_substrings() {
        assert!(is_known_distraction("Discord"));
        assert!(is_known_distraction("Discord.EXE"));
        assert!(is_known_distraction("steam.exe"));
        assert!(!is_known_distraction("systemsteam"));
        assert!(!is_known_distraction("chrome"));
        assert!(!is_known_distraction(""));
        assert_eq!(APP_CATALOG_VERSION, "guardian-apps-v1");
        let game = classify_distraction("Steam.EXE").unwrap();
        assert_eq!(game.category, "GAMING");
        assert_eq!(game.rationale, "Game launcher and store");
    }
}
