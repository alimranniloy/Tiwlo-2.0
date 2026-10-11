use crate::{config::Config, rate_limit::RateLimiter};
use std::{
    sync::Arc,
    time::Instant,
};

#[derive(Clone)]
pub struct AppState {
    pub started_at: Instant,
    pub limiter: Arc<RateLimiter>,
    pub node_backend_url: String,
}

impl AppState {
    pub fn new(config: &Config) -> Self {
        Self {
            started_at: Instant::now(),
            limiter: Arc::new(RateLimiter::new(config.rate_limit)),
            node_backend_url: config.node_backend_url.clone(),
        }
    }
}
