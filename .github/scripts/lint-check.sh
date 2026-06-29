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

# Validate baseline file is valid JSON before attempting to parse it
if ! jq empty "$BASELINE_FILE" 2>/dev/null; then
  echo "Error: ${BASELINE_FILE} contains invalid JSON" >&2
  exit 1
fi

# Validate the target area exists in the baseline
if ! jq -e ".${TARGET}" "$BASELINE_FILE" > /dev/null 2>&1; then
  echo "Error: area '${TARGET}' not found in ${BASELINE_FILE}" >&2
  echo "Available areas: $(jq -r 'keys | map(select(startswith("_") | not)) | join(", ")' "$BASELINE_FILE")" >&2
  exit 1
fi

MAX_ERRORS=$(jq -r ".${TARGET}.max_errors" "$BASELINE_FILE")
MAX_WARNINGS=$(jq -r ".${TARGET}.max_warnings" "$BASELINE_FILE")

if [ "$MAX_ERRORS" = "null" ] || [ "$MAX_WARNINGS" = "null" ]; then
  echo "Error: 'max_errors' or 'max_warnings' missing for '${TARGET}' in ${BASELINE_FILE}" >&2
  exit 1
fi

# Validate that max_errors and max_warnings are non-negative integers
if ! [[ "$MAX_ERRORS" =~ ^[0-9]+$ ]]; then
  echo "Error: max_errors for '${TARGET}' must be a non-negative integer, got: '${MAX_ERRORS}'" >&2
  exit 1
fi

if ! [[ "$MAX_WARNINGS" =~ ^[0-9]+$ ]]; then
  echo "Error: max_warnings for '${TARGET}' must be a non-negative integer, got: '${MAX_WARNINGS}'" >&2
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
LINT_DID_RUN=0

set +e  # Disable exit-on-error so lint failure does not abort the script
if [ "$TARGET" = "backend" ]; then
  npx eslint "{src,apps,libs,test}/**/*.ts" 2>&1 | tee "$LINT_TMP"
  LINT_EXIT="${PIPESTATUS[0]}"
  LINT_DID_RUN=1
else
  npm run lint 2>&1 | tee "$LINT_TMP"
  LINT_EXIT="${PIPESTATUS[0]}"
  LINT_DID_RUN=1
fi
set -e

echo ""
echo "--- Baseline evaluation ---"
echo ""

# Guard: ensure the lint command was actually dispatched
if [ "$LINT_DID_RUN" -eq 0 ]; then
  echo "ERROR: Lint command was not dispatched — unknown target '${TARGET}'." >&2
  rm -f "$LINT_TMP"
  exit 1
fi

# Exit code 2+ means a tool/config/crash error, not lint findings.
# Surface immediately so it is not silently swallowed.
if [ "$LINT_EXIT" -ge 2 ]; then
  echo "ERROR: Lint tool exited with unexpected code ${LINT_EXIT}." >&2
  echo "This indicates a configuration error, missing dependency, or crash — not lint findings." >&2
  echo "Last 20 lines of lint output:" >&2
  tail -20 "$LINT_TMP" >&2
  rm -f "$LINT_TMP"
  exit "$LINT_EXIT"
fi

# Parse the ESLint summary line:
#   "✖ N problems (E errors, W warnings)"
# Works for "error"/"errors" and "warning"/"warnings" (singular and plural).
SUMMARY=$(grep -E '[0-9]+ problem' "$LINT_TMP" | tail -1 || true)

if [ -z "$SUMMARY" ]; then
  if [ "$LINT_EXIT" -eq 0 ]; then
    # Lint completed with exit 0 and no summary — the run was clean (0 problems).
    ACTUAL_ERRORS=0
    ACTUAL_WARNINGS=0
    echo "No lint problems found."
  else
    # FAIL CLOSED: lint exited non-zero but no recognizable ESLint summary was found.
    # Do NOT assume 0 errors — this most likely indicates a crash, a missing
    # file/pattern, an invalid config, or a broken output format.
    echo "ERROR: Lint exited with code ${LINT_EXIT} but no valid ESLint summary line was found." >&2
    echo "Expected a line matching '[0-9]+ problem(s)' in the output." >&2
    echo "This may indicate a crash, invalid config, missing dependency, or unexpected format." >&2
    echo "Last 20 lines of lint output:" >&2
    tail -20 "$LINT_TMP" >&2
    rm -f "$LINT_TMP"
    exit 1
  fi
else
  echo "Summary : $SUMMARY"
  ACTUAL_ERRORS=$(echo "$SUMMARY" | grep -oP '\d+(?= error)' || true)
  ACTUAL_WARNINGS=$(echo "$SUMMARY" | grep -oP '\d+(?= warning)' || true)

  # Validate extracted counts are non-negative integers — fail if the summary
  # was found but the numeric fields could not be parsed (malformed output).
  if ! [[ "$ACTUAL_ERRORS" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Could not extract a valid error count from ESLint summary." >&2
    echo "Summary line : '${SUMMARY}'" >&2
    echo "Extracted    : '${ACTUAL_ERRORS}'" >&2
    rm -f "$LINT_TMP"
    exit 1
  fi

  if ! [[ "$ACTUAL_WARNINGS" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Could not extract a valid warning count from ESLint summary." >&2
    echo "Summary line : '${SUMMARY}'" >&2
    echo "Extracted    : '${ACTUAL_WARNINGS}'" >&2
    rm -f "$LINT_TMP"
    exit 1
  fi
fi

rm -f "$LINT_TMP"

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
