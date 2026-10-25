#!/bin/sh
set -eu
[ "$SPRING_PROFILES_ACTIVE" = isolated ]
[ "$SPRING_CONFIG_LOCATION" = classpath:/application-isolated.properties ]
[ "$SPRING_DATASOURCE_URL" = jdbc:postgresql://postgres-test:5432/hotel_test ]
[ "$SPRING_DATASOURCE_USERNAME" = hotel_test ]
[ "$SPRING_JPA_HIBERNATE_DDL_AUTO" = validate ]
java -version
mvn -version
exec mvn -o -B -ntp clean verify
