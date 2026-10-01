# syntax=docker/dockerfile:1
FROM eclipse-temurin:25-jdk-noble AS builder
WORKDIR /workspace

# Cache maven wrapper and dependencies
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN ./mvnw dependency:go-offline -B || true

# Copy sources and package JAR
COPY src src
RUN ./mvnw clean package -DskipTests -B

# Runtime Image
FROM eclipse-temurin:25-jre-noble AS runner
WORKDIR /app

RUN groupadd -r shinpo && useradd -r -g shinpo -m -d /home/shinpo shinpo
USER shinpo:shinpo

COPY --from=builder /workspace/target/shinpo-*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:+ZGenerational", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
