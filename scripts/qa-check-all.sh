#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILURES=0

run() {
  local name="$1" log="$2"; shift 2
  echo "\n=== $name ==="
  local code=0
  "$@" >"$log" 2>&1 || code=$?
  cat "$log"
  if [ "$code" -ne 0 ]; then
    echo "FAIL: $name (exit $code)"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS: $name"
  fi
  return "$code"
}

require_rust_tests() {
  local name="$1" log="$2"; shift 2
  run "$name" "$log" "$@"
  local code=$?
  local passed
  passed="$(sed -nE 's/^test result: ok\. ([0-9]+) passed;.*/\1/p' "$log" | awk '{n += $1} END {print n+0}')"
  if [ "$passed" -eq 0 ] || grep -Eq '^test result: FAILED|; [1-9][0-9]* failed;' "$log"; then
    echo "FAIL: $name did not report a nonzero all-green Rust test count"
    FAILURES=$((FAILURES + 1))
  fi
  return "$code"
}

require_node_tests() {
  local name="$1" log="$2"; shift 2
  run "$name" "$log" "$@"
  local code=$?
  local count
  count="$(sed -nE 's/^ℹ tests ([0-9]+)$/\1/p' "$log" | tail -1)"
  if [ -z "$count" ] || [ "$count" -eq 0 ] || ! grep -Eq '^ℹ fail 0$' "$log"; then
    echo "FAIL: $name missing a positive test count or zero-failure summary"
    FAILURES=$((FAILURES + 1))
  fi
  return "$code"
}

require_playwright_tests() {
  local name="$1" log="$2"; shift 2
  run "$name" "$log" "$@"
  local code=$?
  if ! grep -Eq '[1-9][0-9]* passed' "$log"; then
    echo "FAIL: $name did not report a positive executed-test count"
    FAILURES=$((FAILURES + 1))
  fi
  return "$code"
}

cd "$ROOT"
echo "SHINPO full source quality gate: $(git rev-parse --short HEAD) ($(git status --porcelain | wc -l | tr -d ' ') dirty paths)"

if git ls-files | grep -E '(^|/)(target|dist|node_modules)/|(^|/)(release|bundle)/[^/]+\.(rpm|deb|AppImage|msi|exe|tar\.gz)$'; then
  echo "FAIL: generated binaries/build output are tracked"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: no tracked build directories or release binaries"
fi

run "Legacy backend exclusion guardrail" "$TMP/no-legacy-backend.log" ./scripts/check-no-legacy-backend.sh
release_artifact=""
release_scan_status=0
if [ -d release ]; then
  release_artifact="$(find release -type f -regextype posix-extended -regex '.*\.(rpm|deb|AppImage|msi|exe|tar\.gz)$' -print -quit 2>"$TMP/release-scan.stderr")" || release_scan_status=$?
fi
if [ "$release_scan_status" -ne 0 ]; then
  cat "$TMP/release-scan.stderr"
  echo "FAIL: could not verify release/ artifact state (find exit $release_scan_status)"
  FAILURES=$((FAILURES + 1))
elif [ -n "$release_artifact" ]; then
  echo "FAIL: stale local installer/archive remains under release/"
  printf '%s\n' "$release_artifact"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: release/ contains no untraceable local installer/archive"
fi

run "Frontend TypeScript" "$TMP/frontend-typecheck.log" bash -c 'cd frontend && npx tsc -b --pretty false'
run "Frontend ESLint" "$TMP/frontend-lint.log" npm --prefix frontend run lint
require_node_tests "Frontend tests" "$TMP/frontend-test.log" npm --prefix frontend test
run "Frontend production build" "$TMP/frontend-build.log" npm --prefix frontend run build

require_rust_tests "Tauri Rust tests" "$TMP/tauri-test.log" cargo test --locked --manifest-path frontend/src-tauri/Cargo.toml --lib -- --test-threads=1
run "Tauri strict Clippy" "$TMP/tauri-clippy.log" cargo clippy --locked --manifest-path frontend/src-tauri/Cargo.toml --all-targets -- -D warnings
run "Tauri formatting" "$TMP/tauri-fmt.log" cargo fmt --manifest-path frontend/src-tauri/Cargo.toml --check
run "Headless native smoke test" "$TMP/native-smoke.log" cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test
if ! grep -Fq 'PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header' "$TMP/native-smoke.log"; then
  echo "FAIL: headless native smoke test did not report its complete persistence assertion"
  FAILURES=$((FAILURES + 1))
fi

require_rust_tests "Shield Rust tests" "$TMP/shield-test.log" cargo test --locked --manifest-path crates/shinpo-shield/Cargo.toml
run "Shield strict Clippy" "$TMP/shield-clippy.log" cargo clippy --locked --manifest-path crates/shinpo-shield/Cargo.toml --all-targets -- -D warnings
run "Shield formatting" "$TMP/shield-fmt.log" cargo fmt --manifest-path crates/shinpo-shield/Cargo.toml --check

require_rust_tests "Browser Host Rust tests" "$TMP/host-test.log" cargo test --locked --manifest-path crates/shinpo-browser-host/Cargo.toml
run "Browser Host strict Clippy" "$TMP/host-clippy.log" cargo clippy --locked --manifest-path crates/shinpo-browser-host/Cargo.toml --all-targets -- -D warnings
run "Browser Host formatting" "$TMP/host-fmt.log" cargo fmt --manifest-path crates/shinpo-browser-host/Cargo.toml --check

run "Tauri RustSec audit (deny unsound)" "$TMP/tauri-audit.log" cargo audit --deny unsound --file frontend/src-tauri/Cargo.lock
run "Shield RustSec audit (deny unsound)" "$TMP/shield-audit.log" cargo audit --deny unsound --file crates/shinpo-shield/Cargo.lock
run "Browser Host RustSec audit (deny unsound)" "$TMP/host-audit.log" cargo audit --deny unsound --file crates/shinpo-browser-host/Cargo.lock

npm --prefix frontend audit --omit=dev --json >"$TMP/npm-audit.json" 2>"$TMP/npm-audit.stderr"
npm_code=$?
cat "$TMP/npm-audit.stderr"
node -e 'const fs=require("node:fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=r.metadata?.vulnerabilities;if(!v||!["info","low","moderate","high","critical"].every(k=>Number.isInteger(v[k])))process.exit(2);const n=["info","low","moderate","high","critical"].reduce((a,k)=>a+v[k],0);console.log(`Production npm advisories: ${n}`);if(n)process.exit(1)' "$TMP/npm-audit.json"
npm_parse_code=$?
if [ "$npm_parse_code" -ne 0 ]; then
  echo "UNAVAILABLE: production npm audit result could not be validated (npm exit $npm_code, result validation exit $npm_parse_code)"
  FAILURES=$((FAILURES + 1))
elif [ "$npm_code" -ne 0 ]; then
  echo "FAIL: production npm audit (npm exit $npm_code)"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: production npm audit"
fi

run "Security/SQLCipher gate" "$TMP/security.log" node scripts/qa-security.mjs

if command -v semgrep >/dev/null 2>&1; then
  run "Semgrep SAST scan" "$TMP/semgrep.log" semgrep scan --config auto --error
elif [ -n "${CI:-}" ]; then
  echo "FAIL: semgrep required in CI environment"
  FAILURES=$((FAILURES + 1))
else
  echo "INFO: semgrep CLI not found locally; covered by CI semgrep job"
fi

if command -v osv-scanner >/dev/null 2>&1; then
  run "OSV-Scanner dependency scan" "$TMP/osv-scanner.log" osv-scanner scan -r .
elif [ -n "${CI:-}" ]; then
  echo "FAIL: osv-scanner required in CI environment"
  FAILURES=$((FAILURES + 1))
else
  echo "INFO: osv-scanner CLI not found locally; covered by cargo audit & npm audit"
fi

if command -v cargo-deny >/dev/null 2>&1; then
  run "Cargo Deny (advisories & licenses)" "$TMP/cargo-deny.log" cargo deny check
elif [ -n "${CI:-}" ]; then
  echo "FAIL: cargo-deny required in CI environment"
  FAILURES=$((FAILURES + 1))
else
  echo "INFO: cargo-deny CLI not found locally; covered by cargo audit --deny unsound"
fi

require_playwright_tests "Layout contracts" "$TMP/layout.log" npm --prefix frontend run test:e2e -- --project=desktop-chrome e2e/layout-typography-contracts.spec.ts

echo "\n=== QUALITY GATE SUMMARY ==="
if [ "$FAILURES" -eq 0 ]; then
  echo "PASS: every required command completed and reported evidence"
  exit 0
fi
echo "FAIL: $FAILURES gate(s) failed or returned incomplete test evidence"
exit 1
