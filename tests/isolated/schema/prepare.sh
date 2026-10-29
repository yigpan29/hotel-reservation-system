#!/bin/sh
set -eu
[ "$POSTGRES_DB" = hotel_test ]
[ "$POSTGRES_USER" = hotel_test ]
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_test -c 'SELECT current_database(), version();'
createdb -U hotel_test hotel_legacy
createdb -U hotel_test hotel_adopt
createdb -U hotel_test hotel_demo
createdb -U hotel_test hotel_hu05
for db in hotel_legacy hotel_adopt; do
  sed '/^CREATE SCHEMA public;$/d' /checks/schema/legacy.sql | psql -X -v ON_ERROR_STOP=1 -U hotel_test -d "$db"
done
psql -X -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -f /checks/schema/fixtures.sql
pg_dump -U hotel_test -d hotel_adopt --data-only --no-owner --no-privileges > /tmp/adopt-before.sql
psql -X -At -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -f /checks/schema/preserve-before.sql > /tmp/legacy-values.txt
psql -X -At -v ON_ERROR_STOP=1 -U hotel_test -d hotel_adopt -c "SELECT sequencename || ':' || last_value::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename" > /tmp/legacy-sequences.txt
