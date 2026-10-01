# 12 — Configuration & Environment Map

Comprehensive matrix of environment variables, application properties, and secrets.

| Property / Variable | Source Location | Default Value | Consumption / Purpose | Production Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `POSTGRES_PASSWORD` | `application.properties` | `shinpo_dev` | PostgreSQL datasource connection | Must be set to a secure credential |
| `SHINPO_JWT_SECRET` | `application.properties` | dev fallback in `application-dev.properties` | HMAC-SHA256 signature key for JWT tokens | Mandatory in production profile (fails startup if empty) |
| `SHINPO_AI_ENABLED` | `application.properties` | `true` | Enables/disables EONPAI AI features | Optional toggle |
| `SHINPO_AI_PROVIDER` | `application.properties` | `ollama` | Provider selection (`ollama`, `heuristic`) | Configurable |
| `SHINPO_AI_OLLAMA_BASE_URL` | `application.properties` | `http://localhost:11434` | Ollama local inference endpoint | Set to cloud proxy or internal host |
| `SHINPO_AI_OLLAMA_MODEL` | `application.properties` | `qwen3:4b` | LLM model tag | Configurable |
| `SPRING_PROFILES_ACTIVE` | Environment | `dev` | Activates dev/prod profile | Set to `prod` in Docker container |
