-- Explicit compatibility lineage: HU03 V3 and HU05 V4 remain unchanged.
-- Existing reservations never recorded guests or their agreed room type.
ALTER TABLE rooms ADD COLUMN capacity integer NOT NULL DEFAULT 2;
ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_check CHECK (capacity BETWEEN 1 AND 10);
UPDATE rooms SET capacity = CASE type
    WHEN 'Individual' THEN 1 WHEN 'Deluxe' THEN 3
    WHEN 'Familiar' THEN 4 WHEN 'Suite' THEN 4 ELSE 2 END;
ALTER TABLE reservations ADD COLUMN adults integer;
ALTER TABLE reservations ADD COLUMN children integer;
ALTER TABLE reservations ADD COLUMN room_type varchar(255);
ALTER TABLE reservations ADD CONSTRAINT reservations_guests_check CHECK (
    (adults IS NULL AND children IS NULL)
    OR (adults BETWEEN 1 AND 20 AND children BETWEEN 0 AND 20));
