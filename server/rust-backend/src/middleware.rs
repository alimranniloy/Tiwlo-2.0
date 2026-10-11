use crate::state::AppState;
use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::{
    net::SocketAddr,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
    request_id: String,
}

pub fn new_request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("rust-{millis}")
}

pub async fn rate_limit(
    State(state): State<AppState>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let request_id = new_request_id();
    if !state.limiter.allow(remote.ip()) {
        state
            .metrics
            .rate_limited_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        state.metrics.record_response(StatusCode::TOO_MANY_REQUESTS.as_u16());
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "rate limit exceeded",
                request_id: request_id.clone(),
            }),
        )
            .into_response();
        response.headers_mut().insert("retry-after", HeaderValue::from_static("60"));
        return response;
    }

    let mut response = next.run(request).await;
    state.metrics.record_response(response.status().as_u16());
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    response
}

pub async fn security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}
