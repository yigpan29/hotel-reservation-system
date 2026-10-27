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
