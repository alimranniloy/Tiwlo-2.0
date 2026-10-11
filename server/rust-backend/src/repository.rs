use crate::dns::{validate, RecordPolicyRequest};
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::atomic::{AtomicU64, Ordering};
use uuid::Uuid;

const AUTH_RATE_LIMIT_MAX_ATTEMPTS: i32 = 5;
const AUTH_RATE_LIMIT_WINDOW_MS: i64 = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_LOCKOUT_MS: i64 = 15 * 60 * 1000;
static AUTH_RATE_LIMIT_FAILURES: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
pub struct Repository {
    pool: PgPool,
}

#[derive(Debug)]
pub enum RepositoryError {
    Database(sqlx::Error),
    NotFound(&'static str),
    Policy(String),
    Conflict(&'static str),
    RateLimited(&'static str),
}

impl From<sqlx::Error> for RepositoryError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

#[derive(Debug, Clone)]
pub struct DomainAvailability {
    pub subdomain: String,
    pub domain: String,
    pub available: bool,
    pub status: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ClaimedDomain {
    pub id: String,
    pub subdomain: String,
    pub domain: String,
    pub user_id: String,
}

#[derive(Debug, Clone)]
pub struct AbuseSignals {
    pub ip_hash: String,
    pub device_hash: Option<String>,
    pub email_hash: String,
}

#[derive(Debug, Clone)]
pub struct DnsRecord {
    pub id: String,
    pub record_type: String,
    pub name: String,
    pub value: String,
    pub ttl: i32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct UserSubdomain {
    pub id: String,
    pub subdomain: String,
    pub domain: String,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AuthSession {
    pub session_token: String,
    pub user_id: String,
    pub tiwi_id: Option<String>,
    pub email: Option<String>,
    pub expires_at: String,
}

#[derive(Debug, Clone)]
pub struct AuthRateLimitState {
    pub locked: bool,
    pub remaining_seconds: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct AuthRateLimitFailure {
    pub count: i32,
    pub first_attempt: i64,
    pub locked_until: Option<i64>,
    pub max_attempts: i32,
}

#[derive(Debug, Clone)]
pub struct PasswordVerification {
    pub valid: bool,
    pub rehash_performed: bool,
}

#[derive(Debug, Clone)]
pub struct OtpChallengeSession {
    pub email: String,
    pub challenge_type: String,
    pub attempts: i16,
    pub max_attempts: i16,
    pub expires_at: i64,
}

#[derive(Debug, Clone)]
pub struct OtpVerification {
    pub valid: bool,
    pub email: Option<String>,
    pub error: Option<String>,
    pub session: Option<AuthSession>,
}

#[derive(Clone, Copy)]
pub enum OtpCompletion {
    VerifyOnly,
    EnableMfa,
    VerifyEmail,
    CreateMfaSession,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OneProfileSummary {
    pub headline: Option<String>,
    pub bio: Option<String>,
    pub public_slug: Option<String>,
    pub profile_visibility: String,
    pub websites: Vec<OneProfileWebsite>,
    pub domains: Vec<OneProfileDomain>,
    pub unread_notifications: i32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OneProfileWebsite {
    pub id: String,
    pub domain: String,
    pub title: Option<String>,
    pub template_id: Option<String>,
    pub status: String,
    pub view_count: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OneProfileDomain {
    pub id: String,
    pub subdomain: String,
    pub domain: String,
    pub status: String,
}

impl Repository {
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .min_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(database_url)
            .await?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT 1").execute(&self.pool).await.map(|_| ())
    }

    pub async fn check_auth_rate_limit(
        &self,
        key_hash: &str,
    ) -> Result<AuthRateLimitState, RepositoryError> {
        let row = sqlx::query_as::<_, (Option<i64>,)>(
            "SELECT CASE
                 WHEN locked_until > CURRENT_TIMESTAMP
                 THEN CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP)))::bigint
                 ELSE NULL
             END
             FROM system_auth_rate_limits
             WHERE key_hash = $1",
        )
        .bind(key_hash)
        .fetch_optional(&self.pool)
        .await?;

        let remaining_seconds = row
            .and_then(|(seconds,)| seconds)
            .filter(|seconds| *seconds > 0);
        if remaining_seconds.is_none() {
            sqlx::query(
                "DELETE FROM system_auth_rate_limits
                 WHERE key_hash = $1
                   AND first_failure_at <= CURRENT_TIMESTAMP -
                       ($2::double precision * INTERVAL '1 millisecond')
                   AND (locked_until IS NULL OR locked_until <= CURRENT_TIMESTAMP)",
            )
            .bind(key_hash)
            .bind(AUTH_RATE_LIMIT_WINDOW_MS)
            .execute(&self.pool)
            .await?;
        }

        Ok(AuthRateLimitState {
            locked: remaining_seconds.is_some(),
            remaining_seconds,
        })
    }

    pub async fn record_auth_rate_limit_failure(
        &self,
        key_hash: &str,
    ) -> Result<AuthRateLimitFailure, RepositoryError> {
        let (count, first_attempt, locked_until) = sqlx::query_as::<_, (i32, i64, Option<i64>)>(
            "INSERT INTO system_auth_rate_limits
                (key_hash, failure_count, first_failure_at, locked_until, updated_at)
             VALUES ($1, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
             ON CONFLICT (key_hash) DO UPDATE SET
                failure_count = CASE
                    WHEN system_auth_rate_limits.first_failure_at <
                        CURRENT_TIMESTAMP - ($2::double precision * INTERVAL '1 millisecond')
                    THEN 1
                    ELSE system_auth_rate_limits.failure_count + 1
                END,
                first_failure_at = CASE
                    WHEN system_auth_rate_limits.first_failure_at <
                        CURRENT_TIMESTAMP - ($2::double precision * INTERVAL '1 millisecond')
                    THEN CURRENT_TIMESTAMP
                    ELSE system_auth_rate_limits.first_failure_at
                END,
                locked_until = CASE
                    WHEN CASE
                        WHEN system_auth_rate_limits.first_failure_at <
                            CURRENT_TIMESTAMP - ($2::double precision * INTERVAL '1 millisecond')
                        THEN 1
                        ELSE system_auth_rate_limits.failure_count + 1
                    END >= $3
                    THEN CURRENT_TIMESTAMP + ($4::double precision * INTERVAL '1 millisecond')
                    ELSE NULL
                END,
                updated_at = CURRENT_TIMESTAMP
             RETURNING failure_count,
                FLOOR(EXTRACT(EPOCH FROM first_failure_at) * 1000)::bigint,
                FLOOR(EXTRACT(EPOCH FROM locked_until) * 1000)::bigint",
        )
        .bind(key_hash)
        .bind(AUTH_RATE_LIMIT_WINDOW_MS)
        .bind(AUTH_RATE_LIMIT_MAX_ATTEMPTS)
        .bind(AUTH_RATE_LIMIT_LOCKOUT_MS)
        .fetch_one(&self.pool)
        .await?;

        if count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS {
            sqlx::query(
                "INSERT INTO system_security_events
                    (event_type, severity, subject_hash, details)
                 VALUES ('auth.brute_force_lockout', 'warning', $1,
                    jsonb_build_object('failureCount', $2))",
            )
            .bind(key_hash)
            .bind(count)
            .execute(&self.pool)
            .await?;
        }
        if AUTH_RATE_LIMIT_FAILURES.fetch_add(1, Ordering::Relaxed) % 500 == 499 {
            sqlx::query(
                "DELETE FROM system_auth_rate_limits
                 WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'",
            )
            .execute(&self.pool)
            .await?;
        }

        Ok(AuthRateLimitFailure {
            count,
            first_attempt,
            locked_until,
            max_attempts: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
        })
    }

    pub async fn clear_auth_rate_limit(&self, key_hash: &str) -> Result<(), RepositoryError> {
        sqlx::query("DELETE FROM system_auth_rate_limits WHERE key_hash = $1")
            .bind(key_hash)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_otp_challenge(
        &self,
        email: &str,
        challenge_type: &str,
        token_hash: &str,
        code_hash: &str,
        expiry_minutes: i32,
    ) -> Result<i64, RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let (expires_at,) = sqlx::query_as::<_, (i64,)>(
            "INSERT INTO system_otp_challenges
                (token_hash, email, challenge_type, code_hash, expires_at)
             VALUES ($1, $2, $3, $4,
                CURRENT_TIMESTAMP + ($5::double precision * INTERVAL '1 minute'))
             RETURNING FLOOR(EXTRACT(EPOCH FROM expires_at) * 1000)::bigint",
        )
        .bind(token_hash)
        .bind(email)
        .bind(challenge_type)
        .bind(code_hash)
        .bind(expiry_minutes)
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query("DELETE FROM system_otp_challenges WHERE expires_at < CURRENT_TIMESTAMP")
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(expires_at)
    }

    pub async fn verify_otp_challenge(
        &self,
        token_hash: &str,
        token: &str,
        input_code: &str,
        expected_type: &str,
        otp_secret: &str,
        completion: OtpCompletion,
        user_agent: &str,
    ) -> Result<OtpVerification, RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let record = sqlx::query_as::<_, (String, String, String, i16, i16, bool)>(
            "SELECT email, challenge_type, code_hash, attempts, max_attempts,
                    expires_at <= CURRENT_TIMESTAMP
             FROM system_otp_challenges
             WHERE token_hash = $1
             FOR UPDATE",
        )
        .bind(token_hash)
        .fetch_optional(&mut *transaction)
        .await?;
        let Some((email, challenge_type, code_hash, attempts, max_attempts, expired)) = record
        else {
            transaction.commit().await?;
            return Ok(OtpVerification {
                valid: false,
                email: None,
                error: Some("Invalid or expired verification session".to_owned()),
                session: None,
            });
        };

        let result = if expired {
            sqlx::query("DELETE FROM system_otp_challenges WHERE token_hash = $1")
                .bind(token_hash)
                .execute(&mut *transaction)
                .await?;
            OtpVerification {
                valid: false,
                email: None,
                error: Some("Verification code has expired. Please request a new one.".to_owned()),
                session: None,
            }
        } else if challenge_type != expected_type {
            OtpVerification {
                valid: false,
                email: None,
                error: Some("Mismatched verification context".to_owned()),
                session: None,
            }
        } else if attempts >= max_attempts {
            sqlx::query("DELETE FROM system_otp_challenges WHERE token_hash = $1")
                .bind(token_hash)
                .execute(&mut *transaction)
                .await?;
            OtpVerification {
                valid: false,
                email: None,
                error: Some(
                    "Maximum verification attempts exceeded. Please request a new code."
                        .to_owned(),
                ),
                session: None,
            }
        } else if !crate::otp::verify_code(otp_secret, token, input_code, &code_hash) {
            let (attempts, max_attempts) = sqlx::query_as::<_, (i16, i16)>(
                "UPDATE system_otp_challenges
                 SET attempts = attempts + 1
                 WHERE token_hash = $1
                 RETURNING attempts, max_attempts",
            )
            .bind(token_hash)
            .fetch_one(&mut *transaction)
            .await?;
            let remaining = (max_attempts - attempts).max(0);
            if remaining == 0 {
                sqlx::query("DELETE FROM system_otp_challenges WHERE token_hash = $1")
                    .bind(token_hash)
                    .execute(&mut *transaction)
                    .await?;
            }
            OtpVerification {
                valid: false,
                email: None,
                error: Some(format!("Invalid 6-digit code. {remaining} attempt(s) remaining.")),
                session: None,
            }
        } else {
            sqlx::query("DELETE FROM system_otp_challenges WHERE token_hash = $1")
                .bind(token_hash)
                .execute(&mut *transaction)
                .await?;
            let update = match completion {
                OtpCompletion::VerifyOnly => None,
                OtpCompletion::EnableMfa => Some(
                    "UPDATE system_users
                     SET two_factor_enabled = TRUE, email_verified = TRUE
                     WHERE email = $1",
                ),
                OtpCompletion::VerifyEmail => {
                    Some("UPDATE system_users SET email_verified = TRUE WHERE email = $1")
                }
                OtpCompletion::CreateMfaSession => None,
            };
            if let Some(update) = update {
                let updated = sqlx::query(update)
                    .bind(&email)
                    .execute(&mut *transaction)
                    .await?;
                if updated.rows_affected() != 1 {
                    OtpVerification {
                        valid: false,
                        email: None,
                        error: Some("User account not found.".to_owned()),
                        session: None,
                    }
                } else {
                    OtpVerification {
                        valid: true,
                        email: Some(email),
                        error: None,
                        session: None,
                    }
                }
            } else if matches!(completion, OtpCompletion::CreateMfaSession) {
                let token = format!(
                    "{}{}{}{}",
                    Uuid::new_v4().simple(),
                    Uuid::new_v4().simple(),
                    Uuid::new_v4().simple(),
                    Uuid::new_v4().simple()
                );
                let token_hash = hash_token(&token);
                let fingerprint = session_fingerprint(user_agent);
                let session = sqlx::query_as::<_, (String, Option<String>, Option<String>, String)>(
                    "WITH eligible_user AS (
                         SELECT id, tiwi_id, email
                         FROM system_users
                         WHERE LOWER(email) = LOWER($4)
                           AND email_verified = TRUE
                           AND two_factor_enabled = TRUE
                           AND is_banned = FALSE
                         FOR UPDATE
                     )
                     INSERT INTO system_sessions
                         (token, session_token, user_id, tiwi_id, email, ip, user_agent,
                          device_fingerprint, expires_at)
                     SELECT $1, $1, u.id, u.tiwi_id, u.email, NULL, $2, $3,
                            CURRENT_TIMESTAMP + INTERVAL '30 days'
                     FROM eligible_user u
                     RETURNING user_id, tiwi_id, email, expires_at::text",
                )
                .bind(&token_hash)
                .bind(user_agent.chars().take(512).collect::<String>())
                .bind(&fingerprint)
                .bind(&email)
                .fetch_optional(&mut *transaction)
                .await?;
                if let Some(row) = session {
                    sqlx::query(
                        "INSERT INTO system_security_events
                            (event_type, severity, user_id, subject_hash, user_agent, details)
                         VALUES ('auth.session_created', 'info', $1, NULL, NULLIF($2, ''), '{}'::jsonb)",
                    )
                    .bind(&row.0)
                    .bind(user_agent.chars().take(512).collect::<String>())
                    .execute(&mut *transaction)
                    .await?;
                    OtpVerification {
                        valid: true,
                        email: Some(email),
                        error: None,
                        session: Some(AuthSession {
                            session_token: token,
                            user_id: row.0,
                            tiwi_id: row.1,
                            email: row.2,
                            expires_at: row.3,
                        }),
                    }
                } else {
                    OtpVerification {
                        valid: false,
                        email: None,
                        error: Some("Account is not eligible to complete two-step login.".to_owned()),
                        session: None,
                    }
                }
            } else {
                OtpVerification {
                    valid: true,
                    email: Some(email),
                    error: None,
                    session: None,
                }
            }
        };
        transaction.commit().await?;
        Ok(result)
    }

    pub async fn get_otp_challenge(
        &self,
        token_hash: &str,
    ) -> Result<Option<OtpChallengeSession>, RepositoryError> {
        let row = sqlx::query_as::<_, (String, String, i16, i16, i64)>(
            "SELECT email, challenge_type, attempts, max_attempts,
                    FLOOR(EXTRACT(EPOCH FROM expires_at) * 1000)::bigint
             FROM system_otp_challenges
             WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(
            |(email, challenge_type, attempts, max_attempts, expires_at)| OtpChallengeSession {
                email,
                challenge_type,
                attempts,
                max_attempts,
                expires_at,
            },
        ))
    }

    pub async fn delete_otp_challenge(&self, token_hash: &str) -> Result<(), RepositoryError> {
        sqlx::query("DELETE FROM system_otp_challenges WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_auth_grant(
        &self,
        email: &str,
        grant_type: &str,
        token_hash: &str,
        expiry_minutes: i32,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO system_otp_challenges
                (token_hash, email, challenge_type, code_hash, max_attempts, expires_at)
             VALUES ($1, $2, $3, $4, 1,
                CURRENT_TIMESTAMP + ($5::double precision * INTERVAL '1 minute'))",
        )
        .bind(token_hash)
        .bind(email)
        .bind(grant_type)
        .bind(token_hash)
        .bind(expiry_minutes)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn consume_auth_grant(
        &self,
        token_hash: &str,
        grant_type: &str,
    ) -> Result<Option<String>, RepositoryError> {
        let row = sqlx::query_as::<_, (String,)>(
            "DELETE FROM system_otp_challenges
             WHERE token_hash = $1
               AND challenge_type = $2
               AND expires_at > CURRENT_TIMESTAMP
             RETURNING email",
        )
        .bind(token_hash)
        .bind(grant_type)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|(email,)| email))
    }

    pub async fn create_sso_nonce(
        &self,
        nonce_hash: &str,
        user_id: &str,
        expires_at_ms: u64,
    ) -> Result<(), RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO system_sso_nonces (nonce_hash, user_id, expires_at)
             VALUES ($1, $2, to_timestamp($3::double precision / 1000.0))",
        )
        .bind(nonce_hash)
        .bind(user_id)
        .bind(expires_at_ms as f64)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("DELETE FROM system_sso_nonces WHERE expires_at < CURRENT_TIMESTAMP")
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn consume_sso_nonce(
        &self,
        nonce_hash: &str,
        user_id: &str,
    ) -> Result<bool, RepositoryError> {
        let result = sqlx::query(
            "DELETE FROM system_sso_nonces
             WHERE nonce_hash = $1
               AND user_id = $2
               AND expires_at > CURRENT_TIMESTAMP",
        )
        .bind(nonce_hash)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn create_auth_session(
        &self,
        assertion: &crate::identity::IdentityAssertion,
        tiwi_id: Option<&str>,
        email: Option<&str>,
        user_agent: &str,
    ) -> Result<AuthSession, RepositoryError> {
        if !assertion.email_verified {
            return Err(RepositoryError::Policy(
                "email_verification_required".to_owned(),
            ));
        }
        let token = format!(
            "{}{}{}{}",
            Uuid::new_v4().simple(),
            Uuid::new_v4().simple(),
            Uuid::new_v4().simple(),
            Uuid::new_v4().simple()
        );
        let token_hash = hash_token(&token);
        let fingerprint = session_fingerprint(user_agent);
        let mut transaction = self.pool.begin().await?;
        sqlx::query("DELETE FROM system_sessions WHERE expires_at <= CURRENT_TIMESTAMP")
            .execute(&mut *transaction)
            .await?;
        let row = sqlx::query_as::<_, (String, Option<String>, Option<String>, String)>(
            "INSERT INTO system_sessions
                (token, session_token, user_id, tiwi_id, email, ip, user_agent,
                 device_fingerprint, expires_at)
             SELECT $1, $1, u.id, $2, COALESCE($3, u.email), NULL, $4, $5,
                    CURRENT_TIMESTAMP + INTERVAL '30 days'
             FROM system_users u
             WHERE u.id = $6 AND u.email_verified = TRUE AND u.is_banned = FALSE
             RETURNING user_id, tiwi_id, email, expires_at::text",
        )
        .bind(&token_hash)
        .bind(tiwi_id)
        .bind(email)
        .bind(user_agent.chars().take(512).collect::<String>())
        .bind(&fingerprint)
        .bind(&assertion.user_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(RepositoryError::NotFound("account_not_found"))?;

        if let (Some(identity_hash), Some(user_agent_hash)) = (
            assertion.identity_hash.as_deref(),
            assertion.session_user_agent_hash.as_deref(),
        ) {
            sqlx::query(
                "INSERT INTO system_user_device_identities
                    (user_id, identity_hash, device_hash, ip_hash, user_agent_hash,
                     client_hints_hash, platform_class)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_id, identity_hash) DO UPDATE SET
                    device_hash = EXCLUDED.device_hash,
                    ip_hash = EXCLUDED.ip_hash,
                    user_agent_hash = EXCLUDED.user_agent_hash,
                    client_hints_hash = EXCLUDED.client_hints_hash,
                    platform_class = EXCLUDED.platform_class,
                    last_seen_at = CURRENT_TIMESTAMP,
                    login_count = system_user_device_identities.login_count + 1",
            )
            .bind(&assertion.user_id)
            .bind(identity_hash)
            .bind(&assertion.device_hash)
            .bind(&assertion.ip_hash)
            .bind(user_agent_hash)
            .bind(&assertion.session_client_hints_hash)
            .bind(
                assertion
                    .session_platform_class
                    .as_deref()
                    .unwrap_or("unknown"),
            )
            .execute(&mut *transaction)
            .await?;
        }

        sqlx::query(
            "INSERT INTO system_security_events
                (event_type, severity, user_id, subject_hash, user_agent, details)
             VALUES ('auth.session_created', 'info', $1, NULL, NULLIF($2, ''), '{}'::jsonb)",
        )
        .bind(&assertion.user_id)
        .bind(user_agent.chars().take(512).collect::<String>())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(AuthSession {
            session_token: token,
            user_id: row.0,
            tiwi_id: row.1,
            email: row.2,
            expires_at: row.3,
        })
    }

    pub async fn resolve_auth_session(
        &self,
        token: &str,
        user_agent: &str,
    ) -> Result<Option<AuthSession>, RepositoryError> {
        let token_hash = hash_token(token);
        let row = sqlx::query_as::<
            _,
            (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ),
        >(
            "SELECT user_id, session_token, tiwi_id, email, expires_at::text,
                    device_fingerprint
             FROM system_sessions
             WHERE (session_token = $1 OR session_token = $2 OR token = $2)
               AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1",
        )
        .bind(&token_hash)
        .bind(token)
        .fetch_optional(&self.pool)
        .await?;
        let Some(row) = row else {
            return Ok(None);
        };
        let current_fingerprint = session_fingerprint(user_agent);
        if row
            .5
            .as_deref()
            .is_some_and(|stored| stored != current_fingerprint)
        {
            self.record_auth_event("auth.session_fingerprint_mismatch", &row.0, user_agent)
                .await?;
            return Ok(None);
        }
        Ok(Some(AuthSession {
            session_token: token.to_owned(),
            user_id: row.0,
            tiwi_id: row.2,
            email: row.3,
            expires_at: row.4.unwrap_or_default(),
        }))
    }

    pub async fn revoke_auth_session(&self, token: &str) -> Result<(), RepositoryError> {
        let token_hash = hash_token(token);
        let mut transaction = self.pool.begin().await?;
        let row = sqlx::query_scalar::<_, String>(
            "DELETE FROM system_sessions
             WHERE session_token = $1 OR token = $1 OR session_token = $2 OR token = $2
             RETURNING user_id",
        )
        .bind(&token_hash)
        .bind(token)
        .fetch_optional(&mut *transaction)
        .await?;
        if let Some(user_id) = row {
            sqlx::query(
                "INSERT INTO system_security_events
                    (event_type, severity, user_id, subject_hash, user_agent, details)
                 VALUES ('auth.session_revoked', 'info', $1, NULL, NULL, '{}'::jsonb)",
            )
            .bind(user_id)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub async fn revoke_user_sessions(
        &self,
        user_id: &str,
        except_token: Option<&str>,
    ) -> Result<(), RepositoryError> {
        let except_hash = except_token.map(hash_token);
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query(
            "DELETE FROM system_sessions
             WHERE user_id = $1
               AND ($2::varchar IS NULL
                    OR COALESCE(session_token, token) NOT IN ($2, $3))",
        )
        .bind(user_id)
        .bind(except_hash.as_deref())
        .bind(except_token)
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() > 0 {
            sqlx::query(
                "INSERT INTO system_security_events
                    (event_type, severity, user_id, subject_hash, user_agent, details)
                 VALUES ('auth.sessions_revoked', 'info', $1, NULL, NULL, '{}'::jsonb)",
            )
            .bind(user_id)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub async fn update_password_and_revoke_sessions(
        &self,
        user_id: &str,
        password_hash: &str,
        except_token: Option<&str>,
    ) -> Result<(), RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let updated = sqlx::query(
            "UPDATE system_users
             SET password_hash = $1, password = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2",
        )
        .bind(password_hash)
        .bind(user_id)
        .execute(&mut *transaction)
        .await?;
        if updated.rows_affected() == 0 {
            return Err(RepositoryError::NotFound("account_not_found"));
        }
        let except_hash = except_token.map(hash_token);
        sqlx::query(
            "DELETE FROM system_sessions
             WHERE user_id = $1
               AND ($2::varchar IS NULL
                    OR COALESCE(session_token, token) NOT IN ($2, $3))",
        )
        .bind(user_id)
        .bind(except_hash.as_deref())
        .bind(except_token)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO system_security_events
                (event_type, severity, user_id, subject_hash, user_agent, details)
             VALUES ('auth.password_changed', 'info', $1, NULL, NULL, '{}'::jsonb)",
        )
        .bind(user_id)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn verify_user_password(
        &self,
        user_id: &str,
        password: &str,
    ) -> Result<PasswordVerification, RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let stored_password = sqlx::query_as::<_, (Option<String>,)>(
            "SELECT COALESCE(NULLIF(password_hash, ''), password)
             FROM system_users
             WHERE id = $1
             FOR UPDATE",
        )
        .bind(user_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(RepositoryError::NotFound("account_not_found"))?
        .0;

        let Some(stored_password) = stored_password else {
            transaction.commit().await?;
            return Ok(PasswordVerification {
                valid: false,
                rehash_performed: false,
            });
        };
        let valid = crate::password::verify_password(password, &stored_password);
        let rehash_performed = valid && !stored_password.starts_with("scrypt$");
        if rehash_performed {
            let password_hash = crate::password::hash_password(password)
                .map_err(|_| RepositoryError::Policy("password_hash_unavailable".to_owned()))?;
            sqlx::query(
                "UPDATE system_users
                 SET password_hash = $1, password = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2",
            )
            .bind(password_hash)
            .bind(user_id)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(PasswordVerification {
            valid,
            rehash_performed,
        })
    }

    async fn record_auth_event(
        &self,
        event_type: &str,
        user_id: &str,
        user_agent: &str,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO system_security_events
                (event_type, severity, user_id, subject_hash, user_agent, details)
             VALUES ($1, 'warning', $2, NULL, NULLIF($3, ''), '{}'::jsonb)",
        )
        .bind(event_type)
        .bind(user_id)
        .bind(user_agent.chars().take(512).collect::<String>())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn oneprofile_summary(
        &self,
        user_id: &str,
    ) -> Result<OneProfileSummary, RepositoryError> {
        let profile = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>, String)>(
            "SELECT headline, bio, public_slug, profile_visibility
             FROM system_oneprofile_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or((None, None, None, "private".to_owned()));
        let websites = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, String, i64)>(
            "SELECT id, domain, title, template_id, status, view_count
             FROM system_oneprofile_websites WHERE user_id = $1 ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(id, domain, title, template_id, status, view_count)| OneProfileWebsite {
            id: id.to_string(), domain, title, template_id, status, view_count,
        })
        .collect();
        let domains = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT id, subdomain, domain, status
             FROM system_free_subdomains WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(id, subdomain, domain, status)| OneProfileDomain { id, subdomain, domain, status })
        .collect();
        let unread_notifications = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM system_oneprofile_notifications
             WHERE user_id = $1 AND read_at IS NULL",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await? as i32;
        Ok(OneProfileSummary {
            headline: profile.0,
            bio: profile.1,
            public_slug: profile.2,
            profile_visibility: profile.3,
            websites,
            domains,
            unread_notifications,
        })
    }

    pub async fn availability(
        &self,
        subdomain: &str,
    ) -> Result<DomainAvailability, RepositoryError> {
        let row = sqlx::query_as::<_, (String, String, String)>(
            "SELECT subdomain, domain, status
             FROM system_free_subdomains
             WHERE subdomain = $1 AND status IN ('active', 'suspended')
             LIMIT 1",
        )
        .bind(subdomain)
        .fetch_optional(&self.pool)
        .await?;

        Ok(match row {
            Some((subdomain, domain, status)) => DomainAvailability {
                subdomain,
                domain,
                available: false,
                status: Some(status),
            },
            None => DomainAvailability {
                subdomain: subdomain.to_owned(),
                domain: String::new(),
                available: true,
                status: None,
            },
        })
    }

    pub async fn availability_for_names(
        &self,
        names: &[String],
    ) -> Result<std::collections::HashMap<String, String>, RepositoryError> {
        if names.is_empty() {
            return Ok(std::collections::HashMap::new());
        }
        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT subdomain, status
             FROM system_free_subdomains
             WHERE subdomain = ANY($1::text[])
               AND status IN ('active', 'suspended')",
        )
        .bind(names)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().collect())
    }

    pub async fn list_user_subdomains(
        &self,
        user_id: &str,
    ) -> Result<Vec<UserSubdomain>, RepositoryError> {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                Option<String>,
                Option<String>,
            ),
        >(
            "SELECT id, subdomain, domain, status, created_at::text, updated_at::text
             FROM system_free_subdomains
             WHERE user_id = $1 AND status = 'active'
             ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| UserSubdomain {
                id: row.0,
                subdomain: row.1,
                domain: row.2,
                status: row.3,
                created_at: row.4,
                updated_at: row.5,
            })
            .collect())
    }

    pub async fn claim_domain(
        &self,
        user_id: &str,
        subdomain: &str,
        domain: &str,
        signals: &AbuseSignals,
    ) -> Result<ClaimedDomain, RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let user = sqlx::query_as::<_, (bool, bool, Option<String>)>(
            "SELECT email_verified, free_subdomain_claimed_at IS NOT NULL, free_subdomain_id
             FROM system_users
             WHERE id = $1
             FOR UPDATE",
        )
        .bind(user_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(RepositoryError::NotFound("account_not_found"))?;

        if !user.0 {
            return Err(RepositoryError::Policy(
                "email_verification_required".to_owned(),
            ));
        }
        if user.1 || user.2.is_some() {
            return Err(RepositoryError::Conflict("free_domain_already_used"));
        }

        let attempts = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM system_free_subdomain_claim_attempts
             WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
               AND (ip_hash = $1 OR device_hash = $2 OR email_hash = $3)
               AND outcome IN ('success', 'blocked')",
        )
        .bind(&signals.ip_hash)
        .bind(&signals.device_hash)
        .bind(&signals.email_hash)
        .fetch_one(&mut *transaction)
        .await?;
        if attempts >= 3 {
            self.record_claim_attempt(
                &mut transaction,
                user_id,
                subdomain,
                signals,
                "blocked",
                Some("risk_limit"),
            )
            .await?;
            return Err(RepositoryError::RateLimited("free_domain_risk_limit"));
        }

        let id = Uuid::new_v4().to_string();
        let insert = sqlx::query(
            "INSERT INTO system_free_subdomains
                (id, subdomain, domain, user_id, status)
             VALUES ($1, $2, $3, $4, 'active')",
        )
        .bind(&id)
        .bind(subdomain)
        .bind(domain)
        .bind(user_id)
        .execute(&mut *transaction)
        .await;

        if let Err(error) = insert {
            if is_unique_violation(&error) {
                return Err(RepositoryError::Conflict("domain_or_account_already_claimed"));
            }
            return Err(error.into());
        }

        sqlx::query(
            "UPDATE system_users
             SET free_subdomain_claimed_at = CURRENT_TIMESTAMP,
                 free_subdomain_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2",
        )
        .bind(&id)
        .bind(user_id)
        .execute(&mut *transaction)
        .await?;

        self.record_claim_attempt(
            &mut transaction,
            user_id,
            subdomain,
            signals,
            "success",
            Some("registered"),
        )
        .await?;

        transaction.commit().await?;
        Ok(ClaimedDomain {
            id,
            subdomain: subdomain.to_owned(),
            domain: domain.to_owned(),
            user_id: user_id.to_owned(),
        })
    }

    async fn record_claim_attempt(
        &self,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        user_id: &str,
        subdomain: &str,
        signals: &AbuseSignals,
        outcome: &str,
        reason: Option<&str>,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO system_free_subdomain_claim_attempts
                (user_id, subdomain, ip_hash, device_hash, email_hash, outcome, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(user_id)
        .bind(subdomain)
        .bind(&signals.ip_hash)
        .bind(&signals.device_hash)
        .bind(&signals.email_hash)
        .bind(outcome)
        .bind(reason)
        .execute(&mut **transaction)
        .await?;
        Ok(())
    }

    pub async fn list_dns_records(
        &self,
        user_id: &str,
        subdomain_id: &str,
    ) -> Result<Vec<DnsRecord>, RepositoryError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i32)>(
            "SELECT r.id, r.type, r.name, r.value, r.ttl
             FROM system_free_subdomain_records r
             JOIN system_free_subdomains d ON d.id = r.subdomain_id
             WHERE d.id = $1 AND d.user_id = $2 AND d.status = 'active'
             ORDER BY r.created_at ASC",
        )
        .bind(subdomain_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(DnsRecord::from_row).collect())
    }

    pub async fn create_dns_record(
        &self,
        user_id: &str,
        subdomain_id: &str,
        input: RecordPolicyRequest,
    ) -> Result<DnsRecord, RepositoryError> {
        let policy = validate(input);
        if !policy.valid {
            return Err(RepositoryError::Policy(
                policy
                    .error
                    .unwrap_or_else(|| "invalid_dns_record".to_owned()),
            ));
        }

        let id = format!("rec_{}", Uuid::new_v4().simple());
        let row = sqlx::query_as::<_, (String, String, String, String, i32)>(
            "INSERT INTO system_free_subdomain_records
                (id, subdomain_id, type, name, value, ttl)
             SELECT $1, id, $3, $4, $5, $6
             FROM system_free_subdomains
             WHERE id = $2 AND user_id = $7 AND status = 'active'
             RETURNING id, type, name, value, ttl",
        )
        .bind(&id)
        .bind(subdomain_id)
        .bind(&policy.record_type)
        .bind(&policy.name)
        .bind(&policy.value)
        .bind(policy.ttl as i32)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| {
            if is_unique_violation(&error) {
                RepositoryError::Conflict("dns_record_already_exists")
            } else {
                RepositoryError::Database(error)
            }
        })?;

        match row {
            Some(row) => Ok(DnsRecord::from_row(row)),
            None => Err(RepositoryError::NotFound("subdomain_not_found")),
        }
    }

    pub async fn update_dns_record(
        &self,
        user_id: &str,
        subdomain_id: &str,
        record_id: &str,
        input: RecordPolicyRequest,
    ) -> Result<DnsRecord, RepositoryError> {
        let policy = validate(input);
        if !policy.valid {
            return Err(RepositoryError::Policy(
                policy
                    .error
                    .unwrap_or_else(|| "invalid_dns_record".to_owned()),
            ));
        }

        let row = sqlx::query_as::<_, (String, String, String, String, i32)>(
            "UPDATE system_free_subdomain_records
             SET type = $1, name = $2, value = $3, ttl = $4
             WHERE id = $5 AND subdomain_id = $6
               AND EXISTS (
                 SELECT 1 FROM system_free_subdomains
                 WHERE id = $6 AND user_id = $7 AND status = 'active'
               )
             RETURNING id, type, name, value, ttl",
        )
        .bind(&policy.record_type)
        .bind(&policy.name)
        .bind(&policy.value)
        .bind(policy.ttl as i32)
        .bind(record_id)
        .bind(subdomain_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| {
            if is_unique_violation(&error) {
                RepositoryError::Conflict("dns_record_already_exists")
            } else {
                RepositoryError::Database(error)
            }
        })?;

        row.map(DnsRecord::from_row)
            .ok_or(RepositoryError::NotFound("dns_record_not_found"))
    }

    pub async fn delete_dns_record(
        &self,
        user_id: &str,
        subdomain_id: &str,
        record_id: &str,
    ) -> Result<(), RepositoryError> {
        let result = sqlx::query(
            "DELETE FROM system_free_subdomain_records r
             USING system_free_subdomains d
             WHERE r.id = $1 AND r.subdomain_id = $2
               AND d.id = r.subdomain_id AND d.user_id = $3 AND d.status = 'active'",
        )
        .bind(record_id)
        .bind(subdomain_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound("dns_record_not_found"));
        }
        Ok(())
    }
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

fn session_fingerprint(user_agent: &str) -> String {
    hex::encode(Sha256::digest(user_agent.as_bytes()))
}

impl DnsRecord {
    fn from_row(row: (String, String, String, String, i32)) -> Self {
        Self {
            id: row.0,
            record_type: row.1,
            name: row.2,
            value: row.3,
            ttl: row.4,
        }
    }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(
        error,
        sqlx::Error::Database(database_error) if database_error.code().as_deref() == Some("23505")
    )
}

#[cfg(test)]
mod tests {
    use super::{hash_token, is_unique_violation, session_fingerprint};

    #[test]
    fn does_not_classify_non_database_errors_as_conflicts() {
        assert!(!is_unique_violation(&sqlx::Error::RowNotFound));
    }

    #[test]
    fn hashes_session_tokens_to_sha256_hex() {
        assert_eq!(
            hash_token("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn fingerprints_user_agents_compatibly_with_node_sessions() {
        assert_eq!(
            session_fingerprint("test-browser"),
            "84c364d178b952600ee70706735c0c4f18320feac925ecb33e3ffefb84632063"
        );
    }
}
