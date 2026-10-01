# 19 — Known Gaps and Distribution Requirements

Exact record of what is required to fulfill the pure desktop distribution milestone:

## 1. Desktop Shell Packaging (Phase 5.2)
- **Requirement**: Single installable Windows package (`SHINPO-Setup.exe`) wrapping React UI + native Rust Shield.
- **Status**: Ready for Tauri v2 packaging.
- **Prerequisite Handling**: Installer must use NSIS `currentUser` mode (no admin prompt) and Tauri `downloadBootstrapper` for WebView2.

## 2. Server Deployment
- **Requirement**: Spring Boot backend and PostgreSQL must run 24/7 on a cloud server so friends' desktop apps can connect.
- **Status**: `compose.yaml` and Dockerfiles already configured; ready for deployment to Oracle Cloud Always Free or VPS.

## 3. Remote Cloud AI Key Fallback
- **Requirement**: Friends without a local GPU/Ollama instance currently receive heuristic rule fallbacks. Providing an optional cloud LLM API key (e.g. Groq, Gemini) in Desktop Settings gives them full EONPAI intelligence.
