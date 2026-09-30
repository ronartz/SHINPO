#!/usr/bin/env bash
# ==============================================================================
# SHINPO Ralph — Pairing Preflight for an External Coding Agent
# Based on Geoffrey Huntley's Ralph Wiggum iterative paradigm
#
# Usage:
#   ./scripts/ralph/ralph.sh [--max-iterations N] [--dry-run] [--help]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PLAN_FILE="$SCRIPT_DIR/IMPLEMENTATION_PLAN.md"
PROMPT_FILE="$SCRIPT_DIR/PROMPT.md"
AGENTS_FILE="$SCRIPT_DIR/AGENTS.md"
LOG_FILE="$PROJECT_ROOT/.planning/ralph.log"

MAX_ITERATIONS=""
DRY_RUN=false

# ------------------------------------------------------------------------------
# Argument Parsing
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations|-n)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "SHINPO Ralph — Pairing Preflight"
      echo ""
      echo "Usage: ./scripts/ralph/ralph.sh [options]"
      echo ""
      echo "Options:"
      echo "  --max-iterations, -n N   Legacy option; this preflight always runs once"
      echo "  --dry-run                Run validation gates without preparing a task handoff"
      echo "  --help, -h               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ------------------------------------------------------------------------------
# Preflight Verification
# ------------------------------------------------------------------------------
echo "================================================================="
echo "  SHINPO RALPH: PAIRING PREFLIGHT"
echo "================================================================="
echo "• Project Root:    $PROJECT_ROOT"
echo "• Plan File:       $PLAN_FILE"
echo "• Execution:       External coding agent required"
if [[ -n "$MAX_ITERATIONS" ]]; then
  echo "• Legacy iteration option ignored; preflight runs once: $MAX_ITERATIONS"
fi
echo "• Dry Run:         $DRY_RUN"
echo ""

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "❌ Error: Missing plan file: $PLAN_FILE" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "❌ Error: Missing prompt file: $PROMPT_FILE" >&2
  exit 1
fi

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# ------------------------------------------------------------------------------
# Backpressure & Validation Functions
# ------------------------------------------------------------------------------
run_validation_gates() {
  echo "  [Backpressure Gate] Validating builds and tests..."

  # 1. Backend Java compilation check
  echo "  → Running backend tests (mvnw test)..."
  if ! (cd "$PROJECT_ROOT/backend" && ./mvnw test -q); then
    echo "  ❌ Backend tests failed! Backpressure triggered." >&2
    return 1
  fi

  # 2. Frontend TypeScript & lint check
  echo "  → Checking frontend build & types (npm run build)..."
  if ! (cd "$PROJECT_ROOT/frontend" && npm run build --silent); then
    echo "  ❌ Frontend build/typecheck failed! Backpressure triggered." >&2
    return 1
  fi

  echo "  ✅ All backpressure validation gates PASSED."
  return 0
}

# ------------------------------------------------------------------------------
# Main Iteration Loop
# ------------------------------------------------------------------------------
if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍 DRY RUN: Testing validation gates..."
  run_validation_gates
  echo "✅ Dry run completed successfully."
  exit 0
fi

echo "Starting one-pass pairing preflight..."
echo "Started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$LOG_FILE"

PENDING_COUNT=$(grep -c "^\s*- \[ \]" "$PLAN_FILE" || true)
if [[ "$PENDING_COUNT" -eq 0 ]]; then
  echo "🎉 All planned tasks in $PLAN_FILE are marked completed."
  exit 0
fi

echo "• Pending tasks remaining: $PENDING_COUNT"
NEXT_TASK=$(grep "^\s*- \[ \]" "$PLAN_FILE" | head -n 1)
echo "• Target task: $NEXT_TASK"
echo "[Pairing preflight] Targeting: $NEXT_TASK" >> "$LOG_FILE"

if ! run_validation_gates; then
  echo "⚠️  Pre-existing build/test failure detected. Fix before proceeding." >&2
  exit 2
fi

echo ""
echo "================================================================="
echo "  RALPH PAIRING PREFLIGHT COMPLETE"
echo "  • Status: Gates passed; task not executed."
echo "  • Handoff: External agent must implement, validate, and update the plan."
echo "================================================================="
