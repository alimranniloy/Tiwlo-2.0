use serde::{Deserialize, Serialize};

const MAX_LABEL_LENGTH: usize = 63;

#[derive(Debug, Deserialize)]
pub struct DomainValidationRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct DomainValidationResponse {
    pub name: String,
    pub domain: String,
    pub available_format: bool,
    pub reserved: bool,
    pub suggestions: Vec<String>,
}

pub fn validate(name: &str, suffix: &str) -> DomainValidationResponse {
    let normalized = name.trim().to_ascii_lowercase();
    let reserved = is_reserved(&normalized);
    let valid = is_valid_label(&normalized);
    let suggestions = if valid && !reserved {
        candidates(&normalized)
    } else {
        Vec::new()
    };

    DomainValidationResponse {
        domain: format!("{normalized}.{suffix}"),
        name: normalized,
        available_format: valid && !reserved,
        reserved,
        suggestions,
    }
}

fn is_valid_label(value: &str) -> bool {
    if value.is_empty() || value.len() > MAX_LABEL_LENGTH {
        return false;
    }
    if value.starts_with('-') || value.ends_with('-') {
        return false;
    }
    value.bytes().all(|byte| byte.is_ascii_lowercase()
        || byte.is_ascii_digit()
        || byte == b'-')
}

fn is_reserved(value: &str) -> bool {
    matches!(
        value,
        "www" | "api" | "auth" | "admin" | "app" | "blog" | "cdn" | "dashboard"
            | "dns1" | "dns2" | "docs" | "drive" | "mail" | "mta" | "ns1" | "ns2"
            | "support" | "tpanel"
    )
}

fn candidates(value: &str) -> Vec<String> {
    [
        format!("{value}-app"),
        format!("{value}-dev"),
        format!("{value}-site"),
        format!("{value}-hub"),
        format!("get-{value}"),
        format!("try-{value}"),
        format!("use-{value}"),
        format!("{value}hq"),
    ]
    .into_iter()
    .filter(|candidate| candidate.len() <= MAX_LABEL_LENGTH && is_valid_label(candidate))
    .filter(|candidate| !is_reserved(candidate))
    .take(5)
    .collect()
}

#[cfg(test)]
mod tests {
    use super::validate;

    #[test]
    fn normalizes_valid_domain_names() {
        let result = validate(" My-App ", "uids.app");
        assert_eq!(result.name, "my-app");
        assert!(result.available_format);
        assert_eq!(result.domain, "my-app.uids.app");
    }

    #[test]
    fn rejects_reserved_names() {
        let result = validate("API", "uids.app");
        assert!(result.reserved);
        assert!(!result.available_format);
    }

    #[test]
    fn rejects_invalid_labels() {
        let result = validate("-bad-name-", "uids.app");
        assert!(!result.available_format);
    }
}
