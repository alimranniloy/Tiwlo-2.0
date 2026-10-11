mod account;
mod audit;
mod claim;
mod config;
mod dns;
mod domain;
mod handlers;
mod middleware;
mod media;
mod rate_limit;
mod session;
mod state;

use axum::{middleware::from_fn_with_state, routing::get, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

use config::Config;
use handlers::{
    account_policy, admission, claim_policy, domain_validation, dns_record_policy, health,
    media_preflight, ready, session_policy,
};
use middleware::{rate_limit, security_headers};
use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_owned()))
        .init();

    let config = Config::from_env()?;
    let address: SocketAddr = config.bind.parse()?;
    let state = AppState::new(&config);

    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/v1/edge/admission", get(admission))
        .route("/v1/domains/validate", axum::routing::post(domain_validation))
        .route("/v1/accounts/policy", axum::routing::post(account_policy))
        .route("/v1/domains/claim-policy", axum::routing::post(claim_policy))
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
