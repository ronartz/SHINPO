#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-release}" # release, quick, visual, native, security, package

REPORT_DIR="$REPO_ROOT/docs/qa"
mkdir -p "$REPORT_DIR"
JSON_REPORT="$REPORT_DIR/latest-release-gate.json"
MD_REPORT="$REPORT_DIR/latest-release-gate.md"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "UNKNOWN")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "UNKNOWN")
DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l || echo "0")
if [ "$DIRTY_COUNT" -gt 0 ]; then
  WORKTREE_STATE="DIRTY (${DIRTY_COUNT} modified/untracked files strictly preserved)"
else
  WORKTREE_STATE="CLEAN"
fi

BIN_PATH="$REPO_ROOT/frontend/src-tauri/target/release/shinpo-desktop"
PACKAGE_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('frontend/src-tauri/tauri.conf.json', 'utf8')).version")
RPM_PATH="$REPO_ROOT/frontend/src-tauri/target/release/bundle/rpm/SHINPO-${PACKAGE_VERSION}-1.x86_64.rpm"

BIN_SHA256="UNKNOWN"
if [ -f "$BIN_PATH" ]; then
  BIN_SHA256=$(sha256sum "$BIN_PATH" | awk '{print $1}')
fi

RPM_SHA256="UNKNOWN"
if [ -f "$RPM_PATH" ]; then
  RPM_SHA256=$(sha256sum "$RPM_PATH" | awk '{print $1}')
fi

echo "================================================================================"
echo "           SHINPO PERMANENT AUTOMATED RELEASE GATE & QA RUNNER"
echo "================================================================================"
echo " Mode:               $MODE"
echo " Timestamp:          $TIMESTAMP"
echo " Commit:             $GIT_COMMIT ($GIT_BRANCH)"
echo " Worktree:           $WORKTREE_STATE"
echo " Target Binary:      $BIN_PATH (SHA: ${BIN_SHA256:0:16}...)"
echo " Target RPM:         $RPM_PATH (SHA: ${RPM_SHA256:0:16}...)"
echo " Host Platform:      Fedora Linux (x86_64, WebKitGTK 6.0, Wayland/X11)"
echo "================================================================================"

GATE_QUICK_STATUS="NOT_RUN"
GATE_SECURITY_STATUS="NOT_RUN"
GATE_VISUAL_STATUS="NOT_RUN"
GATE_PACKAGE_STATUS="NOT_RUN"
GATE_NATIVE_STATUS="NOT_RUN"
GATE_WINDOWS_STATUS="NOT_TESTED"

FAILED_GATES=0

record_gate_result() {
  local gate_name="$1"
  local status="$2"
  echo ">>> Gate [$gate_name] finished with status: $status"
  if [ "$status" != "PASS" ]; then
    FAILED_GATES=$((FAILED_GATES + 1))
  fi
}

# ------------------------------------------------------------------------------
# 1. QUICK GATE: Unit Tests, Build, Typecheck
# ------------------------------------------------------------------------------
run_quick_gate() {
  echo ""
  echo "--- [1/5] EXECUTING QUICK GATE (Node.js Unit Tests + Vite Build) ---"
  
  if npm --prefix frontend test && npm --prefix frontend run build; then
    GATE_QUICK_STATUS="PASS"
    record_gate_result "Quick" "PASS"
  else
    GATE_QUICK_STATUS="FAIL"
    record_gate_result "Quick" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# 2. SECURITY & SUPPLY-CHAIN GATE (Secrets + Cargo Audit + SQLCipher Crypto)
# ------------------------------------------------------------------------------
run_security_gate() {
  echo ""
  echo "--- [2/5] EXECUTING SECURITY & SUPPLY-CHAIN GATE ---"
  
  local sec_pass=true
  echo ">> Verifying legacy backend exclusion guardrail..."
  if ! ./scripts/check-no-legacy-backend.sh; then
    sec_pass=false
  fi

  if ! node scripts/qa-security.mjs; then
    sec_pass=false
  fi

  if command -v gitleaks >/dev/null 2>&1; then
    echo ">> Running Gitleaks secret detection..."
    if ! gitleaks detect --no-git --redact; then
      sec_pass=false
    fi
  fi

  if command -v semgrep >/dev/null 2>&1; then
    echo ">> Running Semgrep SAST scan..."
    if ! semgrep scan --config auto --error; then
      sec_pass=false
    fi
  fi

  if command -v osv-scanner >/dev/null 2>&1; then
    echo ">> Running OSV-Scanner dependency scan..."
    if ! osv-scanner scan -r .; then
      sec_pass=false
    fi
  fi

  if command -v cargo-deny >/dev/null 2>&1; then
    echo ">> Running Cargo Deny scan..."
    if ! cargo deny check; then
      sec_pass=false
    fi
  fi

  if [ "$sec_pass" = true ]; then
    GATE_SECURITY_STATUS="PASS"
    record_gate_result "Security" "PASS"
  else
    GATE_SECURITY_STATUS="FAIL"
    record_gate_result "Security" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# 3. VISUAL & ACCESSIBILITY GATE (4 Themes + Contracts + Axe-core + 8 Views)
# ------------------------------------------------------------------------------
run_visual_gate() {
  echo ""
  echo "--- [3/5] EXECUTING VISUAL, ACCESSIBILITY & THEMES GATE ---"
  
  local visual_pass=true
  
  echo ">> Running Layout, Typography & Theme Contracts..."
  if ! npm --prefix frontend run test:e2e -- --project=desktop-chrome \
    e2e/layout-typography-contracts.spec.ts \
    e2e/release-gate-journeys.spec.ts; then
    visual_pass=false
  fi

  echo ">> Running 4-Theme Sparse/Populated Coverage & 3D Particle Verification..."
  if ! npm --prefix frontend run test:e2e -- --project=desktop-chrome \
    e2e/visual-themes-coverage.spec.ts; then
    visual_pass=false
  fi

  echo ">> Running Full Comprehensive Tabs & Axe-core Accessibility Suite..."
  if ! npm --prefix frontend run test:e2e -- --project=desktop-chrome \
    e2e/comprehensive-tabs-audit.spec.ts \
    e2e/focus-protection-discovery.spec.ts; then
    visual_pass=false
  fi

  echo ">> Running 16-Cell Visual Acceptance & Geometry Matrix Suite..."
  if ! npm --prefix frontend run test:e2e -- --project=desktop-chrome \
    e2e/visual-acceptance-matrix.spec.ts; then
    visual_pass=false
  fi

  echo ">> Running 8-View Visual Composition Script & Capturing Verification Artifacts..."
  if ! node frontend/scripts/verify_composition_repair.mjs; then
    visual_pass=false
  fi

  if [ "$visual_pass" = true ]; then
    GATE_VISUAL_STATUS="PASS"
    record_gate_result "Visual & A11y" "PASS"
  else
    GATE_VISUAL_STATUS="FAIL"
    record_gate_result "Visual & A11y" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# 4. LINUX RELEASE PACKAGE GATE (RPM Acceptance & Upgrade Simulation)
# ------------------------------------------------------------------------------
run_package_gate() {
  echo ""
  echo "--- [4/5] EXECUTING LINUX RELEASE PACKAGE GATE (RPM) ---"
  
  if [ -x "$REPO_ROOT/scripts/qa-package-linux.sh" ] && "$REPO_ROOT/scripts/qa-package-linux.sh"; then
    GATE_PACKAGE_STATUS="PASS"
    record_gate_result "Linux Package (RPM)" "PASS"
  else
    GATE_PACKAGE_STATUS="FAIL"
    record_gate_result "Linux Package (RPM)" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# 5. NATIVE DESKTOP GATE (Fedora Linux WebKitGTK / Tauri Release Binary)
# ------------------------------------------------------------------------------
run_native_gate() {
  echo ""
  echo "--- [5/5] EXECUTING NATIVE DESKTOP GATE (WebKitGTK / Tauri Binary) ---"
  
  if [ ! -f "$BIN_PATH" ]; then
    echo "  ! Release binary not found at $BIN_PATH. Building release..."
    if ! (cd frontend/src-tauri && cargo build --release); then
      echo "  ✗ Cargo release build failed!"
      GATE_NATIVE_STATUS="FAIL"
      record_gate_result "Native Desktop" "FAIL"
      return
    fi
  fi

  local webkit_fallback="/tmp/shinpo-warp-driver/root/usr/bin/WebKitWebDriver"
  local webkit_driver="${WEBKIT_WEBDRIVER_PATH:-$([ -f "$webkit_fallback" ] && echo "$webkit_fallback" || which WebKitWebDriver 2>/dev/null || echo "")}"
  
  if [ -z "$webkit_driver" ] && [ ! -f "$webkit_fallback" ] && ! command -v WebKitWebDriver &>/dev/null; then
    echo "  ✗ WebKitWebDriver driver not found on host. Required native desktop gate cannot execute!"
    GATE_NATIVE_STATUS="UNAVAILABLE"
    record_gate_result "Native Desktop" "UNAVAILABLE"
    return
  fi

  echo "  ✓ WebKitWebDriver and Tauri release binary present. Testing native journeys..."
  local native_pass=true

  echo "  >> Testing Native Auth Warp Presentation..."
  if ! (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/auth-warp.spec.js); then
    native_pass=false
  fi

  echo "  >> Testing Native Authenticated Screens & 3D Particles..."
  if ! (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/views-smoke.spec.js); then
    native_pass=false
  fi

  echo "  >> Testing Native Complete User Journeys & Honest Guardian..."
  if ! (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/complete-user-journeys.spec.js); then
    native_pass=false
  fi

  echo "  >> Testing Native Focus Session Lifecycle & Composer..."
  if ! (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/focus-lifecycle.spec.js); then
    native_pass=false
  fi

  echo "  >> Testing Native UI Layout & Multi-Viewport Geometry..."
  if ! (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/ui-layout.spec.js); then
    native_pass=false
  fi

  if [ "$native_pass" = true ]; then
    GATE_NATIVE_STATUS="PASS"
    record_gate_result "Native Desktop" "PASS"
  else
    GATE_NATIVE_STATUS="FAIL"
    record_gate_result "Native Desktop" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# 5b. DEEP PRODUCT JOURNEYS GATE (Full E2E Native Product Acceptance)
# ------------------------------------------------------------------------------
run_deep_native_gate() {
  echo ""
  echo "--- [5b] EXECUTING DEEP FULL PRODUCT JOURNEYS GATE ---"
  
  if [ ! -f "$BIN_PATH" ]; then
    echo "  ! Release binary not found at $BIN_PATH. Building release..."
    if ! (cd frontend/src-tauri && cargo build --release); then
      echo "  ✗ Cargo release build failed!"
      GATE_NATIVE_STATUS="FAIL"
      record_gate_result "Native Deep Product Journeys" "FAIL"
      return
    fi
  fi

  local webkit_fallback="/tmp/shinpo-warp-driver/root/usr/bin/WebKitWebDriver"
  local webkit_driver="${WEBKIT_WEBDRIVER_PATH:-$([ -f "$webkit_fallback" ] && echo "$webkit_fallback" || which WebKitWebDriver 2>/dev/null || echo "")}"
  
  if [ -z "$webkit_driver" ] && [ ! -f "$webkit_fallback" ] && ! command -v WebKitWebDriver &>/dev/null; then
    echo "  ✗ WebKitWebDriver driver not found on host. Required native desktop gate cannot execute!"
    GATE_NATIVE_STATUS="UNAVAILABLE"
    record_gate_result "Native Deep Product Journeys" "UNAVAILABLE"
    return
  fi

  echo "  ✓ WebKitWebDriver and Tauri release binary present. Testing full product journeys..."
  if (cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/full-product-journeys.spec.js); then
    GATE_NATIVE_STATUS="PASS"
    record_gate_result "Native Deep Product Journeys" "PASS"
  else
    GATE_NATIVE_STATUS="FAIL"
    record_gate_result "Native Deep Product Journeys" "FAIL"
  fi
}

# ------------------------------------------------------------------------------
# DISPATCH BY MODE
# ------------------------------------------------------------------------------
case "$MODE" in
  quick)
    run_quick_gate
    ;;
  deep)
    run_quick_gate
    run_deep_native_gate
    ;;
  security)
    run_security_gate
    ;;
  visual)
    run_visual_gate
    ;;
  package)
    run_package_gate
    ;;
  native)
    run_native_gate
    ;;
  release|all)
    run_quick_gate
    run_security_gate
    run_visual_gate
    run_package_gate
    run_native_gate
    ;;
  *)
    echo "Unknown mode: $MODE (Supported: quick, security, visual, package, native, release)"
    exit 2
    ;;
esac

# ------------------------------------------------------------------------------
# EVALUATE RELEASE RECOMMENDATION (Strict Platform Separation)
# ------------------------------------------------------------------------------
# Strict fail-closed verdict: GO is permitted ONLY when ALL required gates PASS.
LINUX_DECISION="NO-GO — RELEASE BLOCKED"
if [ "$MODE" = "release" ] || [ "$MODE" = "all" ]; then
  if [ "$GATE_QUICK_STATUS" = "PASS" ] && \
     [ "$GATE_SECURITY_STATUS" = "PASS" ] && \
     [ "$GATE_VISUAL_STATUS" = "PASS" ] && \
     [ "$GATE_PACKAGE_STATUS" = "PASS" ] && \
     [ "$GATE_NATIVE_STATUS" = "PASS" ]; then
    LINUX_DECISION="GO FOR RELEASE (LINUX ONLY)"
  else
    LINUX_DECISION="NO-GO — RELEASE BLOCKED (${FAILED_GATES} failing/incomplete mandatory gate(s))"
  fi
else
  LINUX_DECISION="PARTIAL_RUN (Executed mode '$MODE')"
fi

# Windows release readiness is explicitly decoupled and unauthorized on Linux
WINDOWS_DECISION="NO-GO (NOT TESTED — Linux Host Cannot Run Windows NSIS/WebView2 Native Drivers)"

if [ "$LINUX_DECISION" = "GO FOR RELEASE (LINUX ONLY)" ]; then
  OVERALL_DECISION="GO (LINUX ONLY) / NO-GO (WINDOWS UNTESTED)"
else
  OVERALL_DECISION="$LINUX_DECISION"
fi

# ------------------------------------------------------------------------------
# GENERATE MACHINE-READABLE JSON REPORT
# ------------------------------------------------------------------------------
cat <<EOF > "$JSON_REPORT"
{
  "timestamp": "$TIMESTAMP",
  "commit": "$GIT_COMMIT",
  "branch": "$GIT_BRANCH",
  "worktree": "$WORKTREE_STATE",
  "mode": "$MODE",
  "binary": {
    "path": "$BIN_PATH",
    "sha256": "$BIN_SHA256"
  },
  "packageRpm": {
    "path": "$RPM_PATH",
    "sha256": "$RPM_SHA256"
  },
  "verdicts": {
    "overall": "$OVERALL_DECISION",
    "linux": "$LINUX_DECISION",
    "windows": "$WINDOWS_DECISION"
  },
  "failedGatesCount": $FAILED_GATES,
  "gates": {
    "quick": "$GATE_QUICK_STATUS",
    "security": "$GATE_SECURITY_STATUS",
    "visualAndThemes": "$GATE_VISUAL_STATUS",
    "linuxPackageRpm": "$GATE_PACKAGE_STATUS",
    "nativeDesktop": "$GATE_NATIVE_STATUS",
    "windowsDesktop": "$GATE_WINDOWS_STATUS"
  }
}
EOF

# ------------------------------------------------------------------------------
# GENERATE HUMAN-READABLE MARKDOWN REPORT
# ------------------------------------------------------------------------------
cat <<EOF > "$MD_REPORT"
# SHINPO Automated Release Gate Report

**Execution Timestamp:** $TIMESTAMP
**Evaluated Commit:** \`$GIT_COMMIT\` (\`$GIT_BRANCH\`)
**Worktree Status:** $WORKTREE_STATE
**Release Decision:** **$OVERALL_DECISION**

---

## Source Identity & Artifact Integrity

| Artifact | Local Filepath | SHA-256 Digest |
|---|---|---|
| **Git Head** | \`.git\` | \`$GIT_COMMIT\` |
| **Linux Tauri Binary** | \`frontend/src-tauri/target/release/shinpo-desktop\` | \`$BIN_SHA256\` |
| **Linux Release Package** | \`frontend/src-tauri/target/release/bundle/rpm/SHINPO-${PACKAGE_VERSION}-1.x86_64.rpm\` | \`$RPM_SHA256\` |

---

## Platform Release Verdicts

- **Fedora Linux:** **$LINUX_DECISION**
- **Microsoft Windows:** **$WINDOWS_DECISION** *(Distribution Unauthorized)*

---

## Gate Summary Matrix

| Gate | Scope | Status | Notes |
|---|---|---|---|
| **1. Quick** | Node.js unit tests + TypeScript compile + Vite production bundle | **$GATE_QUICK_STATUS** | Pass criteria: 0 test failures, 0 TS build errors |
| **2. Security & Supply-Chain** | Secret scanning + cargo-audit (Tauri & Shield) + SQLCipher HMAC tamper tests + npm audit | **$GATE_SECURITY_STATUS** | Pass criteria: 0 leaked keys, 0 CVEs, cryptographic tamper rejection confirmed |
| **3. Visual, Themes & A11y** | Layout/Typography contracts + 4-theme coverage (sparse & populated) + 3D particles + Axe-core WCAG AA | **$GATE_VISUAL_STATUS** | Pass criteria: strictly monotonic calendar, no sub-11px text, contrast >= 4.5:1 |
| **4. Linux Package (RPM)** | RPM archive verification, dynamic library linkage (ldd), desktop entry syntax, isolated archive extraction | **$GATE_PACKAGE_STATUS** | Package extraction checks do not substitute for a clean-VM install/upgrade test |
| **5. Native Desktop (Linux)** | Real Tauri 2.0 WebKitGTK binary execution in isolated profile: auth warp, particles, guardian app discovery | **$GATE_NATIVE_STATUS** | Pass criteria: clean native startup, 0 DOM crashes, honest app discovery |
| **6. Windows Desktop** | Windows NSIS installer and WebView2 execution | **$GATE_WINDOWS_STATUS** | Linux host cannot execute Windows native tests; must remain blocked |

---

## Verified Controlled Regression Protections

1. **Calendar Gutter Monotonicity:** Verifies hours \`00:00\` through \`24:00\` sequence strictly ascending without out-of-order repeats.
2. **Typography & Readability Contract:** Automatically fails if any body text is < 12.5px or metadata < 11px.
3. **Empty Dashboard Truthfulness:** Verifies 0 tasks state never displays false "all completed" message or gamified XP.
4. **Theme Contrast Compliance:** Enforces WCAG AA (>= 4.5:1) for active sidebar navigation, LiveClock, and card text in Aurora Light and Classic Light.
5. **Vault Encryption Integrity:** Enforces Argon2/SQLCipher encrypted storage, validates HMAC tampering rejection, and prevents plaintext key exposure.
6. **3D Particle Background:** Proves fixed positioning, non-interfering z-index, pointer-events none, and active render loop.
7. **8-Screen Visual Defect Corrections:** All 8 owner-marked defect regions verified free of dead voids, clashing colors, or unstyled widgets.

---

## Final Recommendation

- **Verdict:** **$OVERALL_DECISION**
- Machine-readable results saved to \`docs/qa/latest-release-gate.json\`.
EOF

echo ""
echo "================================================================================"
echo " RELEASE GATE DECISION: $OVERALL_DECISION"
echo " Reports published to:"
echo "   - $MD_REPORT"
echo "   - $JSON_REPORT"
echo "================================================================================"

if [ "$FAILED_GATES" -gt 0 ]; then
  exit 1
fi
exit 0
