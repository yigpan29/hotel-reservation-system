#!/bin/sh
set -eu
[ "$POSTGRES_DB" = hotel_test ]
normalize() {
  sed '/^\\restrict /d; /^\\unrestrict /d; /^--/d; /^[[:space:]]*$/d' "$1"
}
for db in hotel_test hotel_legacy hotel_adopt; do
  pg_dump -U hotel_test -d "$db" --schema-only --schema=public --no-owner --no-privileges --exclude-table=public.flyway_schema_history > "/tmp/$db.sql"
  normalize "/tmp/$db.sql" > "/tmp/$db.normalized.sql"
done
normalize /checks/schema/legacy.sql > /tmp/export.normalized.sql
diff -u /tmp/export.normalized.sql /tmp/hotel_legacy.normalized.sql
diff -u /tmp/hotel_legacy.normalized.sql /tmp/hotel_test.normalized.sql
diff -u /tmp/hotel_legacy.normalized.sql /tmp/hotel_adopt.normalized.sql
pg_dump -U hotel_test -d hotel_adopt --data-only --no-owner --no-privileges --exclude-table=public.flyway_schema_history > /tmp/adopt-after.sql
normalize /tmp/adopt-before.sql > /tmp/adopt-before.normalized.sql
normalize /tmp/adopt-after.sql > /tmp/adopt-after.normalized.sql
diff -u /tmp/adopt-before.normalized.sql /tmp/adopt-after.normalized.sql
echo 'SCHEMA_EQUAL_AND_FIXTURES_PRESERVED'
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_test -c "SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name <> 'flyway_schema_history') AS columns, (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid <> 'public.flyway_schema_history'::regclass) AS constraints;"
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_test -c 'SELECT version, type, success FROM flyway_schema_history;'
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -c 'SELECT version, type, success FROM flyway_schema_history;'
