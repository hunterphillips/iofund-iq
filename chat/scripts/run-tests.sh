#!/usr/bin/env bash
# Condensed test runner: one summary line per suite; full output only on failure.
#
#   pnpm test                  → condensed (✓ suite  N passed)
#   TEST_VERBOSE=1 pnpm test   → stream every assertion (the old behavior)
#
# Reuses the per-suite package.json scripts (test:<name>) so env-file wiring
# stays single-sourced. Each suite exits non-zero on failure (process.exit(1)),
# which is how pass/fail is detected here.
set -uo pipefail
cd "$(dirname "$0")/.."

scripts/copy-data.sh >/dev/null 2>&1

suites=(webhook gap format-move price-move page-context articles threads)
verbose="${TEST_VERBOSE:-}"
[[ "${1:-}" == "--verbose" || "${1:-}" == "-v" ]] && verbose=1

fail=0
for t in "${suites[@]}"; do
  if [[ -n "$verbose" ]]; then
    printf '\n\033[2m── test:%s ──\033[0m\n' "$t"
    pnpm "test:$t" || fail=1
    continue
  fi
  out=$(pnpm "test:$t" 2>&1) && code=0 || code=$?
  if [[ $code -eq 0 ]]; then
    n=$(grep -c '  PASS  ' <<<"$out")
    printf '  \033[32m✓\033[0m %-14s %2d passed\n' "$t" "$n"
  else
    printf '  \033[31m✗ %-14s FAILED\033[0m\n' "$t"
    sed 's/^/      /' <<<"$out"
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  printf '\n\033[32mAll suites passed.\033[0m\n'
else
  printf '\n\033[31mSome suites failed.\033[0m\n'
fi
exit $fail
