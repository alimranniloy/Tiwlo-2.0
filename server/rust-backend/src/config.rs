use std::env;

pub struct Config {
    pub bind: String,
    pub rate_limit: u32,
    pub max_body_bytes: usize,
    pub node_backend_url: String,
    pub postgres_url: String,
    pub redis_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let max_body_bytes = env::var("TIWLO_RUST_MAX_BODY_BYTES")
            .unwrap_or_else(|_| "1048576".to_owned())
            .parse::<usize>()?;
        if max_body_bytes == 0 {
            return Err("TIWLO_RUST_MAX_BODY_BYTES must be greater than zero".into());
        }

        Ok(Self {
            bind: env::var("TIWLO_RUST_BIND")
                .unwrap_or_else(|_| "127.0.0.1:7100".to_owned()),
            rate_limit: positive_u32("TIWLO_RUST_RATE_LIMIT", 120),
            max_body_bytes,
            node_backend_url: env::var("TIWLO_NODE_BACKEND_URL").unwrap_or_default(),
            postgres_url: env::var("DATABASE_URL").unwrap_or_default(),
            redis_url: env::var("REDIS_URL").unwrap_or_default(),
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
