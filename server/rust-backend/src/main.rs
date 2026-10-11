mod account;
mod audit;
mod claim;
mod config;
mod dns;
mod domain;
mod handlers;
mod identity;
mod middleware;
mod media;
mod metrics;
mod rate_limit;
mod repository;
mod session;
mod state;

use axum::{middleware::from_fn_with_state, routing::get, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

use config::Config;
use handlers::{
    account_policy, admission, claim_domain, claim_policy, create_dns_record, delete_dns_record,
    domain_availability, domain_validation, dns_record_policy, health, list_dns_records,
    media_preflight, metrics, ready, session_policy, update_dns_record,
};
use middleware::{rate_limit, security_headers};
use repository::Repository;
use state::AppState;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
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
        .route("/v1/accounts/policy", axum::routing::post(account_policy))
        .route("/v1/domains/claim-policy", axum::routing::post(claim_policy))
        .route("/v1/domains/claim", axum::routing::post(claim_domain))
        .route(
            "/v1/domains/:subdomain_id/records",
            get(list_dns_records).post(create_dns_record),
        )
        .route(
            "/v1/domains/:subdomain_id/records/:record_id",
            axum::routing::patch(update_dns_record).delete(delete_dns_record),
        )
        .route("/v1/dns/record-policy", axum::routing::post(dns_record_policy))
        .route("/v1/media/preflight", axum::routing::post(media_preflight))
        .route("/v1/auth/session-policy", axum::routing::post(session_policy))
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
