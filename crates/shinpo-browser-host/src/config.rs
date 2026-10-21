use std::fs::{self, File, Permissions};
use std::io::Write;
use std::path::{Path, PathBuf};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use crate::{CredentialUpdate, HostError};

#[derive(Clone, Debug)]
pub struct HostPaths {
    pub config: PathBuf,
    pub policy: PathBuf,
    pub state_dir: PathBuf,
}

impl Default for HostPaths {
    fn default() -> Self {
        #[cfg(windows)]
        let (config_dir, state_dir) = {
            let app_data = std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
            let base = app_data.join("shinpo");
            (base.clone(), base)
        };

        #[cfg(not(windows))]
        let (config_dir, state_dir) = {
            let home = std::env::var_os("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("/tmp"));
            let config_base = std::env::var_os("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".config"));
            let state_base = std::env::var_os("XDG_STATE_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".local").join("state"));
            (config_base.join("shinpo"), state_base.join("shinpo"))
        };

        Self {
            config: config_dir.join("browser_host.json"),
            policy: state_dir.join("browser_policy.json"),
            state_dir,
        }
    }
}

impl HostPaths {
    pub fn secure_directories(&self) -> Result<(), HostError> {
        if let Some(parent) = self.config.parent() {
            fs::create_dir_all(parent)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(parent, Permissions::from_mode(0o700))?;
            }
        }
        if let Some(parent) = self.policy.parent() {
            fs::create_dir_all(parent)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(parent, Permissions::from_mode(0o700))?;
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConfig {
    pub base_url: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub access_token_expires_at_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostConfig {
    pub installation_id: String,
    pub pairing_secret_hash: String,
    pub max_lease_seconds: u64,
    #[serde(default)]
    pub review_url: Option<String>,
    #[serde(default)]
    pub backend: Option<BackendConfig>,
}

impl HostConfig {
    pub fn new_installation() -> (Self, String) {
        let mut rng = rand::thread_rng();
        let mut raw_bytes = [0u8; 32];
        rng.fill_bytes(&mut raw_bytes);
        let raw_token = hex::encode(raw_bytes);
        let hash = hash_token(&raw_token);

        let installation_id = {
            let mut id_bytes = [0u8; 16];
            rng.fill_bytes(&mut id_bytes);
            hex::encode(id_bytes)
        };

        let config = Self {
            installation_id,
            pairing_secret_hash: hash,
            max_lease_seconds: 60,
            review_url: Some("http://localhost:5173".to_string()),
            backend: None,
        };
        (config, raw_token)
    }

    pub fn rotate_pairing(&mut self) -> String {
        let mut rng = rand::thread_rng();
        let mut raw_bytes = [0u8; 32];
        rng.fill_bytes(&mut raw_bytes);
        let raw_token = hex::encode(raw_bytes);
        self.pairing_secret_hash = hash_token(&raw_token);
        raw_token
    }

    pub fn verify_pairing(&self, candidate: &str) -> bool {
        let candidate_hash = hash_token(candidate);
        let expected = self.pairing_secret_hash.as_bytes();
        let actual = candidate_hash.as_bytes();
        if expected.len() != actual.len() {
            return false;
        }
        expected.ct_eq(actual).into()
    }

    pub fn set_backend(&mut self, update: CredentialUpdate) -> Result<(), HostError> {
        if update.base_url.is_empty() || update.access_token.is_empty() {
            return Err(HostError::Config("Base URL and access token are required".into()));
        }
        let base_url = validate_backend_url(&update.base_url)
            .map_err(|message| HostError::Config(message.into()))?;
        self.backend = Some(BackendConfig {
            base_url,
            access_token: update.access_token,
            refresh_token: update.refresh_token,
            access_token_expires_at_ms: update.access_token_expires_at_ms,
        });
        if let Some(rev) = update.review_url {
            self.review_url = Some(rev);
        }
        Ok(())
    }

    pub fn load(paths: &HostPaths) -> Result<Self, HostError> {
        if !paths.config.exists() {
            return Err(HostError::Config(format!(
                "Config file not found at {}",
                paths.config.display()
            )));
        }
        let data = fs::read(&paths.config)?;
        let config: Self = serde_json::from_slice(&data)?;
        if let Some(backend) = &config.backend {
            validate_backend_url(&backend.base_url)
                .map_err(|message| HostError::Config(message.into()))?;
        }
        Ok(config)
    }

    pub fn save(&self, paths: &HostPaths) -> Result<(), HostError> {
        paths.secure_directories()?;
        atomic_write_json(&paths.config, self)
    }
}

fn validate_backend_url(raw: &str) -> Result<String, &'static str> {
    let parsed = url::Url::parse(raw.trim()).map_err(|_| "Invalid backend URL")?;
    let authority = raw.trim().split_once("://").map(|(_, rest)| rest.split(['/', '?', '#']).next().unwrap_or_default()).unwrap_or_default();
    if authority.contains('@') || parsed.password().is_some() || parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Backend URL must not contain credentials, a query, or a fragment");
    }
    let loopback = match parsed.host() {
        Some(url::Host::Domain(host)) => host.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(host)) => host == std::net::Ipv4Addr::LOCALHOST,
        Some(url::Host::Ipv6(host)) => host == std::net::Ipv6Addr::LOCALHOST,
        None => false,
    };
    match parsed.scheme() {
        "https" => {}
        "http" if loopback => {}
        "http" => return Err("Secure connection required: remote servers must use HTTPS"),
        _ => return Err("Backend URL must use HTTP on loopback or HTTPS"),
    }
    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), HostError> {
    let parent = path.parent().ok_or_else(|| {
        HostError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Invalid target path",
        ))
    })?;
    fs::create_dir_all(parent)?;

    let temp_path = parent.join(format!(".tmp-{}", rand::random::<u64>()));
    {
        let mut file = File::create(&temp_path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(Permissions::from_mode(0o600))?;
        }
        let data = serde_json::to_vec_pretty(value)?;
        file.write_all(&data)?;
        file.sync_all()?;
    }
    fs::rename(temp_path, path)?;
    Ok(())
}

mod hex {
    pub fn encode<T: AsRef<[u8]>>(data: T) -> String {
        data.as_ref()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_pairing_and_rotation() {
        let (mut config, pairing_code) = HostConfig::new_installation();
        assert!(!pairing_code.is_empty());
        assert!(config.verify_pairing(&pairing_code));
        assert!(!config.verify_pairing("wrong-code"));

        let rotated = config.rotate_pairing();
        assert_ne!(pairing_code, rotated);
        assert!(!config.verify_pairing(&pairing_code));
        assert!(config.verify_pairing(&rotated));
    }

    #[test]
    fn backend_credentials_require_https_except_explicit_loopback() {
        for url in ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "https://api.example.com"] {
            assert!(validate_backend_url(url).is_ok(), "{url}");
        }
        for url in [
            "http://192.168.1.2:8080", "http://127.0.0.2:8080", "http://localhost.example:8080",
            "https://user:secret@example.com", "https://@example.com", "https://example.com/?token=x",
            "https://example.com/#fragment", "ftp://example.com",
        ] {
            assert!(validate_backend_url(url).is_err(), "{url}");
        }
    }

    #[test]
    fn test_config_save_load() {
        let dir = tempdir().unwrap();
        let paths = HostPaths {
            config: dir.path().join("browser_host.json"),
            policy: dir.path().join("browser_policy.json"),
            state_dir: dir.path().to_path_buf(),
        };

        let (config, _) = HostConfig::new_installation();
        config.save(&paths).unwrap();

        let loaded = HostConfig::load(&paths).unwrap();
        assert_eq!(config.installation_id, loaded.installation_id);
    }
}

