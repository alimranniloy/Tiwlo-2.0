use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

const SSO_TICKET_TTL_MS: u64 = 60_000;

#[derive(Debug, Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFingerprint {
    pub hash: String,
    pub platform: String,
    pub os_version: String,
    pub device_model: String,
    pub app_version: String,
    pub network_type: String,
    pub ip: String,
    pub captured_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoTicketPayload {
    pub user_id: String,
    pub tiwi_id: Option<String>,
    pub email: String,
    pub nonce: String,
    pub issued_at: u64,
    pub expires_at: u64,
    pub origin: String,
    pub is_app_trusted: bool,
    pub device_fingerprint: DeviceFingerprint,
}

pub struct SsoTicket {
    pub token: String,
    pub payload: SsoTicketPayload,
}

pub fn create_ticket(
    secret: &str,
    app_trust_key: &str,
    user_id: String,
    tiwi_id: Option<String>,
    email: String,
    device_data: DeviceFingerprint,
    app_trust_token: Option<&str>,
    origin: String,
) -> Result<SsoTicket, &'static str> {
    if user_id.is_empty()
        || user_id.len() > 128
        || email.is_empty()
        || email.len() > 254
        || origin.is_empty()
        || origin.len() > 64
        || device_data.ip.len() > 64
    {
        return Err("invalid_sso_ticket");
    }
    let mut nonce_bytes = [0_u8; 24];
    getrandom::getrandom(&mut nonce_bytes).map_err(|_| "sso_ticket_unavailable")?;
    let issued_at = now_ms()?;
    let payload = SsoTicketPayload {
        user_id,
        tiwi_id,
        email,
        nonce: format!("sso_nonce_{}", hex::encode(nonce_bytes)),
        issued_at,
        expires_at: issued_at + SSO_TICKET_TTL_MS,
        origin,
        is_app_trusted: !app_trust_key.is_empty() && app_trust_token == Some(app_trust_key),
        device_fingerprint: device_data,
    };
    let encoded_payload =
        URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).map_err(|_| "sso_ticket_unavailable")?);
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| "sso_ticket_unavailable")?;
    mac.update(encoded_payload.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    Ok(SsoTicket {
        token: format!("{encoded_payload}.{signature}"),
        payload,
    })
}

pub fn verify_ticket(
    secret: &str,
    token: &str,
    nonce: &str,
) -> Result<SsoTicketPayload, &'static str> {
    if token.len() > 8192 {
        return Err("Malformed SSO token structure");
    }
    let (encoded_payload, received_signature) = token
        .split_once('.')
        .ok_or("Malformed SSO token structure")?;
    if received_signature.contains('.') {
        return Err("Malformed SSO token structure");
    }
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(encoded_payload)
        .map_err(|_| "Invalid SSO token payload encoding")?;
    let payload: SsoTicketPayload =
        serde_json::from_slice(&payload_bytes).map_err(|_| "Invalid SSO token payload encoding")?;
    if payload.nonce != nonce {
        return Err("Nonce mismatch in token payload");
    }
    if payload.expires_at <= now_ms()? {
        return Err("SSO handshake token has expired");
    }
    let signature = hex::decode(received_signature)
        .map_err(|_| "Cryptographic signature verification failed: invalid or forged SSO token")?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "SSO verification unavailable")?;
    mac.update(encoded_payload.as_bytes());
    mac.verify_slice(&signature)
        .map_err(|_| "Cryptographic signature verification failed: invalid or forged SSO token")?;
    Ok(payload)
}

pub fn fingerprint_hash(
    platform: &str,
    os_version: &str,
    device_model: &str,
    app_version: &str,
    network_type: &str,
    ip: &str,
) -> String {
    let canonical =
        format!("{platform}|{os_version}|{device_model}|{app_version}|{network_type}|{ip}");
    hex::encode(Sha256::digest(canonical.as_bytes()))
}

fn now_ms() -> Result<u64, &'static str> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "SSO verification unavailable")?;
    Ok(duration.as_millis().min(u64::MAX as u128) as u64)
}

#[cfg(test)]
mod tests {
    use super::{
        create_ticket, fingerprint_hash, verify_ticket, DeviceFingerprint, URL_SAFE_NO_PAD,
    };
    use base64::Engine as _;

    fn fingerprint() -> DeviceFingerprint {
        DeviceFingerprint {
            hash: fingerprint_hash("ios", "17", "phone", "1.0", "wifi", "127.0.0.1"),
            platform: "ios".to_owned(),
            os_version: "17".to_owned(),
            device_model: "phone".to_owned(),
            app_version: "1.0".to_owned(),
            network_type: "wifi".to_owned(),
            ip: "127.0.0.1".to_owned(),
            captured_at: "2026-01-01T00:00:00.000Z".to_owned(),
        }
    }

    #[test]
    fn signs_complete_claims_and_checks_nonce_expiry() {
        let secret = "sso-test-secret-with-at-least-32-bytes";
        let ticket = create_ticket(
            secret,
            "trusted-app-key",
            "user-1".to_owned(),
            Some("TIW-1".to_owned()),
            "owner@example.com".to_owned(),
            fingerprint(),
            Some("trusted-app-key"),
            "tiwi_mobile_app".to_owned(),
        )
        .expect("ticket creation");
        let verified = verify_ticket(secret, &ticket.token, &ticket.payload.nonce)
            .expect("ticket verification");
        assert_eq!(verified.email, "owner@example.com");
        assert!(verified.is_app_trusted);
        assert_eq!(verified.device_fingerprint, fingerprint());
        assert!(verify_ticket(secret, &ticket.token, "wrong-nonce").is_err());
    }

    #[test]
    fn rejects_altered_sso_claims_and_signature() {
        let secret = "sso-test-secret-with-at-least-32-bytes";
        let ticket = create_ticket(
            secret,
            "",
            "user-1".to_owned(),
            None,
            "owner@example.com".to_owned(),
            fingerprint(),
            None,
            "web_sso".to_owned(),
        )
        .expect("ticket creation");
        let (encoded, signature) = ticket.token.split_once('.').unwrap();
        let mut payload: serde_json::Value =
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(encoded).unwrap()).unwrap();
        payload["email"] = serde_json::Value::String("victim@example.com".to_owned());
        let altered = format!(
            "{}.{signature}",
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).unwrap())
        );
        assert!(verify_ticket(secret, &altered, &ticket.payload.nonce).is_err());
        payload["isAppTrusted"] = serde_json::Value::Bool(true);
        let altered_trust = format!(
            "{}.{signature}",
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).unwrap())
        );
        assert!(verify_ticket(secret, &altered_trust, &ticket.payload.nonce).is_err());
        let altered_signature = format!("{encoded}.{}", "0".repeat(64));
        assert!(verify_ticket(secret, &altered_signature, &ticket.payload.nonce).is_err());
    }
}
