#!/usr/bin/env bash
# ==============================================================================
# SHINPO Standalone Runtime Manager
# Lifecycle management for PostgreSQL (rootless container) + Spring Boot Backend
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# XDG Base Directory specification
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/shinpo"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/shinpo"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/shinpo"

CONFIG_FILE="${CONFIG_DIR}/shinpo.env"
PID_FILE="${STATE_DIR}/shinpo-backend.pid"
LOG_FILE="${DATA_DIR}/shinpo-backend.log"

ensure_directories() {
    mkdir -p "${CONFIG_DIR}"
    chmod 700 "${CONFIG_DIR}"
    mkdir -p "${STATE_DIR}"
    chmod 700 "${STATE_DIR}"
    mkdir -p "${DATA_DIR}"
    chmod 700 "${DATA_DIR}"
}

init_config() {
    ensure_directories
    if [ ! -f "${CONFIG_FILE}" ]; then
        echo "Generating secure standalone configuration at ${CONFIG_FILE}..."
        local jwt_secret
        if command -v openssl >/dev/null 2>&1; then
            jwt_secret=$(openssl rand -hex 32)
        else
            jwt_secret=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 64)
        fi

        cat <<EOF > "${CONFIG_FILE}"
# SHINPO Local Standalone Environment Configuration
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

SERVER_ADDRESS=127.0.0.1
SERVER_PORT=8080

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=shinpo
POSTGRES_USER=shinpo
POSTGRES_PASSWORD=shinpo_dev

# Cryptographically generated 256-bit JWT signing secret
SHINPO_JWT_SECRET=${jwt_secret}

# EONPAI AI Provider Settings (Local Ollama)
SHINPO_AI_ENABLED=true
SHINPO_AI_PROVIDER=ollama
SHINPO_AI_OLLAMA_BASE_URL=http://localhost:11434
SHINPO_AI_OLLAMA_MODEL=qwen3:4b
EOF
        chmod 600 "${CONFIG_FILE}"
        echo "Secure configuration created with mode 600."
    fi

    # Load configuration
    set -a
    # shellcheck disable=SC1090
    source "${CONFIG_FILE}"
    set +a
}

find_jar() {
    if [ -n "${SHINPO_JAR_PATH:-}" ] && [ -f "${SHINPO_JAR_PATH}" ]; then
        echo "${SHINPO_JAR_PATH}"
        return 0
    fi

    local candidate="${PROJECT_ROOT}/backend/target/shinpo-0.0.1-SNAPSHOT.jar"
    if [ -f "${candidate}" ]; then
        echo "${candidate}"
        return 0
    fi

    local installed_candidate="${DATA_DIR}/shinpo.jar"
    if [ -f "${installed_candidate}" ]; then
        echo "${installed_candidate}"
        return 0
    fi

    return 1
}

find_container_engine() {
    if command -v podman >/dev/null 2>&1; then
        echo "podman"
    elif command -v docker >/dev/null 2>&1; then
        echo "docker"
    else
        echo ""
    fi
}

start_postgres() {
    local engine
    engine=$(find_container_engine)
    if [ -z "${engine}" ]; then
        echo "[ERROR] Neither podman nor docker found in PATH."
        exit 1
    fi

    local container_name="shinpo-postgres"
    if ! ${engine} container inspect "${container_name}" >/dev/null 2>&1; then
        echo "Creating ${engine} container '${container_name}' with persisted volume..."
        ${engine} run -d \
            --name "${container_name}" \
            -p "${POSTGRES_PORT}:5432" \
            -e POSTGRES_USER="${POSTGRES_USER}" \
            -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
            -e POSTGRES_DB="${POSTGRES_DB}" \
            -v "shinpo-pgdata:/var/lib/postgresql/data:Z" \
            docker.io/library/postgres:16
    fi

    local status
    status=$(${engine} inspect "${container_name}" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
    if [ "${status}" != "running" ]; then
        echo "Starting PostgreSQL container '${container_name}'..."
        ${engine} start "${container_name}" >/dev/null
    fi

    # Wait for database readiness
    echo -n "Waiting for PostgreSQL database to accept connections..."
    local ready=0
    for _ in $(seq 1 30); do
        if ${engine} exec "${container_name}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
            ready=1
            break
        fi
        sleep 0.5
        echo -n "."
    done
    echo ""

    if [ "${ready}" -ne 1 ]; then
        echo "[ERROR] PostgreSQL container failed to report ready within 15 seconds."
        exit 1
    fi
    echo "[OK] PostgreSQL is ready on ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}."
}

is_backend_alive() {
    if [ ! -f "${PID_FILE}" ]; then
        return 1
    fi
    local pid
    pid=$(cat "${PID_FILE}")
    if [ -z "${pid}" ]; then
        return 1
    fi
    if kill -0 "${pid}" 2>/dev/null; then
        return 0
    else
        rm -f "${PID_FILE}"
        return 1
    fi
}

check_backend_health() {
    local url="http://${SERVER_ADDRESS}:${SERVER_PORT}/actuator/health"
    if curl -s -f -m 2 "${url}" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

start_backend() {
    init_config

    if is_backend_alive; then
        local pid
        pid=$(cat "${PID_FILE}")
        echo "Backend is already running (PID: ${pid})."
        if check_backend_health; then
            echo "[OK] Backend health is UP."
            return 0
        fi
    fi

    # Check if port is taken by another process
    if command -v fuser >/dev/null 2>&1; then
        if fuser "${SERVER_PORT}/tcp" >/dev/null 2>&1; then
            echo "[ERROR] Port ${SERVER_PORT} is already in use by another process."
            exit 1
        fi
    fi

    start_postgres

    local jar_path
    if ! jar_path=$(find_jar); then
        echo "[ERROR] Backend JAR not found. Please build with './mvnw clean package -DskipTests' first."
        exit 1
    fi

    echo "Starting SHINPO Backend JAR: ${jar_path}..."
    nohup setsid java \
        -Dserver.address="${SERVER_ADDRESS}" \
        -Dserver.port="${SERVER_PORT}" \
        -Dspring.datasource.url="jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}" \
        -Dspring.datasource.username="${POSTGRES_USER}" \
        -Dspring.datasource.password="${POSTGRES_PASSWORD}" \
        -Dshinpo.jwt.secret="${SHINPO_JWT_SECRET}" \
        -Dshinpo.ai.enabled="${SHINPO_AI_ENABLED}" \
        -Dshinpo.ai.provider="${SHINPO_AI_PROVIDER}" \
        -Dshinpo.ai.ollama.base-url="${SHINPO_AI_OLLAMA_BASE_URL}" \
        -Dshinpo.ai.ollama.model="${SHINPO_AI_OLLAMA_MODEL}" \
        -jar "${jar_path}" > "${LOG_FILE}" 2>&1 &

    local new_pid=$!
    disown "${new_pid}" 2>/dev/null || true
    echo "${new_pid}" > "${PID_FILE}"
    echo "Backend process launched with PID ${new_pid}. Logs: ${LOG_FILE}"

    echo -n "Waiting for backend health check (/actuator/health)..."
    local healthy=0
    for _ in $(seq 1 60); do
        if check_backend_health; then
            healthy=1
            break
        fi
        if ! kill -0 "${new_pid}" 2>/dev/null; then
            echo ""
            echo "[ERROR] Backend process terminated prematurely. Tail of logs:"
            tail -n 25 "${LOG_FILE}"
            rm -f "${PID_FILE}"
            exit 1
        fi
        sleep 0.5
        echo -n "."
    done
    echo ""

    if [ "${healthy}" -ne 1 ]; then
        echo "[ERROR] Backend failed to become healthy within 30 seconds."
        exit 1
    fi

    echo "[OK] SHINPO Backend is UP and operational on http://${SERVER_ADDRESS}:${SERVER_PORT}."
}

stop_backend() {
    ensure_directories
    if [ ! -f "${PID_FILE}" ]; then
        echo "No PID file found. Backend does not appear to be running."
        return 0
    fi

    local pid
    pid=$(cat "${PID_FILE}")
    if [ -z "${pid}" ]; then
        rm -f "${PID_FILE}"
        return 0
    fi

    if ! kill -0 "${pid}" 2>/dev/null; then
        echo "Backend process (PID ${pid}) was not running. Clearing stale PID file."
        rm -f "${PID_FILE}"
        return 0
    fi

    echo "Stopping SHINPO Backend (PID ${pid})..."
    kill -TERM "${pid}" 2>/dev/null || true

    local stopped=0
    for _ in $(seq 1 20); do
        if ! kill -0 "${pid}" 2>/dev/null; then
            stopped=1
            break
        fi
        sleep 0.5
    done

    if [ "${stopped}" -ne 1 ]; then
        echo "Process did not terminate after 10s. Sending SIGKILL..."
        kill -KILL "${pid}" 2>/dev/null || true
    fi

    rm -f "${PID_FILE}"
    echo "[OK] SHINPO Backend stopped cleanly."
}

status() {
    init_config
    echo "=== SHINPO Runtime Status ==="
    echo "Config: ${CONFIG_FILE}"
    echo "Logs:   ${LOG_FILE}"

    local engine
    engine=$(find_container_engine)
    if [ -n "${engine}" ]; then
        local pg_status
        pg_status=$(${engine} inspect "shinpo-postgres" --format '{{.State.Status}}' 2>/dev/null || echo "NOT_FOUND")
        echo "PostgreSQL container: ${pg_status} (${engine})"
    else
        echo "PostgreSQL container: [no container engine found]"
    fi

    if is_backend_alive; then
        local pid
        pid=$(cat "${PID_FILE}")
        echo "Backend process:      RUNNING (PID ${pid})"
        if check_backend_health; then
            echo "Backend health:       UP (http://${SERVER_ADDRESS}:${SERVER_PORT}/actuator/health)"
        else
            echo "Backend health:       NOT_RESPONDING"
        fi
    else
        echo "Backend process:      STOPPED"
    fi
}

show_logs() {
    ensure_directories
    if [ -f "${LOG_FILE}" ]; then
        tail -f -n 50 "${LOG_FILE}"
    else
        echo "No log file found at ${LOG_FILE}."
    fi
}

launch_desktop() {
    start_backend

    local release_binary="${PROJECT_ROOT}/frontend/src-tauri/target/release/shinpo-desktop"
    if [ -f "${release_binary}" ]; then
        echo "Launching packaged SHINPO Desktop..."
        exec "${release_binary}"
    fi

    local dev_binary="${PROJECT_ROOT}/frontend/src-tauri/target/debug/shinpo-desktop"
    if [ -f "${dev_binary}" ]; then
        echo "Launching SHINPO Desktop..."
        exec "${dev_binary}"
    fi

    echo "Running Tauri desktop runner via npx..."
    (cd "${PROJECT_ROOT}/frontend" && exec npx @tauri-apps/cli dev --no-dev-server)
}

case "${1:-status}" in
    start)
        start_backend
        ;;
    stop)
        stop_backend
        ;;
    restart)
        stop_backend
        sleep 1
        start_backend
        ;;
    status)
        status
        ;;
    logs)
        show_logs
        ;;
    desktop)
        launch_desktop
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|desktop}"
        exit 1
        ;;
esac
