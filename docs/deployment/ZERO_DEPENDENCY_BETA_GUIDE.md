# SHINPO — Standalone Deployment Requirements

**Status:** Deployment guide only — no remote production environment or packaged cloud endpoint is verified.
**Author:** Principal Systems Architect & Lead Engineer  
**Objective:** Document what must be in place before users can run SHINPO without the developer's computer. This is not evidence that a deployment or installer is ready.

---

## 1. Current implementation status

| Component | Current state | Remaining for independent use |
|---|---|---|
| **AI Engine (EONPAI)** | Local Ollama is available in development | Gemini cloud provider and deterministic fallback are implemented; live Gemini access requires a server-side API key and has not been verified for a production account. |
| **Backend & DB** | Spring Boot + Postgres can run locally | `compose.prod.yaml` defines a persistent PostgreSQL + backend + HTTPS proxy stack; it must be deployed to a user-owned, always-on host. |
| **Client App** | Dev build defaults to local services | Tauri supports a remote server URL at build time or in Settings; no production endpoint is currently baked into the installer. |
| **Availability** | Depends on the development machine | Independent of the developer's laptop only after the remote stack is deployed, tested, and the desktop build is configured to use it. |

---

## 2. Cloud AI Engine: Google Gemini

We implemented and verified `GeminiProvider.java` (`backend/src/main/java/com/shinpo/ai/provider/GeminiProvider.java`):

- **Model:** `gemini-3.6-flash` (Active stable Flash model; `gemini-2.0-flash` reached end-of-life on June 1, 2026).
- **Cost and quota:** Depend on the Google account, current model terms, and billing/quota settings. Do not assume free or unlimited use; configure provider-side budget controls.
- **Security:** Authenticates via `x-goog-api-key` HTTP header (never exposed in URLs, query strings, or exception logs).
- **Fail-Closed Resilience:** If quota is exceeded (HTTP 429) or network is interrupted, EONPAI immediately falls back to its deterministic rule engine without throwing 500 errors.
- **Verification:** `GeminiProviderTests` passed **8/8** mocked API-contract tests. The current backend suite passed **401/401** against disposable PostgreSQL; this does not prove a live Gemini key or production account works.

---

## 3. Remote backend hosting

To keep the app available while the developer's laptop is off, deploy the stack to an always-on host and verify its database backups, recovery, TLS, resource limits, and billing. No provider is selected or provisioned by this repository.

### Strategy 1: User-managed always-on VPS
- Select an always-on virtual machine with enough RAM/storage for PostgreSQL, backend, frontend, and Caddy TLS.
- **Uptime:** Runs 24/7 without idle shutdown or sleep timeouts.
- **Deployment:** Simply clone repo and run:
  ```bash
  docker compose -f compose.prod.yaml up -d
  ```
- PostgreSQL, Spring Boot, and Caddy TLS run on the remote VM; availability and persistence depend on that host's plan and backup policy.

### Strategy 2: Managed application host + managed PostgreSQL
- Choose providers and plans whose sleep, retention, backup, network, and billing behavior fit the intended availability. Confirm persistence and restore procedures before storing user data.
- **Example backend environment variables:**
  - `SPRING_PROFILES_ACTIVE`: `prod`
  - `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<neon-endpoint>:5432/shinpo?sslmode=require`
  - `SPRING_DATASOURCE_USERNAME`: `<neon-user>`
  - `SPRING_DATASOURCE_PASSWORD`: `<neon-password>`
  - `SHINPO_JWT_SECRET`: `<generated-random-32-char-secret>`
  - `SHINPO_AI_PROVIDER`: `gemini`
  - `GEMINI_API_KEY`: `<server-side Gemini API key>`
  - `SHINPO_AI_GEMINI_MODEL`: `gemini-3.6-flash`
  - `SHINPO_SERVER_PROCESS_SCANNING_ENABLED`: `false`

---

## 4. Building a desktop client for a deployed server

### Step 1: Bake the Server URL into the Frontend
When building for friends, supply the cloud server URL so the installer knows where to connect automatically:

```bash
cd frontend
export VITE_SHINPO_SERVER_URL="https://<your-deployed-domain>"
npm run build
```

### Step 2: Build the Desktop Installers

#### For Windows (`SHINPO-Setup.exe`):
On a Windows machine or via PowerShell:
```powershell
.\scripts\package-windows.ps1 -SkipSigning
```
Or directly with Tauri:
```bash
cd frontend
npx tauri build --target x86_64-pc-windows-msvc
```
*Output:* `frontend/src-tauri/target/release/bundle/nsis/SHINPO-Setup.exe`.

#### For Linux (`SHINPO.AppImage` / `.deb`):
On your Linux machine:
```bash
./scripts/package-linux.sh
```
*Output:* `release/linux/shinpo.AppImage` and `release/linux/shinpo.deb`.

---

## 5. Distribution prerequisites (not yet completed)

1. Provision and verify a remote HTTPS domain, backend, and persistent PostgreSQL. Configure the server-side Gemini key and strong database/JWT secrets using the host's secret manager.
2. Build the Tauri app with `VITE_SHINPO_SERVER_URL` set to that verified HTTPS endpoint. Confirm the desktop app can register, sign in, use EONPAI, and persist/reload user state against it.
3. Only after explicit authorization, publish installers through a release channel.

No remote account, credentials, domain, or live deployment has been supplied or configured in this workspace. The following release steps are therefore not completed:

There is no release or distribution step authorized or performed here. Do not provide installers to other users until the live service, desktop-to-cloud workflows, privacy and recovery behavior, and platform packages have been tested.

