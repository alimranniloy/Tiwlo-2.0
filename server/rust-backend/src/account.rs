use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct AccountPolicyRequest {
    pub email: String,
    pub password_length: usize,
    pub email_verified: bool,
}

#[derive(Debug, Serialize)]
pub struct AccountPolicyResponse {
    pub email_normalized: String,
    pub email_valid: bool,
    pub password_length_valid: bool,
    pub email_verification_required: bool,
}

pub fn evaluate(input: AccountPolicyRequest) -> AccountPolicyResponse {
    let email = input.email.trim().to_ascii_lowercase();
    let email_valid = email.len() <= 254
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
        });

    AccountPolicyResponse {
        email_normalized: email,
        email_valid,
        password_length_valid: (8..=256).contains(&input.password_length),
        email_verification_required: !input.email_verified,
    }
}

#[cfg(test)]
mod tests {
    use super::{evaluate, AccountPolicyRequest};

    #[test]
    fn normalizes_email_without_handling_passwords() {
        let result = evaluate(AccountPolicyRequest {
            email: " User@Example.com ".to_owned(),
            password_length: 12,
            email_verified: true,
        });
        assert_eq!(result.email_normalized, "user@example.com");
        assert!(result.email_valid);
        assert!(result.password_length_valid);
    }
}
