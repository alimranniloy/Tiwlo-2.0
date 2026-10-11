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
    Policy(&'static str),
    Conflict(&'static str),
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
            return Err(RepositoryError::Policy("email_verification_required"));
        }
        if user.1.is_some() {
            return Err(RepositoryError::Conflict("free_domain_already_used"));
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

        transaction.commit().await?;
        Ok(ClaimedDomain {
            id,
            subdomain: subdomain.to_owned(),
            domain: domain.to_owned(),
            user_id: user_id.to_owned(),
        })
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
