FROM rust:1.99-bookworm AS builder

WORKDIR /build
COPY server/rust-backend/Cargo.toml ./server/rust-backend/
COPY server/rust-backend/Cargo.lock ./server/rust-backend/
COPY server/rust-backend/src ./server/rust-backend/src
WORKDIR /build/server/rust-backend
RUN cargo build --release

FROM debian:bookworm-slim AS runner

RUN apt-get update \
    && apt-get install --no-install-recommends --yes ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/server/rust-backend/target/release/tiwlo-rust-backend /usr/local/bin/tiwlo-rust-backend

USER 65532:65532
EXPOSE 7100
ENTRYPOINT ["/usr/local/bin/tiwlo-rust-backend"]
