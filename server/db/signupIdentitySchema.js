// Database enforcement protects every writer, not just the public signup route.
// A row lock serializes each mailbox's writers across processes. The VOLATILE
// trigger's subsequent query sees the preceding committed writer at READ COMMITTED;
// stricter isolation levels abort conflicting writers instead of allowing duplicates.
export const signupIdentitySchema = `
  CREATE OR REPLACE FUNCTION tiwlo_signup_email_key(value TEXT)
  RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $key$
    SELECT CASE WHEN split_part(lower(btrim(value)), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(btrim(value)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      ELSE lower(btrim(value)) END
  $key$;

  CREATE OR REPLACE FUNCTION tiwlo_signup_phone_key(value TEXT)
  RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $key$
    WITH raw_digits AS (
      SELECT regexp_replace(value, '[^0-9]', '', 'g') AS digits
    ), normalized AS (
      SELECT CASE WHEN left(digits, 2) = '00' THEN substr(digits, 3) ELSE digits END AS digits
      FROM raw_digits
    )
    SELECT CASE
      WHEN digits = '' THEN NULL
      WHEN length(digits) = 14 AND left(digits, 4) = '8800'
        THEN '+880' || substr(digits, 5)
      WHEN length(digits) = 11 AND left(digits, 1) = '0'
        THEN '+880' || substr(digits, 2)
      ELSE '+' || digits
    END
    FROM normalized
  $key$;

  CREATE TABLE IF NOT EXISTS system_signup_email_locks (
    email_key TEXT PRIMARY KEY,
    generation BIGINT NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_users_signup_email ON system_users(tiwlo_signup_email_key(email));

  CREATE TABLE IF NOT EXISTS system_signup_phone_locks (
    phone_key TEXT PRIMARY KEY,
    generation BIGINT NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_users_signup_phone ON system_users(tiwlo_signup_phone_key(phone));

  CREATE TABLE IF NOT EXISTS system_signup_browsers (
    key_hash CHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE OR REPLACE FUNCTION tiwlo_guard_signup_email()
  RETURNS trigger LANGUAGE plpgsql VOLATILE AS $guard$
  DECLARE mailbox_key TEXT;
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN RETURN NEW; END IF;
    mailbox_key := tiwlo_signup_email_key(NEW.email);
    IF mailbox_key IS NULL OR mailbox_key = '' THEN
      RAISE EXCEPTION 'Email is required' USING ERRCODE = '23514';
    END IF;
    INSERT INTO system_signup_email_locks (email_key) VALUES (mailbox_key)
      ON CONFLICT (email_key) DO UPDATE
      SET generation = system_signup_email_locks.generation + 1;
    IF EXISTS (SELECT 1 FROM system_users
      WHERE tiwlo_signup_email_key(email) = mailbox_key AND id IS DISTINCT FROM NEW.id) THEN
      RAISE EXCEPTION 'An account already uses this mailbox'
        USING ERRCODE = '23505', CONSTRAINT = 'system_users_signup_email_unique';
    END IF;
    RETURN NEW;
  END
  $guard$;
  DROP TRIGGER IF EXISTS guard_signup_email ON system_users;
  CREATE TRIGGER guard_signup_email BEFORE INSERT OR UPDATE OF email ON system_users
    FOR EACH ROW EXECUTE FUNCTION tiwlo_guard_signup_email();

  CREATE OR REPLACE FUNCTION tiwlo_guard_signup_phone()
  RETURNS trigger LANGUAGE plpgsql VOLATILE AS $guard$
  DECLARE normalized_phone_key TEXT;
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN RETURN NEW; END IF;
    normalized_phone_key := tiwlo_signup_phone_key(NEW.phone);
    IF normalized_phone_key IS NULL OR normalized_phone_key = '' THEN RETURN NEW; END IF;
    INSERT INTO system_signup_phone_locks (phone_key) VALUES (normalized_phone_key)
      ON CONFLICT (phone_key) DO UPDATE
      SET generation = system_signup_phone_locks.generation + 1;
    IF EXISTS (SELECT 1 FROM system_users
      WHERE tiwlo_signup_phone_key(phone) = normalized_phone_key AND id IS DISTINCT FROM NEW.id) THEN
      RAISE EXCEPTION 'An account already uses this mobile number'
        USING ERRCODE = '23505', CONSTRAINT = 'system_users_signup_phone_unique';
    END IF;
    RETURN NEW;
  END
  $guard$;
  DROP TRIGGER IF EXISTS guard_signup_phone ON system_users;
  CREATE TRIGGER guard_signup_phone BEFORE INSERT OR UPDATE OF phone ON system_users
    FOR EACH ROW EXECUTE FUNCTION tiwlo_guard_signup_phone();
`;
