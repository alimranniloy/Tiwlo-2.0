use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct RecordPolicyRequest {
    pub record_type: String,
    pub name: String,
    pub value: String,
    pub ttl: u32,
}

#[derive(Debug, Serialize)]
pub struct RecordPolicyResponse {
    pub valid: bool,
    pub record_type: String,
    pub name: String,
    pub value: String,
    pub ttl: u32,
    pub error: Option<String>,
}

pub fn validate(input: RecordPolicyRequest) -> RecordPolicyResponse {
    let record_type = input.record_type.trim().to_ascii_uppercase();
    let name = input.name.trim().to_ascii_lowercase();
    let value = input.value.trim().trim_end_matches('.').to_owned();
    let error = if !matches!(record_type.as_str(), "A" | "CNAME" | "TXT" | "NS") {
        Some("record type must be A, CNAME, TXT, or NS".to_owned())
    } else if name.is_empty() || value.is_empty() {
        Some("record name and value are required".to_owned())
    } else if !(60..=86400).contains(&input.ttl) {
        Some("TTL must be between 60 and 86400 seconds".to_owned())
    } else if matches!(record_type.as_str(), "CNAME" | "NS")
        && !is_hostname(&value)
    {
        Some("record value must be a valid hostname".to_owned())
    } else {
        None
    };

    RecordPolicyResponse {
        valid: error.is_none(),
        record_type,
        name,
        value,
        ttl: input.ttl,
        error,
    }
}

fn is_hostname(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 253
        && value.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}

#[cfg(test)]
mod tests {
    use super::{validate, RecordPolicyRequest};

    #[test]
    fn accepts_multiple_nameserver_records() {
        let result = validate(RecordPolicyRequest {
            record_type: "ns".to_owned(),
            name: "@".to_owned(),
            value: "ns2.example.com.".to_owned(),
            ttl: 300,
        });
        assert!(result.valid);
        assert_eq!(result.value, "ns2.example.com");
    }
}
