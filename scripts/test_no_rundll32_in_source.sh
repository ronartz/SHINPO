#!/usr/bin/env bash
set -euo pipefail

# test_no_rundll32_in_source: verify zero matches for rundll32, cmd /c, or cmd.exe in source
echo "Executing test_no_rundll32_in_source..."
MATCHES=$(grep -rn --exclude-dir={node_modules,target,dist,.git} --include="*.rs" --include="*.ts" -E "rundll32|cmd /c|cmd\.exe" . || true)
if [ -n "$MATCHES" ]; then
    echo "FAILED: Forbidden shell pattern found in source files:"
    echo "$MATCHES"
    exit 1
fi
echo "PASSED: Zero matches found in *.rs and *.ts files."
