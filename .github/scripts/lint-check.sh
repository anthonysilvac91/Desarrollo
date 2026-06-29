#!/usr/bin/env bash
# =============================================================================
# TEMPORARY: Lint baseline enforcement — see .github/LINT_DEBT.md
#
# Runs full lint, streams all output to CI logs, and fails ONLY if error or
# warning counts regress beyond the versioned baseline in lint-baseline.json.
#
# Does NOT suppress lint output, does NOT use || true unconditionally,
# does NOT disable ESLint rules, does NOT modify production code.
#
# Remove this script and restore direct lint steps in ci.yml once lint debt
# is cleared. See .github/LINT_DEBT.md for the cleanup plan.
# =============================================================================
# Usage (run from the target project directory — backend/ or frontend/):
#
#   bash "$GITHUB_WORKSPACE/.github/scripts/lint-check.sh" \
#        <target> \
#        "$GITHUB_WORKSPACE/.github/lint-baseline.json"
#
#   target: "backend" | "frontend"
# =============================================================================

set -euo pipefail

TARGET="${1:?First argument required: backend | frontend}"
BASELINE_FILE="${2:?Second argument required: path to lint-baseline.json}"

# Validate prerequisites
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not found in PATH" >&2
  exit 1
fi

if [ ! -f "$BASELINE_FILE" ]; then
  echo "Error: baseline file not found: $BASELINE_FILE" >&2
  exit 1
fi

MAX_ERRORS=$(jq -r ".${TARGET}.max_errors" "$BASELINE_FILE")
MAX_WARNINGS=$(jq -r ".${TARGET}.max_warnings" "$BASELINE_FILE")

if [ "$MAX_ERRORS" = "null" ] || [ "$MAX_WARNINGS" = "null" ]; then
  echo "Error: target '$TARGET' not found in $BASELINE_FILE" >&2
  exit 1
fi

echo "================================================================"
echo "Lint baseline check — $TARGET"
echo "Threshold : <= $MAX_ERRORS errors, <= $MAX_WARNINGS warnings"
echo "Baseline  : .github/lint-baseline.json"
echo "Details   : .github/LINT_DEBT.md"
echo "================================================================"
echo ""
echo "--- Full lint output follows (all findings are shown) ---"
echo ""

# Run lint and capture output for parsing while streaming to stdout.
# Lint exits 1 when findings exist — that is expected and handled below.
LINT_TMP=$(mktemp)

set +e  # Disable exit-on-error so lint failure does not abort the script
if [ "$TARGET" = "backend" ]; then
  npx eslint "{src,apps,libs,test}/**/*.ts" 2>&1 | tee "$LINT_TMP"
  LINT_EXIT="${PIPESTATUS[0]}"
else
  npm run lint 2>&1 | tee "$LINT_TMP"
  LINT_EXIT="${PIPESTATUS[0]}"
fi
set -e

echo ""
echo "--- Baseline evaluation ---"
echo ""

# Exit code 2+ means a tool/config error, not lint findings.
# Surface immediately so it is not silently swallowed.
if [ "$LINT_EXIT" -ge 2 ]; then
  echo "ERROR: Lint tool exited with unexpected code $LINT_EXIT." >&2
  echo "This indicates a tool or configuration error, not lint findings." >&2
  rm -f "$LINT_TMP"
  exit "$LINT_EXIT"
fi

# Parse the ESLint summary line:
#   "✖ N problems (E errors, W warnings)"
# Works for "error"/"errors" and "warning"/"warnings" (singular and plural).
SUMMARY=$(grep -E '[0-9]+ problem' "$LINT_TMP" | tail -1 || true)
rm -f "$LINT_TMP"

if [ -z "$SUMMARY" ]; then
  ACTUAL_ERRORS=0
  ACTUAL_WARNINGS=0
  echo "No lint problems found."
else
  echo "Summary : $SUMMARY"
  ACTUAL_ERRORS=$(echo "$SUMMARY" | grep -oP '\d+(?= error)' || echo "0")
  ACTUAL_WARNINGS=$(echo "$SUMMARY" | grep -oP '\d+(?= warning)' || echo "0")
fi

echo ""
echo "Actual   : $ACTUAL_ERRORS errors, $ACTUAL_WARNINGS warnings"
echo "Baseline : $MAX_ERRORS errors (max), $MAX_WARNINGS warnings (max)"
echo ""

FAILED=0

if [ "$ACTUAL_ERRORS" -gt "$MAX_ERRORS" ]; then
  echo "FAIL: errors regressed — $ACTUAL_ERRORS > $MAX_ERRORS (baseline)"
  FAILED=1
else
  echo "OK  : errors $ACTUAL_ERRORS <= $MAX_ERRORS"
fi

if [ "$ACTUAL_WARNINGS" -gt "$MAX_WARNINGS" ]; then
  echo "FAIL: warnings regressed — $ACTUAL_WARNINGS > $MAX_WARNINGS (baseline)"
  FAILED=1
else
  echo "OK  : warnings $ACTUAL_WARNINGS <= $MAX_WARNINGS"
fi

echo ""

if [ "$FAILED" -eq 1 ]; then
  echo "================================================================"
  echo "LINT BASELINE EXCEEDED"
  echo "Fix the regressions in this PR before merging."
  echo "Do NOT increase values in lint-baseline.json to hide new debt."
  echo "See .github/LINT_DEBT.md for the cleanup plan."
  echo "================================================================"
  exit 1
fi

echo "================================================================"
echo "Lint baseline check passed."
echo "Note: preexisting lint debt is visible in the output above."
echo "See .github/LINT_DEBT.md for the cleanup plan."
echo "================================================================"
