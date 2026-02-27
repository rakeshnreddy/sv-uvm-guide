# QA Test Suite Linkage

QA tracking and findings live in `qa-watchtower/`, but executable tests are added to the shared repo test paths so they run with standard commands.

## Shared Suite Paths
- Vitest unit/integration: `tests/**/*.{test,spec}.{ts,tsx}`
- Playwright e2e: `tests/e2e/**/*.spec.ts`

## Command Coverage
- `npm run test` runs all Vitest files in `tests/` (includes QA-authored tests).
- `npx vitest --run` also runs all Vitest files in `tests/` (includes QA-authored tests).
- `npm run test:e2e` runs all Playwright specs in `tests/e2e/` (includes `tests/e2e/qa/`).

## Current QA-Authored Shared Tests
- `tests/components/visuals/ConstraintSolverExplorer.test.tsx`

## Rule
Do not place executable test files under `qa-watchtower/`. Keep them in `tests/` or `tests/e2e/` and reference them from QA trackers.
