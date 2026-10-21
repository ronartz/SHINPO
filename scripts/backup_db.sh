#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Production Database Backup Script
# Creates a compressed, checksummed PostgreSQL database snapshot with rotation.
# ==============================================================================

set -euo pipefail
umask 077

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
BACKUP_ENCRYPTION_REQUIRED="${BACKUP_ENCRYPTION_REQUIRED:-true}"

case "${BACKUP_ENCRYPTION_REQUIRED,,}" in
    true|false) BACKUP_ENCRYPTION_REQUIRED="${BACKUP_ENCRYPTION_REQUIRED,,}" ;;
    *) echo "[SHINPO DB BACKUP] ERROR: BACKUP_ENCRYPTION_REQUIRED must be true or false." >&2; exit 1 ;;
esac
if [[ "${BACKUP_ENCRYPTION_REQUIRED}" == "true" && -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    echo "[SHINPO DB BACKUP] ERROR: Encryption is required; configure BACKUP_AGE_RECIPIENT. No plaintext backup was created." >&2
    exit 1
fi
if [[ "${BACKUP_ENCRYPTION_REQUIRED}" == "false" && -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    echo "[SHINPO DB BACKUP] WARNING: Explicit plaintext-backup opt-out is enabled." >&2
fi

BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_FILE="${BACKUP_DIR}/shinpo_db_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    command -v age >/dev/null || { echo "[SHINPO DB BACKUP] ERROR: age is required when BACKUP_AGE_RECIPIENT is set." >&2; exit 1; }
    BACKUP_FILE="${BACKUP_FILE}.age"
    CHECKSUM_FILE="${BACKUP_FILE}.sha256"
fi

mkdir -p -m 700 -- "${BACKUP_DIR}"
[[ ! -L "${BACKUP_DIR}" ]] || { echo "[SHINPO DB BACKUP] ERROR: Backup directory must not be a symlink." >&2; exit 1; }
chmod 700 -- "${BACKUP_DIR}"
[[ "$(stat -c %u "${BACKUP_DIR}")" == "$(id -u)" ]] || { echo "[SHINPO DB BACKUP] ERROR: Backup directory must be owned by the current user." >&2; exit 1; }
TEMP_FILE="$(mktemp "${BACKUP_DIR}/.shinpo-backup.XXXXXXXX")"
ENCRYPTED_TEMP=""
trap 'rm -f -- "${TEMP_FILE}" "${ENCRYPTED_TEMP}"' EXIT

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
    printf '%s\n' "${POSTGRES_PASSWORD}" | ${DOCKER_BIN} exec -i "${DOCKER_CONTAINER}" \
        sh -c 'IFS= read -r PGPASSWORD || exit 1; export PGPASSWORD; exec pg_dump -U "$1" -d "$2" --clean --if-exists --no-owner --no-privileges' \
        sh "${POSTGRES_USER}" "${POSTGRES_DB}" \
        | gzip -c > "${TEMP_FILE}"
elif command -v pg_dump &>/dev/null; then
    echo "[SHINPO DB BACKUP] Executing direct pg_dump against ${POSTGRES_HOST}:${POSTGRES_PORT}..."
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --no-privileges \
        | gzip -c > "${TEMP_FILE}"
else
    echo "[SHINPO DB BACKUP] ERROR: Neither running postgres docker container nor pg_dump binary found." >&2
    echo "  Hint: Ensure the container is started with 'docker compose -f compose.prod.yaml up -d'" >&2
    exit 1
fi

# Verify archive integrity
if ! gzip -t "${TEMP_FILE}"; then
    echo "[SHINPO DB BACKUP] ERROR: Created archive failed gzip integrity test!" >&2
    exit 2
fi

BACKUP_SIZE="$(stat -c%s "${TEMP_FILE}" 2>/dev/null || wc -c < "${TEMP_FILE}")"
if [[ "${BACKUP_SIZE}" -lt 200 ]]; then
    echo "[SHINPO DB BACKUP] ERROR: Backup file is suspiciously small (${BACKUP_SIZE} bytes)." >&2
    exit 3
fi

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    ENCRYPTED_TEMP="$(mktemp "${BACKUP_DIR}/.shinpo-encrypted.XXXXXXXX")"
    if ! age -r "${BACKUP_AGE_RECIPIENT}" -o "${ENCRYPTED_TEMP}" "${TEMP_FILE}"; then
        echo "[SHINPO DB BACKUP] ERROR: Backup encryption failed; no final artifact written." >&2
        exit 4
    fi
    mv -- "${ENCRYPTED_TEMP}" "${BACKUP_FILE}"
    ENCRYPTED_TEMP=""
else
    mv -- "${TEMP_FILE}" "${BACKUP_FILE}"
fi
chmod 600 -- "${BACKUP_FILE}"

# Generate SHA-256 Checksum
if command -v sha256sum &>/dev/null; then
    (cd "${BACKUP_DIR}" && sha256sum "$(basename "${BACKUP_FILE}")" > "${CHECKSUM_FILE}")
elif command -v shasum &>/dev/null; then
    (cd "${BACKUP_DIR}" && shasum -a 256 "$(basename "${BACKUP_FILE}")" > "${CHECKSUM_FILE}")
fi
[[ ! -f "${CHECKSUM_FILE}" ]] || chmod 600 -- "${CHECKSUM_FILE}"

echo "[SHINPO DB BACKUP] Verified archive created: ${BACKUP_FILE} (${BACKUP_SIZE} bytes)"
if [[ -f "${CHECKSUM_FILE}" ]]; then
    echo "[SHINPO DB BACKUP] Checksum: $(cat "${CHECKSUM_FILE}")"
fi

# Prune backups older than RETENTION_DAYS
echo "[SHINPO DB BACKUP] Pruning snapshots older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f -name "shinpo_db_*.sql.gz*" -mtime +"${RETENTION_DAYS}" -exec rm -f -- {} + 2>/dev/null || true

echo "[SHINPO DB BACKUP] Backup process completed successfully."
exit 0
