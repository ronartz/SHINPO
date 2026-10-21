# SHINPO — Standalone Zero-Dependency Private Beta Architecture & Guide

**Status:** Ready for Cloud Beta Deployment  
**Author:** Principal Systems Architect & Lead Engineer  
**Objective:** Provide 4+ independent friends with a zero-friction, one-click installer (`.exe` / `.AppImage`) that works 24/7 without requiring the developer's laptop to be open or running any local dependencies.

---

## 1. Summary of What Was Solved & Implemented

| Component | Before (Local Dependency) | Now (Zero-Dependency Cloud Beta) |
|---|---|---|
| **AI Engine (EONPAI)** | Depended on local Ollama on laptop (`localhost:11434`, GPU required) | **Google Gemini 3.6 Flash Cloud API (Free Tier)** + Calm Deterministic Fallback. No GPU, no local installs. |
| **Backend & DB** | Spring Boot + Postgres on developer's laptop | **Cloud Docker Deployment** (Oracle Always-Free / Render + Neon) running 24/7. |
| **Client App** | Dev build running through dev proxy or localhost | **Native Desktop Installer** (`SHINPO-Setup.exe` & `shinpo.AppImage`) with pre-baked Cloud Server URL. |
| **Friend Experience** | Required developer's laptop awake, manual port forwarding | **Hit Install -> Open App -> Register Account -> Works 24/7.** Zero intervention. |

---

## 2. Cloud AI Engine: Google Gemini Free Tier

We implemented and verified `GeminiProvider.java` (`backend/src/main/java/com/shinpo/ai/provider/GeminiProvider.java`):

- **Model:** `gemini-3.6-flash` (Active stable Flash model; `gemini-2.0-flash` reached end-of-life on June 1, 2026).
- **Cost:** **$0.00 / 100% Free** via [Google AI Studio](https://aistudio.google.com/).
- **Security:** Authenticates via `x-goog-api-key` HTTP header (never exposed in URLs, query strings, or exception logs).
- **Fail-Closed Resilience:** If quota is exceeded (HTTP 429) or network is interrupted, EONPAI immediately falls back to its deterministic rule engine without throwing 500 errors.
- **Verification:** Unit tests in `GeminiProviderTests.java` passed 7/7; full test suite passed **368/368 tests**.

---

## 3. Sustainable Zero-Cost Cloud Backend Hosting

To keep the app running 24/7 without developer laptop intervention, select one of these two proven zero-cost architectures:

### Strategy 1 (Optimal 24/7): Oracle Cloud Infrastructure (OCI) Always Free
- **Hardware:** 4 OCPU ARM Ampere A1 cores, 24 GB RAM, 200 GB Storage for life ($0.00 forever).
- **Uptime:** Runs 24/7 without idle shutdown or sleep timeouts.
- **Deployment:** Simply clone repo and run:
  ```bash
  docker compose -f compose.prod.yaml up -d
  ```
- **Advantages:** PostgreSQL, Spring Boot, and Caddy TLS all run locally inside the VM with persistent disk storage that **never expires**.

### Strategy 2 (Zero Card Required): Render.com Web Service + Neon.tech Persistent Postgres
- **Important Note on Render Free Database:** Render's free PostgreSQL database **is deleted after 30 days**, making it unsuitable for persistent beta data.
- **Solution:** Pair a free Render Web Service with a free persistent database from **Neon.tech** or **Supabase** (0.5 GB storage, never deleted).
- **Environment Variables for Render:**
  - `SPRING_PROFILES_ACTIVE`: `prod`
  - `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<neon-endpoint>:5432/shinpo?sslmode=require`
  - `SPRING_DATASOURCE_USERNAME`: `<neon-user>`
  - `SPRING_DATASOURCE_PASSWORD`: `<neon-password>`
  - `SHINPO_JWT_SECRET`: `<generated-random-32-char-secret>`
  - `SHINPO_AI_PROVIDER`: `gemini`
  - `GEMINI_API_KEY`: `<your-free-gemini-api-key>`
  - `SHINPO_AI_GEMINI_MODEL`: `gemini-3.6-flash`
  - `SHINPO_SERVER_PROCESS_SCANNING_ENABLED`: `false`

---

## 4. Building the Pre-Configured Desktop Installer for Friends

### Step 1: Bake the Server URL into the Frontend
When building for friends, supply the cloud server URL so the installer knows where to connect automatically:

```bash
cd frontend
export VITE_SHINPO_SERVER_URL="https://shinpo-backend.onrender.com"
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

## 5. Free Distribution to Friends

1. **GitHub Releases (Recommended):**
   - Go to your repository on GitHub -> **Releases** -> **Draft a new release**.
   - Tag: `v1.0.0-beta.1`.
   - Drag & drop `SHINPO-Setup.exe` and `shinpo.AppImage`.
   - Publish Release!
2. **Send to Friends:**
   - Send your 4 friends the download link.
   - Friend instructions:
     1. Download and run `SHINPO-Setup.exe`.
     2. Click "Create Account" and pick their username/password.
     3. Start using SHINPO immediately!

