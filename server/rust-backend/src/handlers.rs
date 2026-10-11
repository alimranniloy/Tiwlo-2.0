use crate::{account, claim, dns, domain, media, session, state::AppState};
use axum::{
    extract::State,
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
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
