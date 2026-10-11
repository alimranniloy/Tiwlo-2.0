use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
pub struct AuditEvent {
    pub event_type: String,
    pub subject_id: String,
    pub request_id: String,
    pub occurred_at_unix: u64,
}

impl AuditEvent {
    pub fn new(event_type: &str, subject_id: &str, request_id: String) -> Self {
        Self {
            event_type: event_type.to_owned(),
            subject_id: subject_id.to_owned(),
            request_id,
            occurred_at_unix: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}
