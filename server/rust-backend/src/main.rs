mod account;
mod audit;
mod claim;
mod config;
mod dns;
mod domain;
mod handlers;
mod identity;
mod middleware;
mod otp;
mod password;
mod media;
mod metrics;
mod rate_limit;
mod repository;
mod session;
mod sso;
mod state;

use axum::{middleware::from_fn_with_state, routing::get, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

use config::Config;
use handlers::{
    account_policy, admission, check_auth_rate_limit, check_domain, claim_domain, claim_policy,
    clear_auth_rate_limit, complete_email_verification, complete_mfa_login, complete_mfa_setup,
    consume_auth_grant, consume_sso_ticket,
    create_auth_grant, create_auth_session, create_dns_record, create_sso_ticket, delete_auth_otp,
    delete_dns_record, dns_record_policy, domain_availability, domain_validation,
    generate_auth_otp, get_auth_otp, hash_auth_password, health, list_dns_records,
    list_user_domains, media_preflight, metrics, oneprofile_summary, ready,
    record_auth_rate_limit_failure, resolve_auth_session, revoke_auth_session,
    revoke_device_auth_sessions,
    revoke_user_auth_sessions, session_policy, update_auth_password, update_dns_record,
    verify_auth_otp, verify_auth_password,
};
use middleware::{rate_limit, security_headers};
use repository::Repository;
use state::AppState;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::path::Path::new(".env").is_file() {
        dotenvy::dotenv()?;
    }
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_owned()))
        .init();

    let config = Config::from_env()?;
    let address: SocketAddr = config.bind.parse()?;
    let repository = if config.postgres_url.is_empty() {
        None
    } else {
        Some(Arc::new(Repository::connect(&config.postgres_url).await?))
    };
    let state = AppState::new(&config, repository);

    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/metrics", get(metrics))
        .route("/v1/edge/admission", get(admission))
        .route("/v1/domains/validate", axum::routing::post(domain_validation))
        .route("/v1/domains/availability", axum::routing::post(domain_availability))
        .route("/v1/domains/check", get(check_domain))
        .route("/v1/accounts/policy", axum::routing::post(account_policy))
        .route("/v1/domains/claim-policy", axum::routing::post(claim_policy))
        .route("/v1/domains/claim", axum::routing::post(claim_domain))
        .route("/v1/domains", get(list_user_domains))
        .route(
            "/v1/domains/{subdomain_id}/records",
            get(list_dns_records).post(create_dns_record),
        )
        .route(
            "/v1/domains/{subdomain_id}/records/{record_id}",
            axum::routing::patch(update_dns_record).delete(delete_dns_record),
        )
        .route("/v1/dns/record-policy", axum::routing::post(dns_record_policy))
        .route("/v1/media/preflight", axum::routing::post(media_preflight))
        .route("/v1/auth/session-policy", axum::routing::post(session_policy))
        .route("/v1/auth/sessions", axum::routing::post(create_auth_session))
        .route(
            "/v1/auth/passwords/hash",
            axum::routing::post(hash_auth_password),
        )
        .route(
            "/v1/auth/users/{user_id}/password/verify",
            axum::routing::post(verify_auth_password),
        )
        .route("/v1/auth/otp", axum::routing::post(generate_auth_otp))
        .route("/v1/auth/otp/verify", axum::routing::post(verify_auth_otp))
        .route(
            "/v1/auth/mfa/setup/complete",
            axum::routing::post(complete_mfa_setup),
        )
        .route(
            "/v1/auth/mfa/login/complete",
            axum::routing::post(complete_mfa_login),
        )
        .route(
            "/v1/auth/email/verify",
            axum::routing::post(complete_email_verification),
        )
        .route(
            "/v1/auth/otp/session/get",
            axum::routing::post(get_auth_otp),
        )
        .route(
            "/v1/auth/otp/session/delete",
            axum::routing::post(delete_auth_otp),
        )
        .route("/v1/auth/grants", axum::routing::post(create_auth_grant))
        .route("/v1/auth/grants/consume", axum::routing::post(consume_auth_grant))
        .route(
            "/v1/auth/sso/tickets",
            axum::routing::post(create_sso_ticket),
        )
        .route(
            "/v1/auth/sso/tickets/consume",
            axum::routing::post(consume_sso_ticket),
        )
        .route(
            "/v1/auth/rate-limits/check",
            axum::routing::post(check_auth_rate_limit),
        )
        .route(
            "/v1/auth/rate-limits/failure",
            axum::routing::post(record_auth_rate_limit_failure),
        )
        .route(
            "/v1/auth/rate-limits/clear",
            axum::routing::post(clear_auth_rate_limit),
        )
        .route("/v1/auth/sessions/resolve", axum::routing::post(resolve_auth_session))
        .route("/v1/auth/sessions/revoke", axum::routing::post(revoke_auth_session))
        .route(
            "/v1/auth/users/{user_id}/sessions/revoke",
            axum::routing::post(revoke_user_auth_sessions),
        )
        .route(
            "/v1/auth/users/{user_id}/sessions/revoke-device",
            axum::routing::post(revoke_device_auth_sessions),
        )
        .route(
            "/v1/auth/users/{user_id}/password",
            axum::routing::put(update_auth_password),
        )
        .route("/v1/oneprofile/summary", axum::routing::get(oneprofile_summary))
        .with_state(state.clone())
        .layer(axum::middleware::from_fn(security_headers))
        .layer(from_fn_with_state(state, rate_limit))
        .layer(RequestBodyLimitLayer::new(config.max_body_bytes))
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind(address).await?;
    tracing::info!(%address, "Tiwlo Rust backend listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
