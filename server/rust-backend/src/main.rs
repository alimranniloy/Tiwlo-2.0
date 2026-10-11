use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    env,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

const SERVICE_NAME: &str = "tiwlo-rust-backend";

#[derive(Clone)]
struct AppState {
    started_at: Instant,
    limiter: Arc<RateLimiter>,
    node_backend_url: String,
}

#[derive(Default)]
struct RateLimiter {
    windows: Mutex<HashMap<IpAddr, Window>>,
    limit: u32,
    window: Duration,
}

struct Window {
    started_at: Instant,
    requests: u32,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    uptime_seconds: u64,
}

#[derive(Serialize)]
struct ReadinessResponse {
    status: &'static str,
    service: &'static str,
    node_backend_configured: bool,
}

#[derive(Serialize)]
struct AdmissionResponse {
    allowed: bool,
    service: &'static str,
    request_id: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
    request_id: String,
}

impl RateLimiter {
    fn new(limit: u32, window: Duration) -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
            limit,
            window,
        }
    }

    fn allow(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut windows = self.windows.lock().expect("rate limiter mutex poisoned");
        let entry = windows.entry(ip).or_insert(Window {
            started_at: now,
            requests: 0,
        });

        if now.duration_since(entry.started_at) >= self.window {
            entry.started_at = now;
            entry.requests = 0;
        }

        if entry.requests >= self.limit {
            return false;
        }
        entry.requests += 1;
        true
    }
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: SERVICE_NAME,
        uptime_seconds: state.started_at.elapsed().as_secs(),
    })
}

async fn ready(State(state): State<AppState>) -> Json<ReadinessResponse> {
    Json(ReadinessResponse {
        status: "ready",
        service: SERVICE_NAME,
        node_backend_configured: !state.node_backend_url.is_empty(),
    })
}

async fn admission(State(_state): State<AppState>) -> impl IntoResponse {
    let request_id = request_id();
    Json(AdmissionResponse {
        allowed: true,
        service: SERVICE_NAME,
        request_id,
    })
}

async fn rate_limit(
    State(state): State<AppState>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let request_id = request_id();
    if !state.limiter.allow(remote.ip()) {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "rate limit exceeded",
                request_id: request_id.clone(),
            }),
        )
            .into_response();
        response.headers_mut().insert(
            "retry-after",
            HeaderValue::from_static("60"),
        );
        return response;
    }

    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    response
}

async fn security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store"),
    );
    response
}

fn request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("rust-{millis}")
}

fn env_u32(name: &str, default: u32) -> u32 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "info".to_owned()))
        .init();

    let bind = env::var("TIWLO_RUST_BIND").unwrap_or_else(|_| "127.0.0.1:7100".to_owned());
    let address: SocketAddr = bind.parse()?;
    let state = AppState {
        started_at: Instant::now(),
        limiter: Arc::new(RateLimiter::new(
            env_u32("TIWLO_RUST_RATE_LIMIT", 120),
            Duration::from_secs(60),
        )),
        node_backend_url: env::var("TIWLO_NODE_BACKEND_URL").unwrap_or_default(),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/v1/edge/admission", get(admission))
        .with_state(state.clone())
        .layer(middleware::from_fn(security_headers))
        .layer(middleware::from_fn_with_state(state, rate_limit))
        .layer(RequestBodyLimitLayer::new(1024 * 1024))
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
