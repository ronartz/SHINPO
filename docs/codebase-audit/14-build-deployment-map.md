# 14 — Build and Deployment Map

## 1. Development Environment Build Commands
- **Frontend**: `cd frontend && npm install && npm run dev` (Vite port 5173)
- **Backend**: `cd backend && ./mvnw spring-boot:run` (Spring Boot port 8080)
- **Database**: `docker run -d --name shinpo-postgres -p 5432:5432 -e POSTGRES_DB=shinpo -e POSTGRES_PASSWORD=shinpo_dev postgres:17`
- **Rust Shield**: `cd crates/shinpo-shield && cargo run -- run`

## 2. Production Docker Multi-Container (`compose.yaml`)
- Service `postgres`: PostgreSQL 17 image with healthcheck (`pg_isready`).
- Service `backend`: Multi-stage Dockerfile (`eclipse-temurin:25-jdk-noble` build -> `eclipse-temurin:25-jre-noble` runtime).
- Service `frontend`: Multi-stage Dockerfile (`node:22-alpine` build -> `nginx:alpine` runtime on port 3000).
- Command: `docker compose up -d`

## 3. Windows Desktop Deployment
- **Architecture**: Spring Boot + Postgres run 24/7 in cloud. User runs desktop client wrapping React + Rust Shield.
- **Prerequisites on End-User Windows PC**: NONE. Zero Java, Zero Node, Zero Rust, Zero DB.
