use crate::{account, claim, dns, domain, media, session, state::AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use axum_extra::{
    headers::{Error as HeaderError, Header, HeaderName, HeaderValue as TypedHeaderValue},
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
    State(state): State<AppState>,
    Json(request): Json<domain::DomainValidationRequest>,
) -> (StatusCode, Json<domain::DomainValidationResponse>) {
    let result = domain::validate(&request.name, &state.free_subdomain_domain);
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
    let validation = domain::validate(&request.name, &state.free_subdomain_domain);
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
pub struct DomainCheckQuery {
    pub name: String,
}

#[derive(Serialize)]
pub struct DomainSuggestion {
    pub name: String,
    pub domain: String,
}

#[derive(serde::Deserialize)]
pub struct CreateSessionRequest {
    pub tiwi_id: Option<String>,
    pub email: Option<String>,
    #[serde(default)]
    pub user_agent: String,
}

#[derive(serde::Deserialize)]
pub struct ResolveSessionRequest {
    pub token: String,
    #[serde(default)]
    pub user_agent: String,
}

#[derive(serde::Deserialize)]
pub struct RevokeSessionRequest {
    pub token: String,
}

#[derive(serde::Deserialize)]
pub struct RevokeDeviceSessionsRequest {
    pub user_agent: String,
}

#[derive(serde::Deserialize)]
pub struct UpdatePasswordRequest {
    pub password_hash: String,
    pub except_token: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct AuthRateLimitRequest {
    pub key_hash: String,
}

#[derive(serde::Deserialize)]
pub struct PasswordHashRequest {
    pub password: String,
}

#[derive(serde::Deserialize)]
pub struct PasswordVerifyRequest {
    pub password: String,
}

#[derive(serde::Deserialize)]
pub struct GenerateOtpRequest {
    pub email: String,
    #[serde(rename = "type")]
    pub challenge_type: String,
    pub expiry_minutes: i32,
}

#[derive(serde::Deserialize)]
pub struct VerifyOtpRequest {
    pub token: String,
    pub code: String,
    pub expected_type: String,
}

#[derive(serde::Deserialize)]
pub struct CompleteMfaSetupRequest {
    pub token: String,
    pub code: String,
}

#[derive(serde::Deserialize)]
pub struct CompleteMfaLoginRequest {
    pub token: String,
    pub code: String,
    #[serde(default)]
    pub user_agent: String,
}

#[derive(serde::Deserialize)]
pub struct OtpTokenRequest {
    pub token: String,
}

#[derive(serde::Deserialize)]
pub struct CreateGrantRequest {
    pub email: String,
    #[serde(rename = "type")]
    pub grant_type: String,
    pub expiry_minutes: i32,
}

#[derive(serde::Deserialize)]
pub struct ConsumeGrantRequest {
    pub token: String,
    #[serde(rename = "type")]
    pub grant_type: String,
}

#[derive(serde::Deserialize)]
pub struct SsoDeviceRequest {
    pub platform: String,
    pub os_version: String,
    pub device_model: String,
    pub app_version: String,
    pub network_type: String,
}

#[derive(serde::Deserialize)]
pub struct CreateSsoTicketRequest {
    pub user_id: String,
    pub tiwi_id: Option<String>,
    pub email: String,
    pub device_data: SsoDeviceRequest,
    pub app_trust_token: Option<String>,
    pub origin: String,
    pub ip: String,
    pub captured_at: String,
}

#[derive(serde::Deserialize)]
pub struct ConsumeSsoTicketRequest {
    pub sso_token: String,
    pub nonce: String,
}

fn valid_session_token(token: &str) -> bool {
    !token.is_empty() && token.len() <= 128
}

fn valid_rate_limit_hash(key_hash: &str) -> bool {
    key_hash.len() == 64
        && key_hash
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn trusted_auth_service(state: &AppState, identity: &IdentityHeader) -> bool {
    matches!(
        identity_from_header(state, identity),
        Ok(assertion) if assertion.user_id == "tiwlo-internal-auth-service"
    )
}

fn valid_otp_attributes(email: &str, challenge_type: &str, expiry_minutes: i32) -> bool {
    let normalized_email = email.trim();
    !normalized_email.is_empty()
        && normalized_email.len() <= 254
        && normalized_email.contains('@')
        && !challenge_type.is_empty()
        && challenge_type.len() <= 32
        && (1..=1440).contains(&expiry_minutes)
}

pub async fn create_sso_ticket(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CreateSsoTicketRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    let fields = [
        request.device_data.platform.as_str(),
        request.device_data.os_version.as_str(),
        request.device_data.device_model.as_str(),
        request.device_data.app_version.as_str(),
        request.device_data.network_type.as_str(),
        request.ip.as_str(),
        request.captured_at.as_str(),
    ];
    if request.user_id.is_empty()
        || request.user_id.len() > 128
        || request.email.is_empty()
        || request.email.len() > 254
        || request.origin.is_empty()
        || request.origin.len() > 64
        || request.app_trust_token.as_deref().is_some_and(|token| token.len() > 1024)
        || fields.iter().any(|field| field.len() > 256)
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_sso_ticket"})),
        );
    }
    let fingerprint = crate::sso::DeviceFingerprint {
        hash: crate::sso::fingerprint_hash(
            &request.device_data.platform,
            &request.device_data.os_version,
            &request.device_data.device_model,
            &request.device_data.app_version,
            &request.device_data.network_type,
            &request.ip,
        ),
        platform: request.device_data.platform,
        os_version: request.device_data.os_version,
        device_model: request.device_data.device_model,
        app_version: request.device_data.app_version,
        network_type: request.device_data.network_type,
        ip: request.ip,
        captured_at: request.captured_at,
    };
    let ticket = match crate::sso::create_ticket(
        &state.otp_secret,
        &state.app_trust_key,
        request.user_id,
        request.tiwi_id,
        request.email,
        fingerprint,
        request.app_trust_token.as_deref(),
        request.origin,
    ) {
        Ok(ticket) => ticket,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": error})),
            )
        }
    };
    let Ok(nonce_hash) = crate::otp::hash_token(&state.otp_secret, &ticket.payload.nonce) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "sso_ticket_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .create_sso_nonce(
            &nonce_hash,
            &ticket.payload.user_id,
            ticket.payload.expires_at,
        )
        .await
    {
        Ok(()) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "ssoToken": ticket.token,
                "nonce": ticket.payload.nonce,
                "expiresAt": ticket.payload.expires_at,
                "isAppTrusted": ticket.payload.is_app_trusted,
                "deviceFingerprint": ticket.payload.device_fingerprint
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "SSO nonce could not be persisted");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "sso_ticket_unavailable"})),
            )
        }
    }
}

pub async fn consume_sso_ticket(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<ConsumeSsoTicketRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.sso_token.is_empty()
        || request.nonce.is_empty()
        || request.nonce.len() > 128
    {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": false,
                "error": "Missing SSO token or nonce"
            })),
        );
    }
    let payload = match crate::sso::verify_ticket(
        &state.otp_secret,
        &request.sso_token,
        &request.nonce,
    ) {
        Ok(payload) => payload,
        Err(error) => {
            return (
                StatusCode::OK,
                Json(serde_json::json!({"valid": false, "error": error})),
            )
        }
    };
    let Ok(nonce_hash) = crate::otp::hash_token(&state.otp_secret, &payload.nonce) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "sso_verification_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .consume_sso_nonce(&nonce_hash, &payload.user_id)
        .await
    {
        Ok(false) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": false,
                "error": "SSO handshake is expired or has already been consumed"
            })),
        ),
        Ok(true) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": true,
                "user": {
                    "id": payload.user_id,
                    "tiwiId": payload.tiwi_id,
                    "email": payload.email
                },
                "origin": payload.origin,
                "isAppTrusted": payload.is_app_trusted,
                "deviceFingerprint": payload.device_fingerprint
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "SSO nonce could not be consumed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "sso_verification_unavailable"})),
            )
        }
    }
}

pub async fn generate_auth_otp(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<GenerateOtpRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_otp_attributes(&request.email, &request.challenge_type, request.expiry_minutes) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_otp_request"})),
        );
    }
    let Ok(generated) = crate::otp::generate_otp(&state.otp_secret) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "otp_generation_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    let email = request.email.trim().to_lowercase();
    match repository
        .create_otp_challenge(
            &email,
            &request.challenge_type,
            &generated.token_hash,
            &generated.code_hash,
            request.expiry_minutes,
        )
        .await
    {
        Ok(expires_at) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "code": generated.code,
                "token": generated.token,
                "expiresAt": expires_at
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "OTP challenge creation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "otp_service_unavailable"})),
            )
        }
    }
}

pub async fn verify_auth_otp(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<VerifyOtpRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty()
        || request.token.len() > 128
        || request.code.len() > 128
        || request.expected_type.is_empty()
        || request.expected_type.len() > 32
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_otp_request"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "otp_verification_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .verify_otp_challenge(
            &token_hash,
            &request.token,
            &request.code,
            &request.expected_type,
            &state.otp_secret,
            crate::repository::OtpCompletion::VerifyOnly,
            "",
        )
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": result.valid,
                "email": result.email,
                "error": result.error
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "OTP verification failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "otp_verification_unavailable"})),
            )
        }
    }
}

pub async fn complete_mfa_setup(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CompleteMfaSetupRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty()
        || request.token.len() > 128
        || request.code.len() > 128
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_mfa_setup_request"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "mfa_setup_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .verify_otp_challenge(
            &token_hash,
            &request.token,
            &request.code,
            "setup_2fa",
            &state.otp_secret,
            crate::repository::OtpCompletion::EnableMfa,
            "",
        )
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": result.valid,
                "email": result.email,
                "error": result.error,
                "notFound": result.error.as_deref() == Some("User account not found.")
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "MFA setup completion failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "mfa_setup_unavailable"})),
            )
        }
    }
}

pub async fn complete_email_verification(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CompleteMfaSetupRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty() || request.token.len() > 128 || request.code.len() > 128 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_email_verification_request"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "email_verification_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .verify_otp_challenge(
            &token_hash,
            &request.token,
            &request.code,
            "email_verify",
            &state.otp_secret,
            crate::repository::OtpCompletion::VerifyEmail,
            "",
        )
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": result.valid,
                "email": result.email,
                "error": result.error,
                "notFound": result.error.as_deref() == Some("User account not found.")
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "Email verification completion failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "email_verification_unavailable"})),
            )
        }
    }
}

pub async fn complete_mfa_login(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CompleteMfaLoginRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty()
        || request.token.len() > 128
        || request.code.len() > 128
        || request.user_agent.len() > 1024
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_mfa_login_request"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "mfa_login_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .verify_otp_challenge(
            &token_hash,
            &request.token,
            &request.code,
            "login_2fa",
            &state.otp_secret,
            crate::repository::OtpCompletion::CreateMfaSession,
            &request.user_agent,
        )
        .await
    {
        Ok(result) => {
            let session = result.session;
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "valid": result.valid,
                    "email": result.email,
                    "error": result.error,
                    "notFound": false,
                    "sessionToken": session.as_ref().map(|session| &session.session_token),
                    "userId": session.as_ref().map(|session| &session.user_id),
                    "tiwiId": session.as_ref().and_then(|session| session.tiwi_id.as_ref()),
                    "expiresAt": session.as_ref().map(|session| &session.expires_at)
                })),
            )
        }
        Err(error) => {
            tracing::error!(?error, "MFA login completion failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "mfa_login_unavailable"})),
            )
        }
    }
}

pub async fn get_auth_otp(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<OtpTokenRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty() || request.token.len() > 128 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_otp_token"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "otp_service_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.get_otp_challenge(&token_hash).await {
        Ok(Some(session)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "session": {
                    "email": session.email,
                    "type": session.challenge_type,
                    "attempts": session.attempts,
                    "max_attempts": session.max_attempts,
                    "expires_at": session.expires_at
                }
            })),
        ),
        Ok(None) => (
            StatusCode::OK,
            Json(serde_json::json!({"session": null})),
        ),
        Err(error) => {
            tracing::error!(?error, "OTP session lookup failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "otp_service_unavailable"})),
            )
        }
    }
}

pub async fn delete_auth_otp(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<OtpTokenRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty() || request.token.len() > 128 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_otp_token"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "otp_service_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.delete_otp_challenge(&token_hash).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(error) => {
            tracing::error!(?error, "OTP session deletion failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "otp_service_unavailable"})),
            )
        }
    }
}

pub async fn create_auth_grant(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CreateGrantRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_otp_attributes(&request.email, &request.grant_type, request.expiry_minutes) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_grant_request"})),
        );
    }
    let Ok(generated) = crate::otp::generate_grant(&state.otp_secret) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "grant_generation_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    let email = request.email.trim().to_lowercase();
    match repository
        .create_auth_grant(
            &email,
            &request.grant_type,
            &generated.token_hash,
            request.expiry_minutes,
        )
        .await
    {
        Ok(()) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"token": generated.token})),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth grant creation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "grant_service_unavailable"})),
            )
        }
    }
}

pub async fn consume_auth_grant(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<ConsumeGrantRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.is_empty()
        || request.token.len() > 128
        || request.grant_type.is_empty()
        || request.grant_type.len() > 32
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_grant_request"})),
        );
    }
    let Ok(token_hash) = crate::otp::hash_token(&state.otp_secret, &request.token) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "grant_service_unavailable"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .consume_auth_grant(&token_hash, &request.grant_type)
        .await
    {
        Ok(email) => (
            StatusCode::OK,
            Json(serde_json::json!({"email": email})),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth grant consumption failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "grant_service_unavailable"})),
            )
        }
    }
}

pub async fn hash_auth_password(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<PasswordHashRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    match crate::password::hash_password(&request.password) {
        Ok(password_hash) => (
            StatusCode::OK,
            Json(serde_json::json!({"passwordHash": password_hash})),
        ),
        Err("invalid_password") => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_password"})),
        ),
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "password_hash_unavailable"})),
        ),
    }
}

pub async fn verify_auth_password(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(user_id): Path<String>,
    Json(request): Json<PasswordVerifyRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.password.is_empty() || request.password.len() > 1024 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_password"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .verify_user_password(&user_id, &request.password)
        .await
    {
        Ok(result) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "valid": result.valid,
                "rehashPerformed": result.rehash_performed
            })),
        ),
        Err(crate::repository::RepositoryError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "account_not_found"})),
        ),
        Err(error) => {
            tracing::error!(?error, "Password verification failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "password_verification_unavailable"})),
            )
        }
    }
}

pub async fn check_auth_rate_limit(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<AuthRateLimitRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_rate_limit_hash(&request.key_hash) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_rate_limit_key"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.check_auth_rate_limit(&request.key_hash).await {
        Ok(state) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "locked": state.locked,
                "remainingSeconds": state.remaining_seconds
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth rate-limit lookup failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "auth_rate_limit_unavailable"})),
            )
        }
    }
}

pub async fn record_auth_rate_limit_failure(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<AuthRateLimitRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_rate_limit_hash(&request.key_hash) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_rate_limit_key"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .record_auth_rate_limit_failure(&request.key_hash)
        .await
    {
        Ok(failure) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "count": failure.count,
                "firstAttempt": failure.first_attempt,
                "lockedUntil": failure.locked_until,
                "maxAttempts": failure.max_attempts,
                "remainingAttempts": (failure.max_attempts - failure.count).max(0)
            })),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth rate-limit failure could not be recorded");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "auth_rate_limit_unavailable"})),
            )
        }
    }
}

pub async fn clear_auth_rate_limit(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<AuthRateLimitRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_rate_limit_hash(&request.key_hash) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_rate_limit_key"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.clear_auth_rate_limit(&request.key_hash).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(error) => {
            tracing::error!(?error, "Auth rate-limit reset failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "auth_rate_limit_unavailable"})),
            )
        }
    }
}

pub async fn create_auth_session(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<CreateSessionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = crate::identity::verify(&identity.0, &state.identity_secret) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .create_auth_session(
            &assertion,
            request.tiwi_id.as_deref(),
            request.email.as_deref(),
            &request.user_agent,
        )
        .await
    {
        Ok(session) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "sessionToken": session.session_token,
                "userId": session.user_id,
                "tiwiId": session.tiwi_id,
                "email": session.email,
                "expiresAt": session.expires_at
            })),
        ),
        Err(crate::repository::RepositoryError::Policy(_)) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "email_verification_required"})),
        ),
        Err(crate::repository::RepositoryError::NotFound(_)) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "account_not_found"})),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth session creation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn resolve_auth_session(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<ResolveSessionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_session_token(&request.token) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_session_token"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .resolve_auth_session(&request.token, &request.user_agent)
        .await
    {
        Ok(Some(session)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "authenticated": true,
                "userId": session.user_id,
                "tiwiId": session.tiwi_id,
                "email": session.email,
                "expiresAt": session.expires_at
            })),
        ),
        Ok(None) => (
            StatusCode::OK,
            Json(serde_json::json!({"authenticated": false})),
        ),
        Err(error) => {
            tracing::error!(?error, "Auth session lookup failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn revoke_auth_session(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Json(request): Json<RevokeSessionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if !valid_session_token(&request.token) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_session_token"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.revoke_auth_session(&request.token).await {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(error) => {
            tracing::error!(?error, "Auth session revocation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn revoke_user_auth_sessions(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(user_id): Path<String>,
    Json(request): Json<RevokeSessionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.token.len() > 128 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_session_token"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .revoke_user_sessions(
            &user_id,
            (!request.token.is_empty()).then_some(request.token.as_str()),
        )
        .await
    {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(error) => {
            tracing::error!(?error, "User auth session revocation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn revoke_device_auth_sessions(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(user_id): Path<String>,
    Json(request): Json<RevokeDeviceSessionsRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.user_agent.is_empty() || request.user_agent.len() > 512 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_user_agent"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .revoke_device_sessions(&user_id, &request.user_agent)
        .await
    {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(error) => {
            tracing::error!(?error, "Device auth session revocation failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn update_auth_password(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(user_id): Path<String>,
    Json(request): Json<UpdatePasswordRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !trusted_auth_service(&state, &identity) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    }
    if request.password_hash.len() > 255 || !request.password_hash.starts_with("scrypt$") {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_password_hash"})),
        );
    }
    if request
        .except_token
        .as_deref()
        .is_some_and(|token| token.len() > 128)
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "invalid_session_token"})),
        );
    }
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository
        .update_password_and_revoke_sessions(
            &user_id,
            &request.password_hash,
            request.except_token.as_deref(),
        )
        .await
    {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({"success": true}))),
        Err(crate::repository::RepositoryError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "account_not_found"})),
        ),
        Err(error) => {
            tracing::error!(?error, "Password update failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "session_service_unavailable"})),
            )
        }
    }
}

pub async fn check_domain(
    State(state): State<AppState>,
    Query(query): Query<DomainCheckQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let validation = domain::validate(&query.name, &state.free_subdomain_domain);
    if !validation.available_format && !validation.reserved {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Use 1-63 lowercase letters, numbers, or hyphens; do not start or end with a hyphen."
            })),
        );
    }

    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": "PostgreSQL is unavailable; subdomain availability requires the database."
            })),
        );
    };

    let suggestion_names = domain::candidate_names(&validation.name);
    let mut names = vec![validation.name.clone()];
    names.extend(suggestion_names.iter().cloned());
    match repository.availability_for_names(&names).await {
        Ok(occupied) => {
            let status = if validation.reserved {
                "reserved".to_owned()
            } else {
                occupied
                    .get(&validation.name)
                    .cloned()
                    .unwrap_or_else(|| "available".to_owned())
            };
            let suggestions = suggestion_names
                .into_iter()
                .filter(|name| !occupied.contains_key(name))
                .take(5)
                .map(|name| DomainSuggestion {
                    domain: format!("{name}.{}", state.free_subdomain_domain),
                    name,
                })
                .collect::<Vec<_>>();
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "name": validation.name,
                    "domain": validation.domain,
                    "available": !validation.reserved && status == "available",
                    "status": status,
                    "suggestions": suggestions
                })),
            )
        }
        Err(error) => {
            tracing::error!(?error, "Subdomain availability check failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "The subdomain availability check failed."})),
            )
        }
    }
}

pub async fn list_user_domains(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.list_user_subdomains(&assertion.user_id).await {
        Ok(domains) => {
            let nameservers = [
                format!("dns1.{}", state.primary_domain),
                format!("dns2.{}", state.primary_domain),
            ];
            let domains = domains
                .into_iter()
                .map(|domain| {
                    serde_json::json!({
                        "id": domain.id,
                        "subdomain": domain.subdomain,
                        "domain": domain.domain,
                        "status": domain.status,
                        "created_at": domain.created_at,
                        "updated_at": domain.updated_at,
                        "nameservers": nameservers
                    })
                })
                .collect::<Vec<_>>();
            (StatusCode::OK, Json(serde_json::json!({"domains": domains})))
        }
        Err(error) => {
            tracing::error!(?error, "User subdomain list failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Could not load your domains."})),
            )
        }
    }
}

pub async fn oneprofile_summary(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.oneprofile_summary(&assertion.user_id).await {
        Ok(summary) => (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "summary": summary
        }))),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "profile_not_found"})),
        ),
    }
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

#[derive(serde::Deserialize)]
pub struct DnsRecordRequest {
    #[serde(alias = "type")]
    pub record_type: String,
    pub name: String,
    pub value: String,
    #[serde(default = "default_dns_ttl")]
    pub ttl: u32,
}

fn default_dns_ttl() -> u32 {
    300
}

#[derive(Serialize)]
pub struct DnsRecordResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub record_type: String,
    pub name: String,
    pub value: String,
    pub ttl: i32,
}

fn identity_from_header(
    state: &AppState,
    identity: &IdentityHeader,
) -> Result<crate::identity::IdentityAssertion, StatusCode> {
    crate::identity::verify(&identity.0, &state.identity_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)
}

fn dns_record_response(record: crate::repository::DnsRecord) -> DnsRecordResponse {
    DnsRecordResponse {
        id: record.id,
        record_type: record.record_type,
        name: record.name,
        value: record.value,
        ttl: record.ttl,
    }
}

#[cfg(test)]
mod dns_request_tests {
    use super::{CompleteMfaLoginRequest, CompleteMfaSetupRequest, DnsRecordRequest};

    #[test]
    fn accepts_node_dns_payload_shape_and_default_ttl() {
        let request: DnsRecordRequest =
            serde_json::from_str(r#"{"type":"A","name":"@","value":"192.0.2.1"}"#)
                .expect("Node-compatible DNS payload");
        assert_eq!(request.record_type, "A");
        assert_eq!(request.ttl, 300);
    }

    #[test]
    fn accepts_node_mfa_setup_completion_payload() {
        let request: CompleteMfaSetupRequest =
            serde_json::from_str(r#"{"token":"otp-token","code":"123456"}"#)
                .expect("Node-compatible MFA payload");
        assert_eq!(request.token, "otp-token");
        assert_eq!(request.code, "123456");
    }

    #[test]
    fn accepts_node_email_verification_completion_payload() {
        let request: CompleteMfaSetupRequest =
            serde_json::from_str(r#"{"token":"otp-token","code":"123456"}"#)
                .expect("Node-compatible email verification payload");
        assert_eq!(request.token, "otp-token");
        assert_eq!(request.code, "123456");
    }

    #[test]
    fn accepts_node_mfa_login_completion_payload() {
        let request: CompleteMfaLoginRequest = serde_json::from_str(
            r#"{"token":"otp-token","code":"123456","user_agent":"test-client"}"#,
        )
        .expect("Node-compatible MFA login payload");
        assert_eq!(request.token, "otp-token");
        assert_eq!(request.code, "123456");
        assert_eq!(request.user_agent, "test-client");
    }
}

#[cfg(test)]
mod auth_session_token_tests {
    use super::{valid_rate_limit_hash, valid_session_token};

    #[test]
    fn accepts_legacy_and_rust_session_token_lengths() {
        assert!(valid_session_token(&format!("sess_{}", "a".repeat(96))));
        assert!(valid_session_token(&"a".repeat(128)));
    }

    #[test]
    fn rejects_empty_and_oversized_session_tokens() {
        assert!(!valid_session_token(""));
        assert!(!valid_session_token(&"a".repeat(129)));
    }

    #[test]
    fn validates_blinded_rate_limit_keys() {
        assert!(valid_rate_limit_hash(&"a".repeat(64)));
        assert!(!valid_rate_limit_hash(&"A".repeat(64)));
        assert!(!valid_rate_limit_hash(&"a".repeat(63)));
    }
}

pub async fn list_dns_records(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(subdomain_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    match repository.list_dns_records(&assertion.user_id, &subdomain_id).await {
        Ok(records) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "records": records.into_iter().map(dns_record_response).collect::<Vec<_>>()
            })),
        ),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "subdomain_not_found"})),
        ),
    }
}

pub async fn create_dns_record(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path(subdomain_id): Path<String>,
    Json(request): Json<DnsRecordRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    let input = dns::RecordPolicyRequest {
        record_type: request.record_type,
        name: request.name,
        value: request.value,
        ttl: request.ttl,
    };
    match repository
        .create_dns_record(&assertion.user_id, &subdomain_id, input)
        .await
    {
        Ok(record) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"record": dns_record_response(record)})),
        ),
        Err(crate::repository::RepositoryError::Policy(reason)) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Conflict(reason)) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "subdomain_not_found"})),
        ),
    }
}

pub async fn update_dns_record(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path((subdomain_id, record_id)): Path<(String, String)>,
    Json(request): Json<DnsRecordRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        );
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        );
    };
    let input = dns::RecordPolicyRequest {
        record_type: request.record_type,
        name: request.name,
        value: request.value,
        ttl: request.ttl,
    };
    match repository
        .update_dns_record(&assertion.user_id, &subdomain_id, &record_id, input)
        .await
    {
        Ok(record) => (
            StatusCode::OK,
            Json(serde_json::json!({"record": dns_record_response(record)})),
        ),
        Err(crate::repository::RepositoryError::Policy(reason)) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Conflict(reason)) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "dns_record_not_found"})),
        ),
    }
}

pub async fn delete_dns_record(
    State(state): State<AppState>,
    TypedHeader(identity): TypedHeader<IdentityHeader>,
    Path((subdomain_id, record_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let Ok(assertion) = identity_from_header(&state, &identity) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid_internal_identity"})),
        )
            .into_response();
    };
    let Some(repository) = state.repository.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_unavailable"})),
        )
            .into_response();
    };
    match repository
        .delete_dns_record(&assertion.user_id, &subdomain_id, &record_id)
        .await
    {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(crate::repository::RepositoryError::Database(_)) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "database_error"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "dns_record_not_found"})),
        )
            .into_response(),
    }
}

#[derive(Clone, Debug)]
pub struct IdentityHeader(pub String);

impl Header for IdentityHeader {
    fn name() -> &'static HeaderName {
        static NAME: HeaderName = HeaderName::from_static("x-tiwlo-identity");
        &NAME
    }

    fn decode<'i, I>(values: &mut I) -> Result<Self, HeaderError>
    where
        I: Iterator<Item = &'i TypedHeaderValue>,
    {
        values
            .next()
            .ok_or_else(HeaderError::invalid)?
            .to_str()
            .map(|token| Self(token.to_owned()))
            .map_err(|_| HeaderError::invalid())
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
    let validation = domain::validate(&request.name, &state.free_subdomain_domain);
    if !validation.available_format {
        if validation.reserved {
            return (
                StatusCode::CONFLICT,
                Json(serde_json::json!({
                    "error": "This subdomain is reserved by the platform.",
                    "code": "SUBDOMAIN_RESERVED"
                })),
            );
        }
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Use 1-63 lowercase letters, numbers, or hyphens; do not start or end with a hyphen."
            })),
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
        Err(crate::repository::RepositoryError::NotFound("account_not_found")) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Your account could not be verified.",
                "code": "ACCOUNT_NOT_FOUND"
            })),
        ),
        Err(crate::repository::RepositoryError::Policy(reason))
            if reason == "email_verification_required" =>
        (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Verify your email before claiming a free domain.",
                "code": "EMAIL_VERIFICATION_REQUIRED"
            })),
        ),
        Err(crate::repository::RepositoryError::Conflict("free_domain_already_used")) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "This account has already used its one free domain allowance.",
                "code": "FREE_DOMAIN_ALREADY_USED"
            })),
        ),
        Err(crate::repository::RepositoryError::Conflict(_)) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "This subdomain is already registered.",
                "code": "SUBDOMAIN_ALREADY_REGISTERED"
            })),
        ),
        Err(crate::repository::RepositoryError::RateLimited(reason)) => (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "error": "Too many free-domain attempts from this account or device. Try again later.",
                "code": reason
            })),
        ),
        Err(crate::repository::RepositoryError::NotFound(reason)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": reason})),
        ),
        Err(crate::repository::RepositoryError::Policy(reason)) => (
            StatusCode::CONFLICT,
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
