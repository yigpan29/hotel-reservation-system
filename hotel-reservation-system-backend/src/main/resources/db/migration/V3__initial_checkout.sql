-- Additive only: legacy payments and reservations retain their original meaning.
CREATE TABLE checkouts (
    id uuid PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    room_id bigint NOT NULL REFERENCES rooms(id),
    request_key varchar(80) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    nightly_price integer NOT NULL CHECK (nightly_price > 0),
    amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 50 AND 99999999),
    currency varchar(3) NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
    stage varchar(32) NOT NULL CHECK (stage IN ('PENDING','FINALIZING','SUCCEEDED','CANCEL_REQUESTED','CANCELLED','FAILED','EXPIRED','REFUND_PENDING','REFUNDED','REFUND_FAILED')),
    payment_status varchar(40) NOT NULL DEFAULT 'not_created',
    intent_id varchar(255) UNIQUE,
    refund_id varchar(255) UNIQUE,
    reservation_id bigint UNIQUE REFERENCES reservations(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
    checked_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date > start_date),
    UNIQUE (user_id, request_key)
);
CREATE INDEX checkouts_inventory_idx ON checkouts(room_id,start_date,end_date) WHERE stage IN ('PENDING','FINALIZING');
CREATE INDEX checkouts_recovery_idx ON checkouts(checked_at) WHERE stage IN ('PENDING','FINALIZING','CANCEL_REQUESTED','REFUND_PENDING');

CREATE TABLE payment_profiles (
    id uuid PRIMARY KEY,
    user_id bigint NOT NULL UNIQUE REFERENCES users(id),
    customer_id varchar(255) UNIQUE
);
CREATE TABLE saved_payment_methods (
    id uuid PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    customer_id varchar(255) NOT NULL,
    provider_method_id varchar(255) NOT NULL UNIQUE,
    brand varchar(40) NOT NULL,
    last_four varchar(4) NOT NULL CHECK (last_four ~ '^[0-9]{4}$'),
    expiry_month integer NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year integer NOT NULL,
    consent_version varchar(40) NOT NULL,
    consented_at timestamptz NOT NULL,
    revoked_at timestamptz,
    detach_pending boolean NOT NULL DEFAULT false
);
CREATE INDEX saved_methods_owner_idx ON saved_payment_methods(user_id) WHERE revoked_at IS NULL;
ALTER TABLE checkouts ADD COLUMN save_method boolean NOT NULL DEFAULT false;
ALTER TABLE checkouts ADD COLUMN saved_method_id uuid REFERENCES saved_payment_methods(id);
ALTER TABLE checkouts ADD COLUMN customer_id varchar(255);
ALTER TABLE checkouts ADD COLUMN provider_method_id varchar(255);
ALTER TABLE checkouts ADD COLUMN consent_version varchar(40);
ALTER TABLE checkouts ADD COLUMN consented_at timestamptz;
ALTER TABLE checkouts ADD CONSTRAINT checkout_consent_check CHECK
    ((save_method AND consent_version IS NOT NULL AND consented_at IS NOT NULL) OR
     (NOT save_method AND consent_version IS NULL AND consented_at IS NULL));
