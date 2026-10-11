use crate::{config::Config, metrics::Metrics, rate_limit::RateLimiter};
use std::{
    sync::Arc,
    time::Instant,
};

#[derive(Clone)]
pub struct AppState {
    pub started_at: Instant,
    pub limiter: Arc<RateLimiter>,
    pub node_backend_url: String,
    pub postgres_configured: bool,
    pub redis_configured: bool,
    pub metrics: Arc<Metrics>,
}

impl AppState {
    pub fn new(config: &Config) -> Self {
        Self {
            started_at: Instant::now(),
            limiter: Arc::new(RateLimiter::new(config.rate_limit)),
            node_backend_url: config.node_backend_url.clone(),
            postgres_configured: !config.postgres_url.is_empty(),
            redis_configured: !config.redis_url.is_empty(),
            metrics: Arc::new(Metrics::default()),
        }
    }
}
