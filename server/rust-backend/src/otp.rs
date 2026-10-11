use hmac::{Hmac, Mac};
use rand::{rngs::OsRng, Rng};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub struct GeneratedOtp {
    pub code: String,
    pub token: String,
    pub token_hash: String,
    pub code_hash: String,
}

pub struct GeneratedGrant {
    pub token: String,
    pub token_hash: String,
}

pub fn generate_otp(secret: &str) -> Result<GeneratedOtp, &'static str> {
    let mut rng = OsRng;
    let code = rng.gen_range(100_000..999_999).to_string();
    let token = format!("tok_{}", random_hex(24)?);
    Ok(GeneratedOtp {
        code_hash: hmac_hex(secret, &format!("{token}:{code}"))?,
        token_hash: hmac_hex(secret, &token)?,
        token,
        code,
    })
}

pub fn generate_grant(secret: &str) -> Result<GeneratedGrant, &'static str> {
    let token = format!("grant_{}", random_hex(32)?);
    let token_hash = hmac_hex(secret, &token)?;
    Ok(GeneratedGrant { token, token_hash })
}

pub fn hash_token(secret: &str, token: &str) -> Result<String, &'static str> {
    hmac_hex(secret, token)
}

pub fn verify_code(secret: &str, token: &str, input_code: &str, expected_hash: &str) -> bool {
    let clean_code: String = input_code
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    let message = format!("{token}:{clean_code}");
    let Ok(expected) = hex::decode(expected_hash) else {
        return false;
    };
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(message.as_bytes());
    mac.verify_slice(&expected).is_ok()
}

fn random_hex(length: usize) -> Result<String, &'static str> {
    let mut bytes = vec![0_u8; length];
    getrandom::getrandom(&mut bytes).map_err(|_| "otp_generation_unavailable")?;
    Ok(hex::encode(bytes))
}

fn hmac_hex(secret: &str, value: &str) -> Result<String, &'static str> {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| "otp_generation_unavailable")?;
    mac.update(value.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::{generate_grant, generate_otp, hash_token, verify_code};

    #[test]
    fn generated_otp_is_hmac_protected_and_whitespace_tolerant() {
        let secret = "otp-test-secret-with-at-least-32-bytes";
        let generated = generate_otp(secret).expect("OTP generation");
        assert_eq!(generated.code.len(), 6);
        assert!(generated.token.starts_with("tok_"));
        assert_eq!(
            generated.token_hash,
            hash_token(secret, &generated.token).unwrap()
        );
        assert!(verify_code(
            secret,
            &generated.token,
            &generated.code,
            &generated.code_hash
        ));
        let spaced_code = format!("{} {}", &generated.code[..3], &generated.code[3..]);
        assert!(verify_code(
            secret,
            &generated.token,
            &spaced_code,
            &generated.code_hash
        ));
        assert!(!verify_code(
            secret,
            "another-token",
            &generated.code,
            &generated.code_hash
        ));
    }

    #[test]
    fn generated_reset_grants_have_distinct_private_token_hashes() {
        let secret = "otp-test-secret-with-at-least-32-bytes";
        let first = generate_grant(secret).expect("grant generation");
        let second = generate_grant(secret).expect("grant generation");
        assert!(first.token.starts_with("grant_"));
        assert_ne!(first.token, second.token);
        assert_eq!(first.token_hash, hash_token(secret, &first.token).unwrap());
        assert_ne!(first.token, first.token_hash);
    }
}
