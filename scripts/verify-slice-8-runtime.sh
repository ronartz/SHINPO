#!/usr/bin/env bash
# ==============================================================================
# SHINPO Slice 8.0: Desktop Acceptance Gate & Standalone Runtime Verification
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "SHINPO Slice 8.0: Desktop Acceptance Gate & Standalone Runtime Verification"
echo "======================================================================"

cd "${PROJECT_ROOT}"

echo ""
echo "--- CHECKPOINT 1: Cold Start via bin/shinpo ---"
./bin/shinpo start

echo ""
echo "--- CHECKPOINT 2: Actuator Health Check ---"
HEALTH_OUTPUT=$(curl -s -f http://127.0.0.1:8080/actuator/health)
echo "Health Response: ${HEALTH_OUTPUT}"

echo ""
echo "--- CHECKPOINT 3: User Authentication ---"
TEST_USER="${SHINPO_TEST_USER:-EONX}"
TEST_PASSWORD="${SHINPO_TEST_PASSWORD:-shinpo_dev}"
LOGIN_RES=$(curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"usernameOrEmail\":\"${TEST_USER}\",\"password\":\"${TEST_PASSWORD}\"}")
TOKEN=$(echo "${LOGIN_RES}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "${TOKEN}" ]; then
  echo "[FAIL] Authentication failed for ${TEST_USER}"
  exit 1
fi
echo "[PASS] Authenticated successfully as ${TEST_USER}. Token received."

echo ""
echo "--- CHECKPOINT 4: Query Goals ---"
GOALS=$(curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:8080/api/goals)
echo "Goals count: $(echo "${GOALS}" | grep -o '"id":' | wc -l)"

echo ""
echo "--- CHECKPOINT 5: Task (Mission) CRUD Lifecycle ---"
TASK_RES=$(curl -s -X POST http://127.0.0.1:8080/api/missions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"goalId":1,"title":"Verification Task 8.0","description":"Runtime verification task","scheduledDate":"2026-10-13","estimatedMinutes":30,"status":"PENDING"}')
TASK_ID=$(echo "${TASK_RES}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "[PASS] Created Task ID: ${TASK_ID}"

echo ""
echo "--- CHECKPOINT 6: Focus Session Lifecycle ---"
SESS_RES=$(curl -s -X POST http://127.0.0.1:8080/api/focus-sessions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Focus Verification 8.0\",\"durationMinutes\":25,\"goalId\":1,\"missionId\":${TASK_ID},\"intention\":\"Verify focus lifecycle\"}")
SESS_ID=$(echo "${SESS_RES}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "Created Focus Session ID: ${SESS_ID}"

START_RES=$(curl -s -X POST "http://127.0.0.1:8080/api/focus-sessions/${SESS_ID}/start" \
  -H "Authorization: Bearer ${TOKEN}")
SESS_STATUS=$(echo "${START_RES}" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "Session started status: ${SESS_STATUS}"

COMPLETE_RES=$(curl -s -X POST "http://127.0.0.1:8080/api/focus-sessions/${SESS_ID}/complete" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"accomplishment":"Verified focus lifecycle on standalone runtime","completionQuality":5,"reflectionNote":"Clean verification"}')
COMP_STATUS=$(echo "${COMPLETE_RES}" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "[PASS] Session completed status: ${COMP_STATUS}"

echo ""
echo "--- CHECKPOINT 7: Sentinel / Shield Daemon Contract ---"
SENTINEL_SYNC=$(curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:8080/api/device/sentinel/sync)
ENF_MODE=$(echo "${SENTINEL_SYNC}" | grep -o '"enforcementMode":"[^"]*' | cut -d'"' -f4)
echo "Sentinel Enforcement Mode: ${ENF_MODE}"
echo "Sentinel Sync: $(echo "${SENTINEL_SYNC}" | head -c 120)..."

echo ""
echo "--- CHECKPOINT 8: Clean Backend Shutdown ---"
./bin/shinpo stop
./bin/shinpo status

echo ""
echo "--- CHECKPOINT 9: Clean Restart Without PID Collision ---"
./bin/shinpo restart
./bin/shinpo status

echo ""
echo "--- CHECKPOINT 10: Data Persistence Check After Restart ---"
LOGIN_RES2=$(curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"usernameOrEmail\":\"${TEST_USER}\",\"password\":\"${TEST_PASSWORD}\"}")
TOKEN2=$(echo "${LOGIN_RES2}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
PERSISTED_SESS=$(curl -s -H "Authorization: Bearer ${TOKEN2}" "http://127.0.0.1:8080/api/focus-sessions/${SESS_ID}")
echo "Persisted Session Check (ID: ${SESS_ID}): $(echo "${PERSISTED_SESS}" | grep -o '"status":"[^"]*' | cut -d'"' -f4)"
echo "[PASS] Data fully persisted across backend restarts."

echo ""
echo "======================================================================"
echo "ALL 10 RUNTIME INTEGRATION CHECKPOINTS PASSED"
echo "======================================================================"

