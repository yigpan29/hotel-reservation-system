-- Additive provenance only. No changes to existing reservations, users or V1/V2.
CREATE TABLE reservation_demo_batches (
    id uuid PRIMARY KEY,
    code varchar(100) NOT NULL UNIQUE,
    algorithm varchar(40) NOT NULL,
    reference_date date NOT NULL,
    seed bigint NOT NULL,
    weeks integer NOT NULL CHECK (weeks BETWEEN 8 AND 16),
    history_start date NOT NULL,
    history_end date NOT NULL,
    technical_user_id bigint REFERENCES users(id),
    technical_username varchar(40) NOT NULL,
    technical_user_hash varchar(32) NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('ACTIVE','REVERTED')),
    reservation_count integer NOT NULL DEFAULT 0 CHECK (reservation_count>=0),
    created_at timestamp with time zone NOT NULL DEFAULT current_timestamp,
    reverted_at timestamp with time zone,
    CHECK (history_end>=history_start),
    CHECK ((status='ACTIVE' AND technical_user_id IS NOT NULL AND reverted_at IS NULL)
        OR (status='REVERTED' AND technical_user_id IS NULL AND reverted_at IS NOT NULL))
);
CREATE TABLE reservation_demo_items (
    batch_id uuid NOT NULL REFERENCES reservation_demo_batches(id),
    item_key varchar(100) NOT NULL,
    reservation_id bigint NOT NULL UNIQUE REFERENCES reservations(id),
    original_row_hash varchar(32) NOT NULL,
    PRIMARY KEY(batch_id,item_key)
);
