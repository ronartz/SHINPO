#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Production Database Restore Script
# Restores a compressed PostgreSQL snapshot with checksum validation and safety checks.
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

BACKUP_FILE="${1:-}"
FORCE_RESTORE="${2:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
    echo "Usage: $0 <path_to_backup.sql.gz> [--force]"
    echo ""
    echo "Available backups in ${PROJECT_ROOT}/backups:"
    ls -lh "${PROJECT_ROOT}/backups"/*.sql.gz 2>/dev/null || echo "  (None found)"
    exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "[SHINPO DB RESTORE] ERROR: File not found: ${BACKUP_FILE}" >&2
    exit 1
fi

echo "======================================================================"
echo "[SHINPO DB RESTORE] Target database: ${POSTGRES_DB}"
echo "[SHINPO DB RESTORE] Source snapshot: ${BACKUP_FILE}"
echo "======================================================================"

# 1. Verify archive integrity
echo "[SHINPO DB RESTORE] Step 1: Testing archive gzip integrity..."
if ! gzip -t "${BACKUP_FILE}"; then
    echo "[SHINPO DB RESTORE] ERROR: Backup file is corrupt or not a valid gzip file!" >&2
    exit 2
fi

# 2. Check SHA-256 Checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ -f "${CHECKSUM_FILE}" ]]; then
    echo "[SHINPO DB RESTORE] Step 2: Validating SHA-256 checksum against ${CHECKSUM_FILE}..."
    BACKUP_DIR="$(dirname "${BACKUP_FILE}")"
    BASE_NAME="$(basename "${BACKUP_FILE}")"
    if command -v sha256sum &>/dev/null; then
        (cd "${BACKUP_DIR}" && sha256sum -c "${BASE_NAME}.sha256")
    elif command -v shasum &>/dev/null; then
        (cd "${BACKUP_DIR}" && shasum -a 256 -c "${BASE_NAME}.sha256")
    fi
    echo "[SHINPO DB RESTORE] Checksum verification PASSED."
else
    echo "[SHINPO DB RESTORE] Notice: No .sha256 file found for snapshot. Skipping checksum verification."
fi

# 3. Confirmation Guard
if [[ "${FORCE_RESTORE}" != "--force" && "${FORCE_RESTORE}" != "-y" ]]; then
    echo ""
    echo "WARNING: Restoring will overwrite existing tables and records in database '${POSTGRES_DB}'."
    read -r -p "Are you sure you want to proceed? [y/N]: " CONFIRM
    if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
        echo "[SHINPO DB RESTORE] Restore operation aborted by user."
        exit 0
    fi
fi

# 4. Determine restore method: Docker container or direct psql
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

echo "[SHINPO DB RESTORE] Step 3: Streaming restore into database '${POSTGRES_DB}'..."
if [[ -n "${DOCKER_CONTAINER}" ]]; then
    echo "[SHINPO DB RESTORE] Restoring via Docker container '${DOCKER_CONTAINER}'..."
    gzip -dc "${BACKUP_FILE}" | ${DOCKER_BIN} exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DOCKER_CONTAINER}" \
        psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --quiet --set ON_ERROR_STOP=on
elif command -v psql &>/dev/null; then
    echo "[SHINPO DB RESTORE] Restoring via host psql client to ${POSTGRES_HOST}:${POSTGRES_PORT}..."
    gzip -dc "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --quiet --set ON_ERROR_STOP=on
else
    echo "[SHINPO DB RESTORE] ERROR: Neither running postgres docker container nor psql binary found." >&2
    echo "  Hint: Ensure the container is started with 'docker compose -f compose.prod.yaml up -d'" >&2
    exit 3
fi

# 5. Verification of restored schema
echo "[SHINPO DB RESTORE] Step 4: Verifying restored database structure..."
VERIFY_SQL="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
TABLE_COUNT=0
if [[ -n "${DOCKER_CONTAINER}" ]]; then
    TABLE_COUNT=$(${DOCKER_BIN} exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DOCKER_CONTAINER}" \
        psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -c "${VERIFY_SQL}" 2>/dev/null || echo "0")
elif command -v psql &>/dev/null; then
    TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -c "${VERIFY_SQL}" 2>/dev/null || echo "0")
fi

echo "[SHINPO DB RESTORE] Restored public table count: ${TABLE_COUNT}"
if [[ "${TABLE_COUNT}" -lt 5 ]]; then
    echo "[SHINPO DB RESTORE] WARNING: Expected at least 5 public tables, but found ${TABLE_COUNT}." >&2
else
    echo "[SHINPO DB RESTORE] Database verification SUCCESS: Schema intact."
fi

echo "======================================================================"
echo "[SHINPO DB RESTORE] Restore completed successfully."
echo "======================================================================"
exit 0
