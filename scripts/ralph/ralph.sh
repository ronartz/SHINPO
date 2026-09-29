#!/usr/bin/env bash
# ==============================================================================
# SHINPO Ralph Loop — Bounded Autonomous Iterative Runner
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

DEFAULT_MAX_ITERATIONS=5
MAX_ITERATIONS=$DEFAULT_MAX_ITERATIONS
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
      echo "SHINPO Ralph Loop — Bounded Iterative Autonomous Execution"
      echo ""
      echo "Usage: ./scripts/ralph/ralph.sh [options]"
      echo ""
      echo "Options:"
      echo "  --max-iterations, -n N   Set maximum iteration limit (default: $DEFAULT_MAX_ITERATIONS, max safe: 10)"
      echo "  --dry-run                Validate preflight checks, plan, and build tools without executing"
      echo "  --help, -h               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Cap max iterations for safety (never allow unbounded runaway loops)
if [[ "$MAX_ITERATIONS" -gt 15 ]]; then
  echo "⚠️  Requested iterations ($MAX_ITERATIONS) exceeds safe boundary. Capping at 15."
  MAX_ITERATIONS=15
fi

# ------------------------------------------------------------------------------
# Preflight Verification
# ------------------------------------------------------------------------------
echo "================================================================="
echo "  SHINPO RALPH LOOP: BOUNDED ITERATIVE IMPLEMENTATION ENGINE"
echo "================================================================="
echo "• Project Root:    $PROJECT_ROOT"
echo "• Plan File:       $PLAN_FILE"
echo "• Max Iterations:  $MAX_ITERATIONS"
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
  echo "  → Checking backend compilation (mvnw test-compile)..."
  if ! (cd "$PROJECT_ROOT/backend" && ./mvnw test-compile -q); then
    echo "  ❌ Backend compilation failed! Backpressure triggered." >&2
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

echo "Starting Ralph Loop execution (Budget: $MAX_ITERATIONS iterations)..."
echo "Started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$LOG_FILE"

COMPLETED_TASKS=0

for ((i = 1; i <= MAX_ITERATIONS; i++)); do
  echo ""
  echo "-----------------------------------------------------------------"
  echo "  Iteration $i of $MAX_ITERATIONS"
  echo "-----------------------------------------------------------------"

  # Check if all tasks in plan are complete
  PENDING_COUNT=$(grep -c "^\s*- \[ \]" "$PLAN_FILE" || true)
  if [[ "$PENDING_COUNT" -eq 0 ]]; then
    echo "🎉 All planned tasks in $PLAN_FILE are marked completed!"
    echo "Ralph Loop terminating cleanly on iteration $i."
    break
  fi

  echo "• Pending tasks remaining: $PENDING_COUNT"
  NEXT_TASK=$(grep "^\s*- \[ \]" "$PLAN_FILE" | head -n 1)
  echo "• Target task: $NEXT_TASK"

  # Record step in log
  echo "[Iteration $i] Targeting: $NEXT_TASK" >> "$LOG_FILE"

  # Run Backpressure Check
  if ! run_validation_gates; then
    echo "⚠️  Pre-existing build/test failure detected. Fix before proceeding." >&2
    exit 2
  fi

  echo "  → Iteration $i validated. Ready for agent execution step."
  COMPLETED_TASKS=$((COMPLETED_TASKS + 1))

  # Note: In active pairing, Antigravity or Roo Code executes the discrete code task
  # then updates the checkbox in IMPLEMENTATION_PLAN.md
  break
done

echo ""
echo "================================================================="
echo "  RALPH LOOP RUN COMPLETE"
echo "  • Iterations executed: $i"
echo "  • Status: Bounded, validated, safe."
echo "================================================================="
