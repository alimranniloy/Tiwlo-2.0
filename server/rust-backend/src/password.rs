use scrypt::{scrypt, Params};

const SCRYPT_LOG_N: u8 = 14;
const SCRYPT_R: u32 = 8;
const SCRYPT_P: u32 = 1;
const DERIVED_KEY_BYTES: usize = 64;
const SALT_BYTES: usize = 16;

pub fn hash_password(password: &str) -> Result<String, &'static str> {
    if password.is_empty() || password.len() > 1024 {
        return Err("invalid_password");
    }
    let mut salt = [0_u8; SALT_BYTES];
    getrandom::getrandom(&mut salt).map_err(|_| "password_hash_unavailable")?;
    let salt = hex::encode(salt);
    let params = Params::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P, DERIVED_KEY_BYTES)
        .map_err(|_| "password_hash_unavailable")?;
    let mut derived_key = [0_u8; DERIVED_KEY_BYTES];
    scrypt(
        password.as_bytes(),
        salt.as_bytes(),
        &params,
        &mut derived_key,
    )
    .map_err(|_| "password_hash_unavailable")?;
    Ok(format!(
        "scrypt$16384:8:1${salt}${}",
        hex::encode(derived_key)
    ))
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    if password.is_empty() || password.len() > 1024 || stored_hash.is_empty() {
        return false;
    }
    if !stored_hash.starts_with("scrypt$") {
        return constant_time_eq(password.as_bytes(), stored_hash.as_bytes());
    }

    let Some((algorithm, rest)) = stored_hash.split_once('$') else {
        return false;
    };
    let mut parts = rest.split('$');
    let (Some(parameters), Some(salt), Some(expected_hex), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };
    if algorithm != "scrypt"
        || parameters != "16384:8:1"
        || !valid_hex(salt, SALT_BYTES * 2)
        || !valid_hex(expected_hex, DERIVED_KEY_BYTES * 2)
    {
        return false;
    }
    let Ok(expected_key) = hex::decode(expected_hex) else {
        return false;
    };
    if expected_key.len() != DERIVED_KEY_BYTES || expected_hex.len() != DERIVED_KEY_BYTES * 2 {
        return false;
    }

    let Ok(params) = Params::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P, DERIVED_KEY_BYTES) else {
        return false;
    };
    let mut derived_key = [0_u8; DERIVED_KEY_BYTES];
    if scrypt(
        password.as_bytes(),
        salt.as_bytes(),
        &params,
        &mut derived_key,
    )
    .is_err()
    {
        return false;
    }
    constant_time_eq(&derived_key, &expected_key)
}

fn valid_hex(value: &str, expected_length: usize) -> bool {
    value.len() == expected_length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

#[cfg(test)]
mod tests {
    use super::{hash_password, verify_password};

    #[test]
    fn hashes_and_verifies_node_compatible_scrypt_values() {
        let password = "a secure password";
        let hash = hash_password(password).expect("password hash");
        assert!(hash.starts_with("scrypt$16384:8:1$"));
        assert!(verify_password(password, &hash));
        assert!(!verify_password("a different password", &hash));
    }

    #[test]
    fn verifies_hashes_created_by_node_crypto_scrypt() {
        let node_hash = "scrypt$16384:8:1$0123456789abcdef0123456789abcdef$61531ca7a502225506b3a35fb5207de33302a90bb04f6e50292a4c4f5e3db2467d87a373a5168cb53170d14148a8dcff77bf314470e205d5e5f87912726e6c24";
        assert!(verify_password("node-rust-compat", node_hash));
    }

    #[test]
    fn supports_legacy_plaintext_hashes() {
        assert!(verify_password("legacy-password", "legacy-password"));
        assert!(!verify_password("wrong-password", "legacy-password"));
    }

    #[test]
    fn rejects_malformed_or_unsupported_scrypt_hashes() {
        assert!(!verify_password("password", "scrypt$broken"));
        assert!(!verify_password(
            "password",
            "scrypt$16384:8:1$not-a-salt$not-a-key"
        ));
        assert!(!verify_password(
            "password",
            "scrypt$32768:8:1$0123456789abcdef0123456789abcdef$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        ));
    }
}
