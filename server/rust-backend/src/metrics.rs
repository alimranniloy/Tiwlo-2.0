use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
pub struct Metrics {
    pub requests_total: AtomicU64,
    pub responses_2xx: AtomicU64,
    pub responses_4xx: AtomicU64,
    pub responses_5xx: AtomicU64,
    pub rate_limited_total: AtomicU64,
}

impl Metrics {
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            requests_total: self.requests_total.load(Ordering::Relaxed),
            responses_2xx: self.responses_2xx.load(Ordering::Relaxed),
            responses_4xx: self.responses_4xx.load(Ordering::Relaxed),
            responses_5xx: self.responses_5xx.load(Ordering::Relaxed),
            rate_limited_total: self.rate_limited_total.load(Ordering::Relaxed),
        }
    }

    pub fn record_response(&self, status: u16) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
        match status {
            200..=299 => self.responses_2xx.fetch_add(1, Ordering::Relaxed),
            400..=499 => self.responses_4xx.fetch_add(1, Ordering::Relaxed),
            500..=599 => self.responses_5xx.fetch_add(1, Ordering::Relaxed),
            _ => 0,
        };
    }
}

#[derive(Debug, Clone, Copy)]
pub struct MetricsSnapshot {
    pub requests_total: u64,
    pub responses_2xx: u64,
    pub responses_4xx: u64,
    pub responses_5xx: u64,
    pub rate_limited_total: u64,
}

impl MetricsSnapshot {
    pub fn prometheus(self) -> String {
        format!(
            "# TYPE tiwlo_http_requests_total counter\n\
             tiwlo_http_requests_total {}\n\
             # TYPE tiwlo_http_responses_total counter\n\
             tiwlo_http_responses_total{{class=\"2xx\"}} {}\n\
             tiwlo_http_responses_total{{class=\"4xx\"}} {}\n\
             tiwlo_http_responses_total{{class=\"5xx\"}} {}\n\
             # TYPE tiwlo_http_rate_limited_total counter\n\
             tiwlo_http_rate_limited_total {}\n",
            self.requests_total,
            self.responses_2xx,
            self.responses_4xx,
            self.responses_5xx,
            self.rate_limited_total
        )
    }
}

#[cfg(test)]
mod tests {
    use super::Metrics;

    #[test]
    fn records_response_classes() {
        let metrics = Metrics::default();
        metrics.record_response(200);
        metrics.record_response(422);
        metrics.record_response(503);
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.requests_total, 3);
        assert_eq!(snapshot.responses_2xx, 1);
        assert_eq!(snapshot.responses_4xx, 1);
        assert_eq!(snapshot.responses_5xx, 1);
    }
}
