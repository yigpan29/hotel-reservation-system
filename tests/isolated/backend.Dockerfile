FROM maven:3.9-eclipse-temurin-17@sha256:1a352420f7aba21f5ad08df31bab55f74c013fb491f1ae8ab1dd7ff9ed698584
WORKDIR /work
COPY hotel-reservation-system-backend/pom.xml ./pom.xml
COPY hotel-reservation-system-backend/src/main/java ./src/main/java
COPY hotel-reservation-system-backend/src/test/java ./src/test/java
COPY tests/isolated/application-isolated.properties ./src/main/resources/application-isolated.properties
COPY tests/isolated/backend-check.sh /checks/backend-check.sh
RUN mvn -B -ntp dependency:go-offline
RUN mvn -B -ntp -DskipTests package \
    && mvn -B -ntp dependency:get -Dartifact=org.apache.maven.surefire:surefire-junit-platform:3.2.5 \
    && mvn -B -ntp dependency:get -Dartifact=org.junit.platform:junit-platform-launcher:1.10.3
