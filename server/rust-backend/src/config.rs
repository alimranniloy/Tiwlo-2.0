use std::env;

fn clean_domain(name: &str, fallback: &str) -> String {
    let value = env::var(name)
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_start_matches("*.")
        .trim_end_matches('/')
        .to_owned();
    if value.is_empty() {
        fallback.to_owned()
    } else {
        value
    }
}

pub struct Config {
    pub bind: String,
    pub rate_limit: u32,
    pub max_body_bytes: usize,
    pub node_backend_url: String,
    pub postgres_url: String,
    pub redis_url: String,
    pub identity_secret: String,
    pub otp_secret: String,
    pub app_trust_key: String,
    pub free_subdomain_domain: String,
    pub primary_domain: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let max_body_bytes = env::var("TIWLO_RUST_MAX_BODY_BYTES")
            .unwrap_or_else(|_| "1048576".to_owned())
            .parse::<usize>()?;
        if max_body_bytes == 0 {
            return Err("TIWLO_RUST_MAX_BODY_BYTES must be greater than zero".into());
        }
        let identity_secret = env::var("TIWLO_INTERNAL_IDENTITY_SECRET").unwrap_or_default();
        if identity_secret.len() < 32 {
            return Err("TIWLO_INTERNAL_IDENTITY_SECRET must be at least 32 characters".into());
        }
        let otp_secret = env::var("SECURITY_SECRET").unwrap_or_default();
        if otp_secret.len() < 32 {
            return Err("SECURITY_SECRET must be at least 32 characters".into());
        }

        Ok(Self {
            bind: env::var("TIWLO_RUST_BIND").unwrap_or_else(|_| "127.0.0.1:7100".to_owned()),
            rate_limit: positive_u32("TIWLO_RUST_RATE_LIMIT", 10_000),
            max_body_bytes,
            node_backend_url: env::var("TIWLO_NODE_BACKEND_URL").unwrap_or_default(),
            postgres_url: env::var("DATABASE_URL").unwrap_or_default(),
            redis_url: env::var("REDIS_URL").unwrap_or_default(),
            identity_secret,
            otp_secret,
            app_trust_key: env::var("TIWI_APP_TRUST_KEY").unwrap_or_default(),
            free_subdomain_domain: clean_domain("VITE_FREE_SUBDOMAIN_DOMAIN", "uids.app"),
            primary_domain: clean_domain("VITE_PRIMARY_DOMAIN", "tiwlo.com"),
        })
    }
}

fn positive_u32(name: &str, default: u32) -> u32 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}
