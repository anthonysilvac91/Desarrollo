#!/usr/bin/env bash
# =============================================================================
# Tests for .github/scripts/lint-check.sh
# Covers all fail-closed scenarios described in .github/LINT_DEBT.md.
#
# Run from the repo root:
#   bash .github/scripts/test-lint-check.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINT_CHECK="$SCRIPT_DIR/lint-check.sh"

if [ ! -f "$LINT_CHECK" ]; then
  echo "ERROR: $LINT_CHECK not found" >&2
  exit 1
fi

PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FAKE_BIN="$TMP/bin"
mkdir -p "$FAKE_BIN"

# ─── Helpers ──────────────────────────────────────────────────────────────────

# make_fake_npx <output-string> <exit-code>
# Creates a fake `npx` binary that writes the given string to stdout and exits
# with the given code, ignoring all arguments.
make_fake_npx() {
  local exit_code="$2"
  printf '%s\n' "$1" > "$TMP/fake_npx_output"
  # Use single-quoted heredoc delimiter to prevent expansion inside the script
  # body, except for the path and exit code which must be embedded now.
  cat > "$FAKE_BIN/npx" <<SCRIPT
#!/usr/bin/env bash
cat '$TMP/fake_npx_output'
exit $exit_code
SCRIPT
  chmod +x "$FAKE_BIN/npx"
}

# make_fake_npm <output-string> <exit-code>
make_fake_npm() {
  local exit_code="$2"
  printf '%s\n' "$1" > "$TMP/fake_npm_output"
  cat > "$FAKE_BIN/npm" <<SCRIPT
#!/usr/bin/env bash
cat '$TMP/fake_npm_output'
exit $exit_code
SCRIPT
  chmod +x "$FAKE_BIN/npm"
}

run_test() {
  local name="$1"
  local expected_exit="$2"
  shift 2

  local actual_exit=0
  "$@" > "$TMP/test_output" 2>&1 || actual_exit=$?

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    printf "${GREEN}PASS${NC} [exit=%s] %s\n" "$actual_exit" "$name"
    PASS=$((PASS + 1))
  else
    printf "${RED}FAIL${NC} [expected=%s got=%s] %s\n" "$expected_exit" "$actual_exit" "$name"
    sed 's/^/     /' "$TMP/test_output"
    FAIL=$((FAIL + 1))
  fi
}

# ─── Baseline fixtures ────────────────────────────────────────────────────────

GOOD_BASELINE="$TMP/baseline.json"
cat > "$GOOD_BASELINE" <<'EOF'
{
  "_doc": "test fixture — do not commit",
  "backend":  { "max_errors": 10, "max_warnings": 5 },
  "frontend": { "max_errors": 2,  "max_warnings": 3 }
}
EOF

BAD_JSON_BASELINE="$TMP/bad_json.json"
printf '{not: valid json' > "$BAD_JSON_BASELINE"

NO_AREA_BASELINE="$TMP/no_area.json"
cat > "$NO_AREA_BASELINE" <<'EOF'
{ "_doc": "test", "other": { "max_errors": 0, "max_warnings": 0 } }
EOF

BAD_ERRORS_TYPE_BASELINE="$TMP/bad_errors_type.json"
cat > "$BAD_ERRORS_TYPE_BASELINE" <<'EOF'
{ "backend": { "max_errors": "lots", "max_warnings": 5 } }
EOF

NEG_WARN_BASELINE="$TMP/neg_warn.json"
cat > "$NEG_WARN_BASELINE" <<'EOF'
{ "backend": { "max_errors": 0, "max_warnings": -1 } }
EOF

MISSING_FIELDS_BASELINE="$TMP/missing_fields.json"
cat > "$MISSING_FIELDS_BASELINE" <<'EOF'
{ "backend": { "description": "no threshold fields" } }
EOF

# ─── Test suite ───────────────────────────────────────────────────────────────

printf "\n${BOLD}================================================================${NC}\n"
printf "${BOLD}lint-check.sh — fail-closed test suite${NC}\n"
printf "${BOLD}================================================================${NC}\n\n"

# ── Group 1: Baseline/JSON validation ─────────────────────────────────────────
printf "${BOLD}Group 1: Baseline validation${NC}\n"
printf -- '%.0s-' {1..40}; echo

run_test "invalid JSON baseline → exit 1" 1 \
  bash "$LINT_CHECK" backend "$BAD_JSON_BASELINE"

run_test "area not found in baseline → exit 1" 1 \
  bash "$LINT_CHECK" backend "$NO_AREA_BASELINE"

run_test "max_errors is not an integer → exit 1" 1 \
  bash "$LINT_CHECK" backend "$BAD_ERRORS_TYPE_BASELINE"

run_test "max_warnings is negative → exit 1" 1 \
  bash "$LINT_CHECK" backend "$NEG_WARN_BASELINE"

run_test "max_errors/max_warnings fields absent → exit 1" 1 \
  bash "$LINT_CHECK" backend "$MISSING_FIELDS_BASELINE"

# ── Group 2: Lint output — backend (npx eslint) ───────────────────────────────
echo
printf "${BOLD}Group 2: Lint output — backend (npx eslint)${NC}\n"
printf -- '%.0s-' {1..40}; echo

# Within baseline: 5 errors ≤ 10, 2 warnings ≤ 5 → pass
make_fake_npx "✖ 7 problems (5 errors, 2 warnings)" 1
run_test "within baseline → exit 0" 0 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# Errors exceed baseline: 11 > 10 → fail
make_fake_npx "✖ 13 problems (11 errors, 2 warnings)" 1
run_test "errors above baseline → exit 1" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# Warnings exceed baseline: 6 > 5 → fail
make_fake_npx "✖ 14 problems (8 errors, 6 warnings)" 1
run_test "warnings above baseline → exit 1" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# Clean run: exit 0, no output → treat as 0/0 and pass
make_fake_npx "" 0
run_test "clean lint (exit 0, no summary) → exit 0" 0 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# Exit 1 but no ESLint summary line → FAIL CLOSED (no false negative)
make_fake_npx "Error: something went wrong internally" 1
run_test "exit 1 but no summary line → fail closed (exit 1)" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# Summary matched but error count is not extractable → FAIL CLOSED
make_fake_npx "3 problems detected (no breakdown available)" 1
run_test "malformed summary (no error count) → fail closed (exit 1)" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# ESLint crash — exit 2 (config error / missing dependency)
make_fake_npx "Error: Cannot find module '@typescript-eslint/parser'" 2
run_test "lint crash (exit 2) → fail closed (exit 2)" 2 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# ESLint crash — exit 3+
make_fake_npx "Fatal error: out of memory" 3
run_test "lint crash (exit 3) → fail closed (exit 3)" 3 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" backend "$GOOD_BASELINE"

# ── Group 3: Lint output — frontend (npm run lint) ────────────────────────────
echo
printf "${BOLD}Group 3: Lint output — frontend (npm run lint)${NC}\n"
printf -- '%.0s-' {1..40}; echo

# Within baseline: 1 error ≤ 2, 2 warnings ≤ 3 → pass
make_fake_npm "✖ 3 problems (1 error, 2 warnings)" 1
run_test "frontend within baseline → exit 0" 0 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" frontend "$GOOD_BASELINE"

# Warnings exceed baseline: 4 > 3 → fail
make_fake_npm "✖ 5 problems (1 error, 4 warnings)" 1
run_test "frontend warnings above baseline → exit 1" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" frontend "$GOOD_BASELINE"

# Frontend lint crash — exit 2
make_fake_npm "error - ESLint configuration problem" 2
run_test "frontend lint crash (exit 2) → fail closed (exit 2)" 2 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" frontend "$GOOD_BASELINE"

# Frontend: exit 1 but no summary → fail closed
make_fake_npm "Unexpected error in lint pipeline" 1
run_test "frontend exit 1 but no summary → fail closed (exit 1)" 1 \
  env PATH="$FAKE_BIN:$PATH" bash "$LINT_CHECK" frontend "$GOOD_BASELINE"

# ── Summary ───────────────────────────────────────────────────────────────────
echo
printf "${BOLD}================================================================${NC}\n"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -gt 0 ]; then
  printf "${RED}FAILED${NC}: %d/%d tests passed, %d failed\n" "$PASS" "$TOTAL" "$FAIL"
else
  printf "${GREEN}ALL PASSED${NC}: %d/%d\n" "$PASS" "$TOTAL"
fi
printf "${BOLD}================================================================${NC}\n\n"

[ "$FAIL" -eq 0 ]
