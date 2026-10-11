use crate::dns::{validate, RecordPolicyRequest};
use sqlx::{postgres::PgPoolOptions, PgPool};
use uuid::Uuid;

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
             WHERE subdomain = $1
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

    pub async fn claim_domain(
        &self,
        user_id: &str,
        subdomain: &str,
        domain: &str,
        signals: &AbuseSignals,
    ) -> Result<ClaimedDomain, RepositoryError> {
        let mut transaction = self.pool.begin().await?;
        let user = sqlx::query_as::<_, (bool, Option<String>)>(
            "SELECT email_verified, free_subdomain_id
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
        if user.1.is_some() {
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
    use super::is_unique_violation;

    #[test]
    fn does_not_classify_non_database_errors_as_conflicts() {
        assert!(!is_unique_violation(&sqlx::Error::RowNotFound));
    }
}
