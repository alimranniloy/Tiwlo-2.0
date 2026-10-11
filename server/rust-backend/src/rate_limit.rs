use std::{
    collections::HashMap,
    net::IpAddr,
    sync::Mutex,
    time::{Duration, Instant},
};

pub struct RateLimiter {
    windows: Mutex<HashMap<IpAddr, Window>>,
    limit: u32,
    window: Duration,
}

struct Window {
    started_at: Instant,
    requests: u32,
}

impl RateLimiter {
    pub fn new(limit: u32) -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
            limit,
            window: Duration::from_secs(60),
        }
    }

    pub fn allow(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut windows = self.windows.lock().expect("rate limiter mutex poisoned");
        let entry = windows.entry(ip).or_insert(Window {
            started_at: now,
            requests: 0,
        });

        if now.duration_since(entry.started_at) >= self.window {
            entry.started_at = now;
            entry.requests = 0;
        }
        if entry.requests >= self.limit {
            return false;
        }
        entry.requests += 1;
        true
    }
}
