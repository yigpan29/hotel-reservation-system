#!/bin/sh
set -eu
[ "$POSTGRES_DB" = hotel_test ]
[ "$POSTGRES_USER" = hotel_test ]
[ "$(psql -X -At -U hotel_test -d hotel_test -c 'select current_database()')" = hotel_test ]
psql -X -U hotel_test -d hotel_test -v ON_ERROR_STOP=1 -f /checks/schema/demand-demo.sql
