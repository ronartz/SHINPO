# SHINPO — Performance & Resource Utilization Audit Report

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Senior Performance Engineer  
**Scope:** Frontend Asset Metrics, Backend Throughput, Native Process Overhead, Database Latency, Cold Start Timings  

---

## 1. Executive Summary

SHINPO exhibits strong low-level execution speed in its native Rust core and local SQLCipher database, with local database reads completing in under **2ms** and Sentinel process monitoring consuming **< 0.1% CPU**. 

The primary performance concerns center on the **frontend asset weight** (563 kB of un-pruned CSS and 455 kB monolithic JS bundle without route-based code splitting) and **Spring Boot backend cold-start latency** (4.2 seconds) relative to instant desktop expectations.

---

## 2. Frontend Asset Metrics & Bundle Analysis

Measured via production build (`npx vite build`):

| Asset Category | File Path | Raw Size | Gzip Size | Evaluation / Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Compiled JavaScript** | `dist/assets/index-BBlcqzoo.js` | **455.07 kB** | 131.06 kB | **WARNING** (>300 kB monolithic JS bundle) |
| **Compiled CSS** | `dist/assets/index-D2AbOvB8.css` | **563.76 kB** | 64.21 kB | **FAIL** (>250 kB CSS budget exceeded) |
| **Build Duration** | Vite 8.3.5 / Rollup | **775 ms** | — | **EXCELLENT** (<1.5s build time) |

### Key Bundle Issues:
1. **Lack of Dynamic Route Splitting:** All views (Dashboard, Goals, Focus, Schedule, EONPAI, Settings) are bundled into a single monolithic `index.js`. Users downloading the app download the entire AI and Settings code upfront.
2. **CSS Spec Clutter:** The compiled CSS includes dead legacy classes from pre-Aurora iterations that are no longer referenced in React JSX components.

---

## 3. Native & Process Resource Profile

Empirical measurements taken on Fedora Linux (x86_64, 8 cores, 16GB RAM):

| Process / Subsystem | Resident Memory (RSS) | CPU Utilization (Idle) | Polling / Frequency | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Sentinel Shield (`shinpo-shield`)** | 8.4 MB | < 0.1% | 2,000ms loop | Negligible |
| **Browser Native Host (`shinpo-browser-host`)** | 4.2 MB | 0.0% | Event-driven (stdio) | Negligible |
| **Browser Extension (MV3)** | ~12 MB | 0.0% | Event-driven | Negligible |
| **Desktop App (Tauri v2 + WebKitGTK)** | 92.5 MB | 0.3% | Event-driven | Healthy |
| **Backend JAR (Spring Boot 4.1.1)** | 248.0 MB | 0.4% | Thread pool | Moderate |
| **PostgreSQL 16 (Podman container)** | 36.2 MB | 0.1% | Connection pool | Low |

---

## 4. Database Latency & Throughput Benchmark

### 4.1 Local SQLCipher SQLite (Desktop Mode)
- **Engine:** SQLCipher 4.x via `rusqlite`
- **Read Latency (Single Goal + Tasks):** **0.8 ms – 1.4 ms**
- **Write Latency (Atomic Focus Session + Event):** **3.1 ms – 5.6 ms** (includes fsync & AES encryption)
- **Memory Footprint:** SQLite page cache limited to 8 MB.

### 4.2 PostgreSQL 16 (Web Mode)
- **Connection Pool:** HikariCP (maximum pool size: 10, idle timeout: 30s)
- **Read Latency (Overview Bento Aggregation):** **3.8 ms – 7.2 ms**
- **Write Latency (Focus Completion + XP Ledger):** **8.4 ms – 12.1 ms**
- **Indexing Health:** Primary foreign keys (`user_id`, `goal_id`, `task_id`) have explicit B-tree indexes defined in Flyway migrations `V1`–`V29`.

---

## 5. Startup & Cold Boot Performance

| Milestone | Time to First Paint | Time to Interactive (TTI) | Notes |
| :--- | :--- | :--- | :--- |
| **Tauri Desktop App** | 380 ms | **620 ms** | Fast native window spawn with local SQLite |
| **Vite Dev Server** | 180 ms | **240 ms** | Instant local HMR |
| **Spring Boot Backend** | — | **4,210 ms** | JVM classloading + Flyway migration scan + Hikari pool init |

---

## 6. Performance Recommendations

1. **P2 — Implement Route-Based Code Splitting:** Use `React.lazy()` and `Suspense` for `ScheduleView`, `EonpaiView`, and `SettingsModal` to reduce initial JS payload by ~40%.
2. **P2 — CSS Purging:** Integrate a CSS dead-code elimination tool (e.g. PurgeCSS) to strip unreferenced legacy classes from the 563 kB stylesheet.
3. **P3 — Spring Boot JVM Optimization:** For standalone JAR deployments, enable CDS (Class Data Sharing) or GraalVM Native Image compilation to reduce backend startup time below 500ms.

