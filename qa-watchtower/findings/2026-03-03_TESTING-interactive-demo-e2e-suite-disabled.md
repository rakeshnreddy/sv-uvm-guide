# Finding: interactive demo Playwright suite is disabled, leaving the feature unguarded

- Date: 2026-03-03
- Feature ID: QA-CURRICULUM-INTEGRITY-AUDIT
- Severity: P3
- Status: closed

## Summary
The Playwright coverage for the interactive demo surface is currently disabled via `test.describe.skip`, so a learner-facing demo route can regress without end-to-end detection.

## Affected Area
- Files:
  - `tests/e2e/interactive-demo.spec.ts`
  - `src/app/practice/interactive-demo/page.tsx`
- Modules/Lessons:
  - Practice interactive demo
- Test(s):
  - `tests/e2e/interactive-demo.spec.ts`

## Reproduction
1. Open `tests/e2e/interactive-demo.spec.ts`.
2. Observe `const describeInteractive = test.describe.skip;`.
3. Run Playwright and note the suite is skipped.

## Expected
If the route is supported, the suite should execute. If the route is obsolete, the test and route should be retired deliberately.

## Actual
The suite is skipped unconditionally, so the demo route has no active E2E regression coverage.

## Root Cause Hypothesis
The suite was disabled during a prior stabilization effort and never re-enabled or formally de-scoped.

## Suggested Fix Direction
- If the demo route remains supported, unskip the suite and repair any failing assertions or mocks.
- If the route is no longer part of the intended product surface, remove the dead test and clean up the route.

## Verification to Close
- [x] The suite runs successfully, or the route/test is intentionally removed.
- [x] QA documentation reflects the chosen disposition.
- [x] Findings status updated to `closed`.
