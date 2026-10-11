use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ClaimPolicyRequest {
    pub authenticated: bool,
    pub email_verified: bool,
    pub already_claimed: bool,
    pub risk_attempts_24h: u32,
    pub requested_name_valid: bool,
    pub requested_name_reserved: bool,
}

#[derive(Debug, Serialize)]
pub struct ClaimPolicyResponse {
    pub allowed: bool,
    pub reason: Option<&'static str>,
    pub transaction_required: bool,
}

pub fn evaluate(input: ClaimPolicyRequest) -> ClaimPolicyResponse {
    let reason = if !input.authenticated {
        Some("authentication_required")
    } else if !input.email_verified {
        Some("email_verification_required")
    } else if input.already_claimed {
        Some("free_domain_already_used")
    } else if input.risk_attempts_24h >= 3 {
        Some("risk_limit_reached")
    } else if !input.requested_name_valid || input.requested_name_reserved {
        Some("invalid_or_reserved_subdomain")
    } else {
        None
    };

    ClaimPolicyResponse {
        allowed: reason.is_none(),
        reason,
        transaction_required: true,
    }
}

#[cfg(test)]
mod tests {
    use super::{evaluate, ClaimPolicyRequest};

    #[test]
    fn requires_atomic_transaction_for_valid_claims() {
        let result = evaluate(ClaimPolicyRequest {
            authenticated: true,
            email_verified: true,
            already_claimed: false,
            risk_attempts_24h: 0,
            requested_name_valid: true,
            requested_name_reserved: false,
        });
        assert!(result.allowed);
        assert!(result.transaction_required);
    }
}
