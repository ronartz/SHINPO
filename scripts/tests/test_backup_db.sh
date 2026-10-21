#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/bin"

printf '%s\n' '#!/bin/sh' 'exit 0' > "$TMP/bin/docker"
printf '%s\n' '#!/bin/sh' 'i=0; while [ "$i" -lt 400 ]; do printf "INSERT INTO sample VALUES (%s, %s, %s);\\n" "$i" "$i" "$i"; i=$((i + 1)); done' > "$TMP/bin/pg_dump"
printf '%s\n' '#!/bin/sh' 'if [ "$1" = "-r" ]; then shift 2; fi' 'if [ "$1" = "-d" ]; then shift 2; fi' 'if [ "$1" = "-o" ]; then out=$2; shift 2; fi' 'cp "$1" "$out"' > "$TMP/bin/age"
chmod 700 "$TMP/bin/"*

run_backup() {
  local directory="$1"
  shift
  PATH="$TMP/bin:/usr/bin:/bin" BACKUP_DIR="$directory" "$@" bash "$ROOT/scripts/backup_db.sh" >/dev/null
}

if run_backup "$TMP/encryption-required" env >/dev/null 2>&1; then
  echo "Backup unexpectedly allowed plaintext without an explicit opt-out or age recipient." >&2
  exit 1
fi
[[ ! -e "$TMP/encryption-required" ]]

PLAIN_DIR="$TMP/plain"
run_backup "$PLAIN_DIR" env BACKUP_ENCRYPTION_REQUIRED=false
[[ "$(stat -c %a "$PLAIN_DIR")" == 700 ]]
PLAIN_FILE=("$PLAIN_DIR"/shinpo_db_*.sql.gz)
[[ "$(stat -c %a "${PLAIN_FILE[0]}")" == 600 ]]
[[ "$(stat -c %a "${PLAIN_FILE[0]}.sha256")" == 600 ]]
gzip -t "${PLAIN_FILE[0]}"
(cd "$PLAIN_DIR" && sha256sum -c "$(basename "${PLAIN_FILE[0]}").sha256" >/dev/null)

ENCRYPTED_DIR="$TMP/encrypted"
PATH="$TMP/bin:/usr/bin:/bin" BACKUP_DIR="$ENCRYPTED_DIR" BACKUP_AGE_RECIPIENT=age1test bash "$ROOT/scripts/backup_db.sh" >/dev/null
ENCRYPTED_FILE=("$ENCRYPTED_DIR"/*.sql.gz.age)
[[ "$(stat -c %a "${ENCRYPTED_FILE[0]}")" == 600 ]]
[[ "$(stat -c %a "${ENCRYPTED_FILE[0]}.sha256")" == 600 ]]
(cd "$ENCRYPTED_DIR" && sha256sum -c "$(basename "${ENCRYPTED_FILE[0]}").sha256" >/dev/null)

DOCKER_DIR="$TMP/docker"
mkdir -p "$DOCKER_DIR"
DOCKER_ARGS_LOG="$TMP/docker-args"
DOCKER_INPUT_MARKER="$TMP/docker-input-received"
export DOCKER_ARGS_LOG DOCKER_INPUT_MARKER
printf '%s\n' '#!/bin/sh' \
  'if [ "$1" = "ps" ]; then [ "${2:-}" = "--format" ] && printf "shinpo-postgres\\n"; exit 0; fi' \
  'if [ "$1" = "exec" ]; then shift; [ "$1" = "-i" ] && shift; shift; printf "%s\\n" "$*" >> "$DOCKER_ARGS_LOG"; IFS= read -r supplied || exit 9; printf "yes\\n" > "$DOCKER_INPUT_MARKER"; i=0; while [ "$i" -lt 400 ]; do printf "INSERT INTO sample VALUES (%s, %s, %s);\\n" "$i" "$i" "$i"; i=$((i + 1)); done; exit 0; fi' > "$TMP/bin/docker"
chmod 700 "$TMP/bin/docker"
run_backup "$DOCKER_DIR" env BACKUP_ENCRYPTION_REQUIRED=false POSTGRES_PASSWORD=qa-password-sentinel
test -f "$DOCKER_INPUT_MARKER"
! rg -F 'qa-password-sentinel' "$DOCKER_ARGS_LOG"
RESTORE_INPUT=$( { printf '%s\n' qa-password-sentinel; printf '%s\n' 'SELECT 1;'; } | \
  sh -c 'IFS= read -r PGPASSWORD || exit 1; test "$PGPASSWORD" = qa-password-sentinel || exit 2; cat')
[[ "$RESTORE_INPUT" == 'SELECT 1;' ]]

STALE_ENCRYPTED="$ENCRYPTED_DIR/shinpo_db_old.sql.gz.age"
printf 'fixture' > "$STALE_ENCRYPTED"
printf 'checksum' > "$STALE_ENCRYPTED.sha256"
touch -d '20 days ago' "$STALE_ENCRYPTED" "$STALE_ENCRYPTED.sha256"
PATH="$TMP/bin:/usr/bin:/bin" BACKUP_DIR="$ENCRYPTED_DIR" BACKUP_AGE_RECIPIENT=age1test RETENTION_DAYS=14 bash "$ROOT/scripts/backup_db.sh" >/dev/null
[[ ! -e "$STALE_ENCRYPTED" && ! -e "$STALE_ENCRYPTED.sha256" ]]

echo "Backup encryption policy, permissions, integrity, encrypted-artifact retention, and age-path checks passed."
