FROM maven:3.9-eclipse-temurin-17@sha256:1a352420f7aba21f5ad08df31bab55f74c013fb491f1ae8ab1dd7ff9ed698584
WORKDIR /work
COPY tests/isolated/maven-settings.xml /root/.m2/settings.xml
COPY hotel-reservation-system-backend/pom.xml ./pom.xml
RUN mvn -B -ntp dependency:go-offline
COPY hotel-reservation-system-backend/src/main/java ./src/main/java
COPY hotel-reservation-system-backend/src/test/java ./src/test/java
COPY hotel-reservation-system-backend/src/main/resources ./src/main/resources
COPY tests/isolated/application-isolated.properties ./src/main/resources/application-isolated.properties
COPY tests/isolated/backend-check.sh /checks/backend-check.sh
RUN mvn -B -ntp -DskipTests package \
    && mvn -B -ntp dependency:get -Dartifact=org.apache.maven.surefire:surefire-junit-platform:3.2.5 \
    && mvn -B -ntp dependency:get -Dartifact=org.junit.platform:junit-platform-launcher:1.10.3
COPY hotel-reservation-system-backend/src/main/resources/db/migration /checks/migrations
COPY tests/isolated/IsolatedFlywayCompatibilityTests.java /checks/IsolatedFlywayCompatibilityTests.java
COPY tests/isolated/LegacyHu05CompatibilityTests.java /checks/LegacyHu05CompatibilityTests.java
COPY tests/isolated/bootstrap-check.sh /checks/bootstrap-check.sh
