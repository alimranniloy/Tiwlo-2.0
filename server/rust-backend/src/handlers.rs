use crate::{account, claim, dns, domain, media, session, state::AppState};
use axum::{
    extract::State,
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use axum_extra::{
    headers::{Header, HeaderName, HeaderValue as TypedHeaderValue},
    TypedHeader,
};
use serde::Serialize;

const SERVICE_NAME: &str = "tiwlo-rust-backend";

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub uptime_seconds: u64,
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub node_backend_configured: bool,
    pub postgres_configured: bool,
    pub redis_configured: bool,
}

#[derive(Serialize)]
pub struct AdmissionResponse {
    pub allowed: bool,
    pub service: &'static str,
    pub request_id: String,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: SERVICE_NAME,
        uptime_seconds: state.started_at.elapsed().as_secs(),
    })
}

pub async fn ready(State(state): State<AppState>) -> Json<ReadinessResponse> {
    Json(ReadinessResponse {
        status: "ready",
        service: SERVICE_NAME,
        node_backend_configured: !state.node_backend_url.is_empty(),
        postgres_configured: state.postgres_configured,
        redis_configured: state.redis_configured,
    })
}

pub async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    let body = state.metrics.snapshot().prometheus();
    (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; version=0.0.4"),
        )],
        body,
    )
}

pub async fn admission() -> Json<AdmissionResponse> {
    Json(AdmissionResponse {
        allowed: true,
        service: SERVICE_NAME,
        request_id: crate::middleware::new_request_id(),
    })
}

pub async fn domain_validation(
    Json(request): Json<domain::DomainValidationRequest>,
) -> (StatusCode, Json<domain::DomainValidationResponse>) {
    let result = domain::validate(&request.name, "uids.app");
    let status = if result.available_format {
        StatusCode::OK
    } else {
        StatusCode::UNPROCESSABLE_ENTITY
    };
    (status, Json(result))
}

pub async fn domain_availability(
    State(state): State<AppState>,
    Json(request): Json<domain::DomainValidationRequest>,
) -> (StatusCode, Json<DomainAvailabilityResponse>) {
    let validation = domain::validate(&request.name, "uids.app");
    if !validation.available_format {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(DomainAvailabilityResponse {
                available: false,
                domain: validation.domain,
                status: Some("invalid_or_reserved".to_owned()),
            }),
        );
    }

    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(DomainAvailabilityResponse {
                available: false,
                domain: validation.domain,
                status: Some("database_unavailable".to_owned()),
            }),
        );
    };

    match repository.availability(&validation.name).await {
        Ok(result) => (
            StatusCode::OK,
            Json(DomainAvailabilityResponse {
                available: result.available,
                domain: if result.domain.is_empty() {
                    validation.domain
                } else {
                    result.domain
                },
                status: result.status,
            }),
        ),
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(DomainAvailabilityResponse {
                available: false,
                domain: validation.domain,
                status: Some("database_error".to_owned()),
            }),
        ),
    }
}

#[derive(Serialize)]
pub struct DomainAvailabilityResponse {
    pub available: bool,
    pub domain: String,
    pub status: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct ClaimRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct ClaimResponse {
    pub id: String,
    pub subdomain: String,
    pub domain: String,
}

#[derive(Clone, Debug)]
pub struct IdentityHeader(pub String);

impl Header for IdentityHeader {
    fn name() -> &'static HeaderName {
        static NAME: HeaderName = HeaderName::from_static("x-tiwlo-identity");
        &NAME
    }

    fn decode<'i, I>(values: &mut I) -> Option<Self>
    where
        I: Iterator<Item = &'i TypedHeaderValue>,
    {
        values.next().and_then(|value| {
            value
                .to_str()
                .ok()
                .map(|token| Self(token.to_owned()))
        })
    }

    fn encode<E>(&self, values: &mut E)
    where
        E: Extend<TypedHeaderValue>,
    {
        if let Ok(value) = TypedHeaderValue::from_str(&self.0) {
            values.extend(std::iter::once(value));
        }
    }
}

pub async fn claim_domain(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<ClaimRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let assertion = match crate::identity::verify(&identity.0, &state.identity_secret) {
        Ok(assertion) => assertion,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "invalid_internal_identity"})),
            )
        }
    };
    let validation = domain::validate(&request.name, "uids.app");
    if !validation.available_format {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error": "invalid_or_reserved_subdomain"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .claim_domain(
            &assertion.user_id,
            &validation.name,
            &validation.domain,
            &crate::repository::AbuseSignals {
                ip_hash: assertion.ip_hash,
                device_hash: assertion.device_hash,
                email_hash: assertion.email_hash,
            },
        )
        .await
    {
        Ok(claimed) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ClaimResponse {
                id: claimed.id,
                subdomain: claimed.subdomain,
                domain: claimed.domain,
            })),
        ),
        Err(crate::repository::RepositoryError::NotFound(reason)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Policy(reason))
        | Err(crate::repository::RepositoryError::Conflict(reason)) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::RateLimited(reason)) => (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        ),
    }
}

pub async fn account_policy(
    Json(request): Json<account::AccountPolicyRequest>,
) -> Json<account::AccountPolicyResponse> {
    Json(account::evaluate(request))
}

pub async fn claim_policy(
    Json(request): Json<claim::ClaimPolicyRequest>,
) -> Json<claim::ClaimPolicyResponse> {
    Json(claim::evaluate(request))
}

pub async fn dns_record_policy(
    Json(request): Json<dns::RecordPolicyRequest>,
) -> (StatusCode, Json<dns::RecordPolicyResponse>) {
    let result = dns::validate(request);
    let status = if result.valid {
        StatusCode::OK
    } else {
        StatusCode::UNPROCESSABLE_ENTITY
    };
    (status, Json(result))
}

pub async fn media_preflight(
    Json(request): Json<media::MediaPreflightRequest>,
) -> (StatusCode, Json<media::MediaPreflightResponse>) {
    let result = media::preflight(request);
    let status = if result.valid {
        StatusCode::OK
    } else {
        StatusCode::UNPROCESSABLE_ENTITY
    };
    (status, Json(result))
}

pub async fn session_policy(
    Json(request): Json<session::SessionPolicyRequest>,
) -> (StatusCode, Json<session::SessionPolicyResponse>) {
    let result = session::evaluate(request);
    let status = if result.valid {
        StatusCode::OK
    } else {
        StatusCode::UNAUTHORIZED
    };
    (status, Json(result))
}
