use serde::{Deserialize, Serialize};

const MAX_SESSION_AGE_SECONDS: u64 = 30 * 24 * 60 * 60;
const MIN_SESSION_AGE_SECONDS: u64 = 300;

#[derive(Debug, Deserialize)]
pub struct SessionPolicyRequest {
    pub authenticated: bool,
    pub session_age_seconds: u64,
    pub expires_in_seconds: u64,
    pub refresh_requested: bool,
    pub csrf_valid: bool,
    pub secure_transport: bool,
}

#[derive(Debug, Serialize)]
pub struct SessionPolicyResponse {
    pub valid: bool,
    pub should_refresh: bool,
    pub should_revoke: bool,
    pub reason: Option<&'static str>,
    pub cookie_secure: bool,
    pub cookie_http_only: bool,
    pub same_site: &'static str,
}

pub fn evaluate(input: SessionPolicyRequest) -> SessionPolicyResponse {
    let reason = if !input.authenticated {
        Some("authentication_required")
    } else if !input.secure_transport {
        Some("secure_transport_required")
    } else if !input.csrf_valid {
        Some("csrf_validation_failed")
    } else if input.session_age_seconds > MAX_SESSION_AGE_SECONDS
        || input.expires_in_seconds == 0
    {
        Some("session_expired")
    } else {
        None
    };

    let should_refresh = reason.is_none()
        && input.refresh_requested
        && input.expires_in_seconds <= MIN_SESSION_AGE_SECONDS;

    SessionPolicyResponse {
        valid: reason.is_none(),
        should_refresh,
        should_revoke: reason.is_some(),
        reason,
        cookie_secure: true,
        cookie_http_only: true,
        same_site: "Lax",
    }
}

#[cfg(test)]
mod tests {
    use super::{evaluate, SessionPolicyRequest};

    fn valid_request() -> SessionPolicyRequest {
        SessionPolicyRequest {
            authenticated: true,
            session_age_seconds: 60,
            expires_in_seconds: 3600,
            refresh_requested: false,
            csrf_valid: true,
            secure_transport: true,
        }
    }

    #[test]
    fn accepts_secure_active_session() {
        let result = evaluate(valid_request());
        assert!(result.valid);
        assert!(!result.should_revoke);
        assert!(result.cookie_http_only);
    }

    #[test]
    fn requests_refresh_near_expiry() {
        let mut input = valid_request();
        input.expires_in_seconds = 120;
        input.refresh_requested = true;
        let result = evaluate(input);
        assert!(result.valid);
        assert!(result.should_refresh);
    }

    #[test]
    fn revokes_insecure_session() {
        let mut input = valid_request();
        input.secure_transport = false;
        let result = evaluate(input);
        assert!(!result.valid);
        assert!(result.should_revoke);
        assert_eq!(result.reason, Some("secure_transport_required"));
    }
}
