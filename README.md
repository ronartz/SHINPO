<div align="center">
  <img src="frontend/src-tauri/icons/icon.png" width="96" alt="SHINPO app icon" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
  <h1>SHINPO (進歩)</h1>
  <p><strong>Progress, made intentional.</strong></p>
  <p>A high-performance, local-first personal execution workspace & deep focus engine for Linux.</p>

  <p>
    <a href="https://github.com/ronartz/SHINPO/releases/tag/v0.1.0-beta.1"><img src="https://img.shields.io/badge/Release-v0.1.0--beta.1-10b981?style=for-the-badge&logo=github&logoColor=white" alt="Release v0.1.0-beta.1" /></a>
    <img src="https://img.shields.io/badge/Platform-Linux%20x86__64-f97316?style=for-the-badge&logo=linux&logoColor=white" alt="Linux x86_64" />
    <img src="https://img.shields.io/badge/Desktop-Tauri%202%20·%20Rust-ffc131?style=for-the-badge&logo=tauri&logoColor=171717" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/UI-React%2019%20·%20Vite-61dafb?style=for-the-badge&logo=react&logoColor=171717" alt="React 19" />
    <img src="https://img.shields.io/badge/Security-AES--256%20SQLCipher-8b5cf6?style=for-the-badge&logo=shield&logoColor=white" alt="AES-256 SQLCipher" />
    <img src="https://img.shields.io/badge/Focus%20Guardian-Warning--Only-ec4899?style=for-the-badge" alt="Warning-Only Guardian" />
  </p>

  <p>
    <a href="#-quick-download--installation">Quick Install</a> &nbsp;•&nbsp;
    <a href="#-inside-shinpo">Features</a> &nbsp;•&nbsp;
    <a href="#-screenshots-gallery">Screenshots</a> &nbsp;•&nbsp;
    <a href="#-how-the-pieces-fit-together">Architecture</a> &nbsp;•&nbsp;
    <a href="#-privacy--security-guarantees">Privacy &amp; Security</a> &nbsp;•&nbsp;
    <a href="https://github.com/ronartz/SHINPO/releases">All Releases</a>
  </p>
</div>

<p align="center">
  <img src="docs/SHINPO_README_HERO.svg" width="100%" alt="SHINPO — Turn intention into action. Plan with purpose, focus on what matters, and see your progress." />
</p>

<p align="center">
  <sub>Plan deliberately. Protect your focus. Follow through.</sub>
</p>

---

## 💡 The Philosophy

**SHINPO (進歩)** is Japanese for *progress*. It is built around a continuous execution loop:

```text
🎯 Set Clear Direction  ➔  📋 Select Next Action  ➔  ⏱️ Deep Focus Session  ➔  📈 Review Momentum
```

Modern knowledge workers are inundated with scattered to-do apps, noisy calendars, and complex productivity trackers. SHINPO brings goals, task execution, pomodoro timing, schedule visibility, distraction protection, and progression analytics into a **single, unified, local-first Linux desktop workspace**.

> **No forced cloud sign-in. Zero telemetry. 100% locally encrypted on your disk.**

---

## 📥 Quick Download & Installation

SHINPO is packaged for **Linux x86_64** with verified builds available on the [GitHub Releases page](https://github.com/ronartz/SHINPO/releases/tag/v0.1.0-beta.1):

| Package / Format | Target Distribution | Download Link |
|---|---|---|
| **RPM Package** | Fedora 40/41, RHEL 9+, Rocky Linux, AlmaLinux | [`SHINPO-0.1.0-beta.1-1.x86_64.rpm`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO-0.1.0-beta.1-1.x86_64.rpm) |
| **Portable Tarball** | Ubuntu, Debian, Arch Linux, or No-Root | [`SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz) |
| **AppImage** | Universal single-file Linux executable | [`SHINPO_0.1.0-beta.1_amd64.AppImage`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_amd64.AppImage) |
| **Debian Package** | Ubuntu / Debian systems | [`SHINPO_0.1.0-beta.1_amd64.deb`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_amd64.deb) |
| **Chromium Companion** | Google Chrome, Brave, Microsoft Edge | [`shinpo-browser-companion-chromium.zip`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/shinpo-browser-companion-chromium.zip) |
| **Firefox Companion** | Mozilla Firefox | [`shinpo-browser-companion-firefox.zip`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/shinpo-browser-companion-firefox.zip) |

### Option 1: Fedora / RHEL (Recommended)
```bash
sudo dnf install ./SHINPO-0.1.0-beta.1-1.x86_64.rpm
shinpo-desktop
```

### Option 2: Portable Tarball (Any Linux Distribution)
```bash
tar -xzf SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz
cd SHINPO_0.1.0-beta.1_linux_x86_64
./shinpo-desktop
```

### Option 3: Universal AppImage
```bash
chmod +x SHINPO_0.1.0-beta.1_amd64.AppImage
./SHINPO_0.1.0-beta.1_amd64.AppImage
```

---

## ⚡ Inside SHINPO

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🎯 Goals &amp; Task Execution</h3>
      <p>Break high-level aspirations into manageable, actionable steps. Organize tasks with Kanban boards, list views, priority tags, and deadline scheduling.</p>
    </td>
    <td width="50%" valign="top">
      <h3>⏱️ Deep Focus Engine</h3>
      <p>Time-blocked focus sessions with customizable intervals (25m / 45m / 60m), fluid pause/resume controls, break timers, and post-session reflection notes.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🗓️ Calendar &amp; Time Mapping</h3>
      <p>Schedule your week visually. Position focus blocks against deadlines, review execution history, and balance deep work across projects.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🛡️ Focus Guardian</h3>
      <p>Gentle, non-destructive desktop observation. <strong>Warning-only:</strong> SHINPO alerts you with subtle overlays when distracting apps appear, but <em>never terminates your programs</em>.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🌐 Browser Companion</h3>
      <p>Pairs with Chromium (Chrome, Brave, Edge) and Firefox via local native messaging to detect distracting tabs during focus blocks with zero cloud dependency.</p>
    </td>
    <td width="50%" valign="top">
      <h3>✦ EONPAI AI Assistant</h3>
      <p>Autonomous task decomposition and intention planning. Runs 100% offline via deterministic rule sets, with optional local Ollama or OpenAI-compatible endpoint support.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📈 Velocity &amp; Analytics</h3>
      <p>Visualize completion rates, focus streaks, XP gain, milestone achievements, and velocity trends to stay motivated over months of deliberate work.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🎨 Aurora &amp; Classic Themes</h3>
      <p>Meticulously styled with four color schemes: <strong>Aurora Dark</strong>, <strong>Classic Dark</strong>, <strong>Aurora Light</strong>, and <strong>Classic Light</strong> with GPU-accelerated glassmorphism.</p>
    </td>
  </tr>
</table>

---

## 🖼️ Screenshots Gallery

A visual tour through the SHINPO desktop workspace (captured in **Aurora Dark** theme):

<table>
  <tr>
    <td width="50%" valign="top">
      <h4 align="center">📊 Dashboard Overview</h4>
      <p align="center"><sub>Daily priorities, focus streaks, upcoming milestones, and quick-actions.</sub></p>
      <a href="docs/qa/screenshots/final/01_dashboard_aurora-dark.png"><img src="docs/qa/screenshots/final/01_dashboard_aurora-dark.png" width="100%" alt="SHINPO Dashboard Overview" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
    <td width="50%" valign="top">
      <h4 align="center">🎯 Goals &amp; Tasks Kanban</h4>
      <p align="center"><sub>Organize projects by execution state: Backlog, Next, In Progress, and Completed.</sub></p>
      <a href="docs/qa/screenshots/final/02_goals_tasks_aurora-dark.png"><img src="docs/qa/screenshots/final/02_goals_tasks_aurora-dark.png" width="100%" alt="SHINPO Goals &amp; Tasks Kanban" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4 align="center">⏱️ Deep Focus Engine</h4>
      <p align="center"><sub>Immersive session timer with pause resilience and post-session reflection.</sub></p>
      <a href="docs/qa/screenshots/final/03_focus_engine_aurora-dark.png"><img src="docs/qa/screenshots/final/03_focus_engine_aurora-dark.png" width="100%" alt="SHINPO Focus Engine" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
    <td width="50%" valign="top">
      <h4 align="center">🗓️ Calendar &amp; Scheduler</h4>
      <p align="center"><sub>Time-block deep work sessions across days and visualize weekly load.</sub></p>
      <a href="docs/qa/screenshots/final/06_schedule_calendar_aurora-dark.png"><img src="docs/qa/screenshots/final/06_schedule_calendar_aurora-dark.png" width="100%" alt="SHINPO Calendar &amp; Scheduler" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4 align="center">📈 Analytics &amp; Streaks</h4>
      <p align="center"><sub>Review long-term productivity patterns, completion velocity, and XP milestones.</sub></p>
      <a href="docs/qa/screenshots/final/04_analytics_aurora-dark.png"><img src="docs/qa/screenshots/final/04_analytics_aurora-dark.png" width="100%" alt="SHINPO Analytics Dashboard" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
    <td width="50%" valign="top">
      <h4 align="center">✦ EONPAI AI Planning Assistant</h4>
      <p align="center"><sub>Decompose fuzzy ideas into structured, manageable, and actionable subtasks.</sub></p>
      <a href="docs/qa/screenshots/final/08_eonpai_assistant_aurora-dark.png"><img src="docs/qa/screenshots/final/08_eonpai_assistant_aurora-dark.png" width="100%" alt="SHINPO EONPAI Assistant" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" /></a>
    </td>
  </tr>
</table>

<details>
<summary><strong>🔍 Click to view Classic Dark Theme previews</strong></summary>
<br />

<table>
  <tr>
    <td width="50%" valign="top">
      <h4 align="center">Classic Dark — Dashboard</h4>
      <a href="docs/qa/screenshots/final/01_dashboard_classic-dark.png"><img src="docs/qa/screenshots/final/01_dashboard_classic-dark.png" width="100%" alt="Classic Dark Dashboard" /></a>
    </td>
    <td width="50%" valign="top">
      <h4 align="center">Classic Dark — Goals &amp; Tasks</h4>
      <a href="docs/qa/screenshots/final/02_goals_tasks_classic-dark.png"><img src="docs/qa/screenshots/final/02_goals_tasks_classic-dark.png" width="100%" alt="Classic Dark Tasks" /></a>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4 align="center">Classic Dark — Focus Engine</h4>
      <a href="docs/qa/screenshots/final/03_focus_engine_classic-dark.png"><img src="docs/qa/screenshots/final/03_focus_engine_classic-dark.png" width="100%" alt="Classic Dark Focus" /></a>
    </td>
    <td width="50%" valign="top">
      <h4 align="center">Classic Dark — Analytics</h4>
      <a href="docs/qa/screenshots/final/04_analytics_classic-dark.png"><img src="docs/qa/screenshots/final/04_analytics_classic-dark.png" width="100%" alt="Classic Dark Analytics" /></a>
    </td>
  </tr>
</table>
</details>

---

## 🏗️ How the Pieces Fit Together

SHINPO is built on a high-efficiency architecture separating native OS capabilities from the fluid user interface:

```mermaid
flowchart TD
    subgraph UI ["Desktop User Interface (React 19 + TypeScript)"]
        Frontend["SHINPO Desktop Shell"]
        Views["Dashboard · Tasks · Focus · Calendar · Analytics · EONPAI"]
        Frontend --- Views
    end

    subgraph IPC ["Inter-Process Communication"]
        TauriIPC["Tauri 2 IPC Bridge (Type-safe Commands & Events)"]
    end

    subgraph NativeCore ["Native Core & Security (Rust)"]
        Core["Application Backend (Tauri 2)"]
        Shield["Focus Guardian (Warning-Only Process Monitor)"]
        Eonpai["EONPAI AI Engine (Offline Rules / Ollama API)"]
        VaultEngine["Vault Engine (Argon2id Key Derivation)"]
    end

    subgraph Storage ["Local Storage"]
        SQLCipher[("Encrypted SQLCipher Database<br/>AES-256 · Zero Plaintext on Disk")]
    end

    subgraph CompanionHost ["Browser Extension Bridge"]
        NativeHost["shinpo-browser-host (Rust Binary)"]
        BrowserExt["Browser Companion (Chromium & Firefox)"]
    end

    UI <===>|"Tauri IPC"| TauriIPC
    TauriIPC <===> Core
    Core --- Shield
    Core --- Eonpai
    Core <===> VaultEngine
    VaultEngine <===> SQLCipher
    BrowserExt <===>|"Standard Native Messaging"| NativeHost
    NativeHost <===>|"Local Loopback / Token Auth"| Core
```

### Technology Matrix

| Layer | Technology | Key Responsibility |
|---|---|---|
| **Desktop Shell** | [Tauri 2](https://v2.tauri.app/) · Rust | Native window management, low-memory footprint, secure IPC |
| **User Interface** | [React 19](https://react.dev/) · TypeScript · Vite | Reactive state management, glassmorphism UI, accessible navigation |
| **Local Vault** | [SQLCipher](https://www.zetetic.net/sqlcipher/) · [Argon2id](https://en.wikipedia.org/wiki/Argon2) | 256-bit AES database encryption, zero plaintext on disk |
| **Focus Guardian** | Rust `sysinfo` · OS Process Watcher | Non-destructive, warning-only distraction detection |
| **Browser Companion** | WebExtensions Manifest v3 | Chromium & Firefox distraction detection via native messaging |
| **AI Intelligence** | Local Deterministic Rules / Ollama | Local task decomposition; zero external network required |

---

## 🔒 Privacy & Security Guarantees

SHINPO is architected around the core principle that **your intentions, goals, and notes belong to you alone**:

1. **Local-Only Encrypted Vault:** All personal application data is stored in a local SQLCipher-backed database encrypted with **256-bit AES**. Encryption keys are derived via **Argon2id** from your Master Passphrase.
2. **Zero Plaintext on Disk:** Byte-level disk forensics verify that zero unencrypted task titles, goal descriptions, or reflection notes are ever written to disk.
3. **Focus Guardian is Non-Destructive:** Focus Guardian is strictly **warning-only**. It never closes, terminates, or interferes with your running desktop software.
4. **Explicit Browser Pairing:** The browser companion communicates only through local stdin/stdout native messaging with a short-lived, single-use pairing token.
5. **AI Privacy:** EONPAI functions 100% offline using deterministic local heuristics. Connecting external LLM endpoints (such as Ollama or OpenAI-compatible APIs) is strictly opt-in.

---

## 🛠️ Run from Source

### Prerequisites
- Node.js 22+ and npm
- Rust toolchain (1.80+) and Cargo
- Linux development headers: `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libayatana-appindicator3-dev`

### Development Setup
```bash
# 1. Clone repository
git clone git@github.com:ronartz/SHINPO.git
cd SHINPO

# 2. Install frontend dependencies
npm --prefix frontend ci

# 3. Launch Tauri desktop development app with hot-reload
npm --prefix frontend run tauri:dev
```

### Production Build
```bash
# Compile desktop binaries and installers
npm --prefix frontend run tauri:build
```

---

## 📚 Documentation & Architecture

- 🐧 [Linux Installation Guide](docs/INSTALL_LINUX.md)
- 🌐 [Browser Companion Setup](docs/Browser-Companion-Install.md)
- ⚠️ [Known Limits & Beta Characteristics](docs/KNOWN_LIMITS.md)
- 🏗️ [Standalone Runtime Architecture](docs/architecture/STANDALONE_RUNTIME.md)
- 💻 [Frontend Architecture](docs/architecture/FRONTEND_ARCHITECTURE.md)
- 📖 [API Reference](docs/architecture/API_REFERENCE.md)
- 📐 [Engineering Standards](docs/architecture/CODE_STANDARDS.md)

---

## 📜 License

**Proprietary · All rights reserved.**  
Unauthorized copying, reverse engineering, redistribution, or commercial use is strictly prohibited. Access to this source repository is granted solely for authorized private beta evaluation.

<br />

<div align="center">
  <strong>進歩 — Small steps. Meaningful progress.</strong><br />
  <sub>SHINPO is engineered for builders who want to spend less time managing productivity apps and more time doing meaningful work.</sub>
</div>
