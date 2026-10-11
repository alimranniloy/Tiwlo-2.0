use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IdentityAssertion {
    pub user_id: String,
    pub email_verified: bool,
    pub ip_hash: String,
    pub device_hash: Option<String>,
    pub email_hash: String,
    pub expires_at: u64,
}

#[derive(Debug)]
pub enum IdentityError {
    Missing,
    Malformed,
    InvalidSignature,
    Expired,
    InvalidSubject,
    InvalidSignal,
}

pub fn sign(assertion: &IdentityAssertion, secret: &str) -> Result<String, IdentityError> {
    if secret.is_empty() || !valid_subject(&assertion.user_id) {
        return Err(IdentityError::InvalidSubject);
    }
    let payload = serde_json::to_vec(assertion).map_err(|_| IdentityError::Malformed)?;
    let encoded_payload = URL_SAFE_NO_PAD.encode(payload);
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| IdentityError::Malformed)?;
    mac.update(encoded_payload.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(format!("{encoded_payload}.{signature}"))
}

pub fn verify(token: &str, secret: &str) -> Result<IdentityAssertion, IdentityError> {
    if token.is_empty() || secret.is_empty() {
        return Err(IdentityError::Missing);
    }
    let (payload, signature) = token.split_once('.').ok_or(IdentityError::Malformed)?;
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| IdentityError::Malformed)?;
    mac.update(payload.as_bytes());
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| IdentityError::Malformed)?;
    mac.verify_slice(&signature_bytes)
        .map_err(|_| IdentityError::InvalidSignature)?;
    let assertion: IdentityAssertion = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| IdentityError::Malformed)?,
    )
    .map_err(|_| IdentityError::Malformed)?;
    if !valid_subject(&assertion.user_id) {
        return Err(IdentityError::InvalidSubject);
    }
    if !valid_hash(&assertion.ip_hash)
        || !assertion
            .device_hash
            .as_deref()
            .map_or(true, valid_hash)
        || !valid_hash(&assertion.email_hash)
    {
        return Err(IdentityError::InvalidSignal);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| IdentityError::Malformed)?
        .as_secs();
    if assertion.expires_at <= now {
        return Err(IdentityError::Expired);
    }
    Ok(assertion)
}

fn valid_subject(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && !value.bytes().any(|byte| byte < 0x20)
}

fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

#[cfg(test)]
mod tests {
    use super::{sign, verify, IdentityAssertion, IdentityError};

    fn assertion() -> IdentityAssertion {
        IdentityAssertion {
            user_id: "user-123".to_owned(),
            email_verified: true,
            ip_hash: "a".repeat(64),
            device_hash: Some("b".repeat(64)),
            email_hash: "c".repeat(64),
            expires_at: u64::MAX,
        }
    }

    #[test]
    fn verifies_signed_identity() {
        let token = sign(&assertion(), "test-secret").expect("token");
        let result = verify(&token, "test-secret").expect("identity");
        assert_eq!(result.user_id, "user-123");
        assert!(result.email_verified);
    }

    #[test]
    fn rejects_tampered_identity() {
        let token = sign(&assertion(), "test-secret").expect("token");
        let tampered = format!("{}x", token);
        assert!(matches!(
            verify(&tampered, "test-secret"),
            Err(IdentityError::InvalidSignature)
        ));
    }

    #[test]
    fn rejects_malformed_signal_hashes() {
        let mut invalid = assertion();
        invalid.ip_hash = "not-a-hash".to_owned();
        let token = sign(&invalid, "test-secret").expect("token");
        assert!(matches!(
            verify(&token, "test-secret"),
            Err(IdentityError::InvalidSignal)
        ));
    }

    #[test]
    fn rejects_uppercase_signal_hashes() {
        let mut invalid = assertion();
        invalid.email_hash = "A".repeat(64);
        let token = sign(&invalid, "test-secret").expect("token");
        assert!(matches!(
            verify(&token, "test-secret"),
            Err(IdentityError::InvalidSignal)
        ));
    }
}
