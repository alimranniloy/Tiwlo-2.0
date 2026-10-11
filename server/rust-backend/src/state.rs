use crate::{
    config::Config, metrics::Metrics, rate_limit::RateLimiter, repository::Repository,
};
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
    pub repository: Option<Arc<Repository>>,
    pub identity_secret: Arc<str>,
}

impl AppState {
    pub fn new(config: &Config, repository: Option<Arc<Repository>>) -> Self {
        Self {
            started_at: Instant::now(),
            limiter: Arc::new(RateLimiter::new(config.rate_limit)),
            node_backend_url: config.node_backend_url.clone(),
            postgres_configured: repository.is_some(),
            redis_configured: !config.redis_url.is_empty(),
            metrics: Arc::new(Metrics::default()),
            repository,
            identity_secret: Arc::from(config.identity_secret.clone()),
        }
    }
}
