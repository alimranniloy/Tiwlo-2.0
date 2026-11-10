export const PICK_DELIVERY_REVIEW_SCHEMA_SQL = `
  ALTER TABLE pick.delivery_profiles
    ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(64)
      REFERENCES system_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
`;

export const PICK_SCHEMA_SQL = `
  CREATE SCHEMA IF NOT EXISTS pick;

  CREATE TABLE IF NOT EXISTS pick.users (
    tiwlo_user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
    registration_source VARCHAR(32) NOT NULL DEFAULT 'tiwlo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.users
    ADD COLUMN IF NOT EXISTS registration_source VARCHAR(32) NOT NULL DEFAULT 'tiwlo';

  CREATE TABLE IF NOT EXISTS pick.profiles (
    tiwlo_user_id VARCHAR(64) PRIMARY KEY REFERENCES pick.users(tiwlo_user_id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    phone VARCHAR(64),
    delivery_address TEXT,
    delivery_latitude DOUBLE PRECISION,
    delivery_longitude DOUBLE PRECISION,
    delivery_accuracy DOUBLE PRECISION,
    delivery_area VARCHAR(255),
    delivery_postal_code VARCHAR(32),
    delivery_plus_code VARCHAR(128),
    delivery_place_id VARCHAR(255),
    delivery_address_verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.profiles
    ADD COLUMN IF NOT EXISTS delivery_place_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS delivery_address_verified_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS pick.address_verifications (
    token_hash CHAR(64) PRIMARY KEY,
    tiwlo_user_id VARCHAR(64) REFERENCES pick.users(tiwlo_user_id) ON DELETE CASCADE,
    input_address TEXT NOT NULL,
    formatted_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    area VARCHAR(255) NOT NULL,
    postal_code VARCHAR(32) NOT NULL,
    plus_code VARCHAR(128) NOT NULL,
    place_id VARCHAR(255) NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.address_verifications
    ADD COLUMN IF NOT EXISTS tiwlo_user_id VARCHAR(64) REFERENCES pick.users(tiwlo_user_id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS pick_address_verifications_expiry_idx
    ON pick.address_verifications(expires_at);

  CREATE TABLE IF NOT EXISTS pick.pending_auth_addresses (
    token_hash CHAR(64) PRIMARY KEY,
    tiwlo_user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    location JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS pick_pending_auth_addresses_expiry_idx
    ON pick.pending_auth_addresses(expires_at);

  CREATE TABLE IF NOT EXISTS pick.coverage_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en VARCHAR(128) NOT NULL,
    name_bn VARCHAR(128) NOT NULL,
    center_latitude DOUBLE PRECISION NOT NULL CHECK (center_latitude BETWEEN -90 AND 90),
    center_longitude DOUBLE PRECISION NOT NULL CHECK (center_longitude BETWEEN -180 AND 180),
    radius_meters INTEGER NOT NULL CHECK (radius_meters BETWEEN 100 AND 50000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS pick_coverage_zones_active_idx
    ON pick.coverage_zones(active);

  CREATE TABLE IF NOT EXISTS pick.coverage_waitlist (
    tiwlo_user_id VARCHAR(64) PRIMARY KEY REFERENCES pick.users(tiwlo_user_id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(64) NOT NULL DEFAULT '',
    delivery_address TEXT NOT NULL,
    delivery_area VARCHAR(255) NOT NULL DEFAULT '',
    delivery_latitude DOUBLE PRECISION NOT NULL,
    delivery_longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pick.categories (
    id VARCHAR(64) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    group_en VARCHAR(128) NOT NULL DEFAULT '',
    group_bn VARCHAR(128) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.categories
    ADD COLUMN IF NOT EXISTS group_en VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS group_bn VARCHAR(128) NOT NULL DEFAULT '';

  CREATE TABLE IF NOT EXISTS pick.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(64) REFERENCES pick.categories(id) ON DELETE SET NULL,
    sku VARCHAR(128) UNIQUE,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    description_en TEXT NOT NULL DEFAULT '',
    description_bn TEXT NOT NULL DEFAULT '',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    old_price NUMERIC(12, 2) CHECK (old_price IS NULL OR old_price >= 0),
    unit_en VARCHAR(128) NOT NULL,
    unit_bn VARCHAR(128) NOT NULL,
    units_en JSONB NOT NULL DEFAULT '[]'::jsonb,
    units_bn JSONB NOT NULL DEFAULT '[]'::jsonb,
    unit_prices JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT NOT NULL DEFAULT '',
    origin VARCHAR(255) NOT NULL DEFAULT '',
    delivery_time VARCHAR(64) NOT NULL DEFAULT '',
    reviews_count VARCHAR(32) NOT NULL DEFAULT '',
    badge VARCHAR(64),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS pick_products_category_active_idx
    ON pick.products(category_id, active, name_en);

  CREATE TABLE IF NOT EXISTS pick.parcel_vehicles (
    id VARCHAR(64) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    eta_minutes INTEGER NOT NULL CHECK (eta_minutes > 0),
    max_weight_kg NUMERIC(10, 2) NOT NULL CHECK (max_weight_kg > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    icon VARCHAR(32) NOT NULL DEFAULT 'scooter',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pick.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tiwlo_user_id VARCHAR(64) NOT NULL REFERENCES pick.users(tiwlo_user_id),
    order_type VARCHAR(16) NOT NULL CHECK (order_type IN ('grocery', 'parcel')),
    status VARCHAR(32) NOT NULL DEFAULT 'placed',
    delivery_address TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(12, 2) NOT NULL CHECK (delivery_fee >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    payment_method VARCHAR(32) NOT NULL,
    payment_status VARCHAR(24) NOT NULL DEFAULT 'unpaid',
    payment_provider VARCHAR(32),
    payment_mode VARCHAR(16),
    provider_payment_id VARCHAR(255),
    payment_transaction_id VARCHAR(255),
    payment_return_token_hash CHAR(64),
    payment_expires_at TIMESTAMPTZ,
    inventory_released BOOLEAN NOT NULL DEFAULT FALSE,
    parcel_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_latitude DOUBLE PRECISION CHECK (delivery_latitude IS NULL OR delivery_latitude BETWEEN -90 AND 90),
    delivery_longitude DOUBLE PRECISION CHECK (delivery_longitude IS NULL OR delivery_longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.orders
    ADD COLUMN IF NOT EXISTS parcel_details JSONB NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE pick.orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(24) NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(32),
    ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(16),
    ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_return_token_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inventory_released BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
  UPDATE pick.orders o
  SET delivery_latitude = p.delivery_latitude,
      delivery_longitude = p.delivery_longitude
  FROM pick.profiles p
  WHERE o.order_type = 'grocery'
    AND o.tiwlo_user_id = p.tiwlo_user_id
    AND (o.delivery_latitude IS NULL OR o.delivery_longitude IS NULL)
    AND p.delivery_latitude IS NOT NULL
    AND p.delivery_longitude IS NOT NULL;
  CREATE INDEX IF NOT EXISTS pick_orders_user_created_idx
    ON pick.orders(tiwlo_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS pick_orders_pending_payment_expiry_idx
    ON pick.orders(payment_expires_at) WHERE payment_status = 'pending';
  CREATE INDEX IF NOT EXISTS pick_orders_stale_pending_idx
    ON pick.orders(created_at)
    WHERE status IN ('pending', 'pending_payment') OR payment_status IN ('pending', 'expired');

  CREATE TABLE IF NOT EXISTS pick.delivery_vehicle_policies (
    vehicle_type VARCHAR(32) PRIMARY KEY,
    name_en VARCHAR(64) NOT NULL,
    max_capacity_kg NUMERIC(10, 2) NOT NULL CHECK (max_capacity_kg > 0),
    pickup_range_meters INTEGER NOT NULL CHECK (pickup_range_meters BETWEEN 100 AND 100000),
    delivery_range_meters INTEGER NOT NULL CHECK (delivery_range_meters BETWEEN 100 AND 200000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO pick.delivery_vehicle_policies
    (vehicle_type, name_en, max_capacity_kg, pickup_range_meters, delivery_range_meters)
  VALUES
    ('walking', 'Walking', 10, 1500, 6000),
    ('bicycle', 'Bicycle', 25, 4000, 12000),
    ('motorbike', 'Motorbike', 35, 8000, 25000),
    ('car', 'Car', 150, 12000, 40000),
    ('pickup', 'Pickup truck', 500, 15000, 50000)
  ON CONFLICT (vehicle_type) DO NOTHING;

  CREATE TABLE IF NOT EXISTS pick.delivery_profiles (
    tiwlo_user_id VARCHAR(64) PRIMARY KEY REFERENCES pick.users(tiwlo_user_id) ON DELETE CASCADE,
    vehicle_type VARCHAR(32) NOT NULL REFERENCES pick.delivery_vehicle_policies(vehicle_type),
    vehicle_capacity_kg NUMERIC(10, 2) NOT NULL CHECK (vehicle_capacity_kg > 0),
    vehicle_registration VARCHAR(80) NOT NULL DEFAULT '',
    application_status VARCHAR(16) NOT NULL DEFAULT 'pending'
      CHECK (application_status IN ('pending', 'approved', 'rejected')),
    application_note TEXT NOT NULL DEFAULT '',
    reviewed_by VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    is_on_duty BOOLEAN NOT NULL DEFAULT FALSE,
    current_latitude DOUBLE PRECISION CHECK (current_latitude IS NULL OR current_latitude BETWEEN -90 AND 90),
    current_longitude DOUBLE PRECISION CHECK (current_longitude IS NULL OR current_longitude BETWEEN -180 AND 180),
    current_accuracy DOUBLE PRECISION,
    current_location_at TIMESTAMPTZ,
    expo_push_token VARCHAR(255),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ${PICK_DELIVERY_REVIEW_SCHEMA_SQL}
  CREATE INDEX IF NOT EXISTS pick_delivery_profiles_duty_idx
    ON pick.delivery_profiles(vehicle_type, application_status, is_on_duty, current_location_at);

  CREATE TABLE IF NOT EXISTS pick.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pick.orders(id) ON DELETE CASCADE,
    rider_user_id VARCHAR(64) NOT NULL REFERENCES pick.delivery_profiles(tiwlo_user_id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL DEFAULT 'accepted'
      CHECK (status IN ('accepted', 'picked_up', 'delivered', 'cancelled')),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE pick.delivery_assignments
    DROP CONSTRAINT IF EXISTS delivery_assignments_order_id_key;
  CREATE UNIQUE INDEX IF NOT EXISTS pick_delivery_assignments_order_active_idx
    ON pick.delivery_assignments(order_id) WHERE status <> 'cancelled';
  CREATE INDEX IF NOT EXISTS pick_delivery_assignments_rider_active_idx
    ON pick.delivery_assignments(rider_user_id, status)
    WHERE status IN ('accepted', 'picked_up');

  CREATE TABLE IF NOT EXISTS pick.settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pick.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pick.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES pick.products(id) ON DELETE SET NULL,
    product_name_en VARCHAR(255) NOT NULL,
    product_name_bn VARCHAR(255) NOT NULL,
    product_image_url TEXT NOT NULL DEFAULT '',
    unit_en VARCHAR(128) NOT NULL,
    unit_bn VARCHAR(128) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
  );
  ALTER TABLE pick.order_items
    ADD COLUMN IF NOT EXISTS product_image_url TEXT NOT NULL DEFAULT '';
  UPDATE pick.order_items i
  SET product_image_url = p.image_url
  FROM pick.products p
  WHERE i.product_id = p.id AND i.product_image_url = '' AND p.image_url <> '';

  CREATE TABLE IF NOT EXISTS pick.mobile_sso_handoffs (
    code_hash CHAR(64) PRIMARY KEY,
    tiwlo_user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    code_challenge CHAR(43) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS pick_mobile_sso_handoffs_expiry_idx
    ON pick.mobile_sso_handoffs(expires_at);

  CREATE TABLE IF NOT EXISTS pick.account_appeal_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    tiwlo_user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS pick_account_appeal_sessions_expiry_idx
    ON pick.account_appeal_sessions(expires_at);
`;
