# SHINPO (進歩) — Production Cloud Deployment Guide

This guide details how to deploy the **SHINPO** cloud backend to any standard Linux virtual private server (e.g., Oracle Cloud Always Free ARM/x86, Hetzner Cloud, DigitalOcean Droplet, Linode, AWS EC2, or Google Cloud Compute Engine).

Once deployed, the developer's laptop can be **completely shut down**. Four (or more) independent beta users will connect directly to this cloud service from their Windows or Linux computers.

---

## 1. System Architecture

```
                  Internet (HTTPS 443 / WSS 443)
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │             Caddy Edge Reverse Proxy         │
         │   • Automated TLS Certificates (Let's Encrypt)│
         │   • HTTP -> HTTPS Redirection (80 -> 443)    │
         │   • Reverse Proxies /api/*, /ws*, /actuator* │
         │   • Serves Static SPA Assets (optional web)  │
         └──────────────────────┬───────────────────────┘
                                │ Internal Bridge Network (shinpo-internal-net)
                ┌───────────────┴───────────────┐
                ▼                               ▼
  ┌───────────────────────────┐   ┌───────────────────────────┐
  │    Spring Boot Backend    │   │      PostgreSQL 17        │
  │   • Port: 8080 (internal) │◄──┤   • Port: 5432 (INTERNAL) │
  │   • Profile: prod         │   │   • NO host port exposed  │
  │   • Process Scanning: OFF │   │   • Persistent volume:    │
  │   • Strict JWT validation │   │     postgres_data         │
  └───────────────────────────┘   └───────────────────────────┘
```

### Key Security & Isolation Guarantees
1. **Zero Workstation Dependencies**: No developer filesystem paths (`/home/eonx/`), developer usernames, or local machine dependencies remain.
2. **Database Isolation**: PostgreSQL binds **only** to the private internal Docker bridge network (`shinpo-internal-net`). Port 5432 is **never** exposed to the public internet or the host network.
3. **No Server Process Scanning**: Server-side host process scanning and termination are strictly disabled (`shinpo.sentinel.server-process-scanning.enabled=false`). Enforcement is delegated to each user's local desktop **SHINPO Shield** daemon.
4. **Strict Per-User Multi-Tenancy**: All goals, missions, focus sessions, and quarantine telemetry are strictly scoped by user ID and verified via stateless cryptographically signed JWTs.
5. **Automated Zero-Config TLS**: Caddy issues and auto-renews Let's Encrypt / ZeroSSL certificates on ports 80 and 443.

---

## 2. Server Requirements & Prerequisites

### Minimum Hardware Specifications
- **CPU**: 1 vCPU (x86_64 or ARM64 Ampere A1)
- **RAM**: 2 GB (4 GB recommended if running an in-memory JVM cache or compiling on-box)
- **Disk**: 20 GB SSD
- **OS**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Debian 12

### Network & DNS
1. A registered domain name or subdomain (e.g. `shinpo.yourdomain.com`).
2. A DNS **A Record** (or **AAAA Record**) pointing `shinpo.yourdomain.com` to your server's public IPv4/IPv6 address.
3. **Firewall / Security Group Rules**:
   - Inbound TCP **80** (HTTP for ACME challenges and HTTPS redirection)
   - Inbound TCP **443** (HTTPS / WSS production traffic)
   - Inbound TCP **22** (SSH management)
   - **DO NOT OPEN** port 5432 or 8080.

---

## 3. Server Provisioning & Docker Installation

SSH into your target cloud server:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

Install Docker and Docker Compose v2:

```bash
# Update package lists
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow running docker without sudo
sudo usermod -aG docker "$USER"
newgrp docker
```

---

## 4. Deploying SHINPO

### Step 1: Clone the Repository

```bash
git clone https://github.com/ronartz/SHINPO.git /opt/shinpo
cd /opt/shinpo
```

### Step 2: Configure Environment Variables

Copy the production environment template:

```bash
cp .env.production.example .env.production
```

Generate cryptographically secure secrets:

```bash
# Generate 256-bit hex secrets
JWT_SECRET=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 24)

echo "Generated JWT_SECRET: ${JWT_SECRET}"
echo "Generated DB_PASS:    ${DB_PASS}"
```

Edit `.env.production` (`nano .env.production`):

```bash
# ==============================================================================
# SHINPO Production Environment Configuration
# ==============================================================================

# Public Domain (Must match DNS A record; Caddy requests TLS certificate for this)
SHINPO_DOMAIN=shinpo.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# PostgreSQL Credentials (Database is on private Docker network only)
POSTGRES_DB=shinpo
POSTGRES_USER=shinpo_app
POSTGRES_PASSWORD=PASTE_GENERATED_DB_PASS_HERE

# Production Spring Boot Configuration
SPRING_PROFILES_ACTIVE=prod
SHINPO_JWT_SECRET=PASTE_GENERATED_JWT_SECRET_HERE

# CORS Configuration (Allows your production web app or custom desktop clients)
SHINPO_CORS_ALLOWED_ORIGINS=https://shinpo.yourdomain.com,tauri://localhost,https://tauri.localhost

# Server-Side Sentinel Process Scanning (MUST REMAIN false IN PRODUCTION)
SHINPO_SERVER_PROCESS_SCANNING_ENABLED=false

# AI Provider Configuration (Default: deterministic fallback mode if no external Ollama)
SHINPO_AI_ENABLED=false
```

Make sure `.env.production` has restrictive permissions:

```bash
chmod 600 .env.production
```

### Step 3: Launch Containers

Start the production stack in detached mode:

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

### Step 4: Verify Deployment Health

Check the status of all three containers:

```bash
docker compose -f compose.prod.yaml ps
```

Expected output:
```
NAME                 IMAGE               COMMAND                  SERVICE             CREATED         STATUS                   PORTS
shinpo-caddy        caddy:2.9-alpine    "caddy run --config …"   caddy               1 minute ago    Up 1 minute (healthy)    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
shinpo-backend      shinpo-backend      "java -jar /app/app.…"   backend             1 minute ago    Up 1 minute (healthy)    8080/tcp
shinpo-postgres     postgres:17-alpine  "docker-entrypoint.s…"   postgres            1 minute ago    Up 1 minute (healthy)    5432/tcp
```

Verify backend health probe over HTTPS:

```bash
curl -f https://shinpo.yourdomain.com/actuator/health
```

Expected response:
```json
{"status":"UP","groups":["liveness","readiness"]}
```

---

## 5. Automated Database Backups & Recovery

SHINPO includes hardened backup and restore scripts with SHA-256 integrity checks and gzip validation.

### Manual Backup Test

```bash
./scripts/backup_db.sh
```

Backups are saved to `/opt/shinpo/backups/`:
- `shinpo_backup_YYYYMMDD_HHMMSS.sql.gz`
- `shinpo_backup_YYYYMMDD_HHMMSS.sql.gz.sha256`

### Scheduling Daily Automated Backups

Add a cron job to run the backup script daily at 03:00 UTC:

```bash
sudo crontab -e
```

Add the following entry:

```cron
0 3 * * * /opt/shinpo/scripts/backup_db.sh >> /var/log/shinpo_backup.log 2>&1
```

### Restoring from a Backup

To restore the database from a backup file (e.g. after a disaster or migration):

```bash
./scripts/restore_db.sh /opt/shinpo/backups/shinpo_backup_20261019_030000.sql.gz --force
```

The script automatically verifies gzip integrity, validates the SHA-256 checksum, drops/recreates schema tables safely, and confirms table counts upon completion.

---

## 6. Optional: External AI Assistant (EONPAI) Configuration

By default, SHINPO operates with a deterministic fallback engine that provides instant, calm, zero-cost task guidance.

If you wish to attach an external Ollama instance:
1. Deploy Ollama on a GPU-enabled server or configure a local Ollama instance with `OLLAMA_HOST=0.0.0.0:11434`.
2. In `.env.production`:
   ```bash
   SHINPO_AI_ENABLED=true
   SHINPO_AI_PROVIDER=ollama
   SHINPO_AI_OLLAMA_BASE_URL=https://ollama.yourdomain.com
   SHINPO_AI_OLLAMA_MODEL=qwen2.5:7b
   ```
3. Restart backend:
   ```bash
   docker compose -f compose.prod.yaml restart backend
   ```

---

## 7. Zero-Downtime Updates & Rolling Restarts

To deploy new versions or updates:

```bash
cd /opt/shinpo
git pull origin main
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

Docker Compose builds the new container, switches traffic when healthy, and removes obsolete containers with zero manual database intervention.

---

## 8. Production Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `SSL_ERROR_NO_CYPHER_OVERLAP` or SSL handshake timeout | DNS record not yet propagated or port 80 blocked | Ensure DNS A record points to public IP and port 80/443 are open in cloud security group / UFW. |
| Backend unhealthy / restarts | Missing `SHINPO_JWT_SECRET` | Verify `.env.production` has a 256-bit `SHINPO_JWT_SECRET` defined. |
| Database connection refused | Container network misconfigured | Run `docker compose -f compose.prod.yaml logs postgres` to ensure postgres initialized without permission errors. |
| Desktop app displays "Network Error" | Wrong Server URL | Ensure users entered `https://shinpo.yourdomain.com` (with `https://`, no trailing slash) in the desktop login card. |

