#!/bin/sh
set -eu
[ "$POSTGRES_DB" = hotel_test ]
[ "$POSTGRES_USER" = hotel_test ]
psql -X -U hotel_test -d hotel_test -v ON_ERROR_STOP=1 -f /checks/schema/notifications-demo.sql
