#!/bin/sh
set -eu
[ "$FLYWAY_URL" = jdbc:postgresql://postgres-test:5432/hotel_test ] || {
  echo ISOLATED_DATASOURCE_REJECTED >&2
  exit 64
}
[ "$FLYWAY_USER" = hotel_test ]
case "${1:-}" in hotel_test|hotel_legacy|hotel_adopt) db=$1;; *) exit 64;; esac
case "${2:-}" in migrate|validate|baseline|info|migrate-v1) action=$2;; *) exit 64;; esac
[ "$#" = 2 ]
export FLYWAY_URL="jdbc:postgresql://postgres-test:5432/$db"
if [ "$action" = migrate-v1 ]; then
  exec mvn -o -B -ntp -Dflyway.target=1 flyway:migrate
fi
exec mvn -o -B -ntp -Dflyway.baselineVersion=1 "flyway:$action"
