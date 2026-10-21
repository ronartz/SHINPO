#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Production Database Backup Script
# Creates a compressed, checksummed PostgreSQL database snapshot with rotation.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment configuration if available
if [[ -f "${PROJECT_ROOT}/.env.production" ]]; then
    # shellcheck disable=SC1091
    source "${PROJECT_ROOT}/.env.production"
elif [[ -f "${PROJECT_ROOT}/.env" ]]; then
    # shellcheck disable=SC1091
    source "${PROJECT_ROOT}/.env"
fi

POSTGRES_DB="${POSTGRES_DB:-shinpo}"
POSTGRES_USER="${POSTGRES_USER:-shinpo}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_FILE="${BACKUP_DIR}/shinpo_db_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "======================================================================"
echo "[SHINPO DB BACKUP] Starting snapshot for database: ${POSTGRES_DB}"
echo "[SHINPO DB BACKUP] Timestamp: ${TIMESTAMP}"
echo "[SHINPO DB BACKUP] Output destination: ${BACKUP_FILE}"
echo "======================================================================"

# Determine dump method: Docker container or direct pg_dump
DOCKER_CONTAINER=""
DOCKER_BIN="docker"

if command -v docker &>/dev/null; then
    if docker ps &>/dev/null; then
        DOCKER_BIN="docker"
    elif command -v sudo &>/dev/null && sudo -n docker ps &>/dev/null; then
        DOCKER_BIN="sudo docker"
    fi

    if ${DOCKER_BIN} ps --format '{{.Names}}' 2>/dev/null | grep -q "^shinpo-postgres-prod$"; then
        DOCKER_CONTAINER="shinpo-postgres-prod"
    elif ${DOCKER_BIN} ps --format '{{.Names}}' 2>/dev/null | grep -q "^shinpo-postgres$"; then
        DOCKER_CONTAINER="shinpo-postgres"
    fi
fi

if [[ -n "${DOCKER_CONTAINER}" ]]; then
    echo "[SHINPO DB BACKUP] Executing pg_dump via Docker container '${DOCKER_CONTAINER}'..."
    ${DOCKER_BIN} exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DOCKER_CONTAINER}" \
        pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --no-privileges \
        | gzip -c > "${BACKUP_FILE}"
elif command -v pg_dump &>/dev/null; then
    echo "[SHINPO DB BACKUP] Executing direct pg_dump against ${POSTGRES_HOST}:${POSTGRES_PORT}..."
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --no-privileges \
        | gzip -c > "${BACKUP_FILE}"
else
    echo "[SHINPO DB BACKUP] ERROR: Neither running postgres docker container nor pg_dump binary found." >&2
    echo "  Hint: Ensure the container is started with 'docker compose -f compose.prod.yaml up -d'" >&2
    exit 1
fi

# Verify archive integrity
if ! gzip -t "${BACKUP_FILE}"; then
    echo "[SHINPO DB BACKUP] ERROR: Created archive '${BACKUP_FILE}' failed gzip integrity test!" >&2
    rm -f "${BACKUP_FILE}"
    exit 2
fi

BACKUP_SIZE="$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || wc -c < "${BACKUP_FILE}")"
if [[ "${BACKUP_SIZE}" -lt 200 ]]; then
    echo "[SHINPO DB BACKUP] ERROR: Backup file is suspiciously small (${BACKUP_SIZE} bytes)." >&2
    exit 3
fi

# Generate SHA-256 Checksum
if command -v sha256sum &>/dev/null; then
    (cd "${BACKUP_DIR}" && sha256sum "$(basename "${BACKUP_FILE}")" > "${CHECKSUM_FILE}")
elif command -v shasum &>/dev/null; then
    (cd "${BACKUP_DIR}" && shasum -a 256 "$(basename "${BACKUP_FILE}")" > "${CHECKSUM_FILE}")
fi

echo "[SHINPO DB BACKUP] Verified archive created: ${BACKUP_FILE} (${BACKUP_SIZE} bytes)"
if [[ -f "${CHECKSUM_FILE}" ]]; then
    echo "[SHINPO DB BACKUP] Checksum: $(cat "${CHECKSUM_FILE}")"
fi

# Prune backups older than RETENTION_DAYS
echo "[SHINPO DB BACKUP] Pruning snapshots older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f \( -name "shinpo_db_*.sql.gz" -o -name "shinpo_db_*.sql.gz.sha256" \) -mtime +"${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true

echo "[SHINPO DB BACKUP] Backup process completed successfully."
exit 0
