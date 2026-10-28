#!/bin/sh
set -eu
[ "$POSTGRES_DB" = hotel_test ]
for db in hotel_test hotel_adopt; do
  pg_dump -U hotel_test -d "$db" --schema-only --schema=public --no-owner --no-privileges --exclude-table=public.flyway_schema_history | sed '/^\\restrict /d; /^\\unrestrict /d; /^--/d; /^[[:space:]]*$/d' > "/tmp/$db.v2.sql"
done
diff -u /tmp/hotel_test.v2.sql /tmp/hotel_adopt.v2.sql
psql -X -At -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -f /checks/schema/preserve-after.sql > /tmp/current-values.txt
psql -X -At -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -c "SELECT sequencename || ':' || last_value::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename" > /tmp/current-sequences.txt
diff -u /tmp/legacy-values.txt /tmp/current-values.txt
diff -u /tmp/legacy-sequences.txt /tmp/current-sequences.txt
# V5 rellena el tipo solo en filas que cumplen las restricciones actuales: la de estado legacy queda intacta.
test "$(psql -X -At -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -c 'SELECT coalesce(room_type, $$<null>$$) FROM reservations ORDER BY id' | paste -sd' ' -)" = '<null> Fixture'
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -c 'SELECT version,type,success FROM flyway_schema_history ORDER BY installed_rank;'
echo V2_SCHEMA_EQUAL_AND_LEGACY_DATA_IDENTITIES_PRESERVED
