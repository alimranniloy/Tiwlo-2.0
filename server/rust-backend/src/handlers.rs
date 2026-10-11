use crate::{account, claim, dns, domain, state::AppState};
use axum::{extract::State, http::StatusCode, Json};
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
    })
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
