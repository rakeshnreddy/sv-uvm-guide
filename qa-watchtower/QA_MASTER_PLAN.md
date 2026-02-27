# QA Master Plan

## Scope
This plan governs independent quality control for SV/UVM curriculum pages, interactive frontend features, labs, and supporting APIs.

## Objectives
- Catch behavioral defects before merge.
- Ensure each feature has intent-based test coverage.
- Prevent regressions in curriculum navigation, visuals, and UVM/SV content quality.
- Produce feedback that is concrete enough to implement without back-and-forth.

## Non-Goals
- Building new learner features unless required for testability.
- Replacing product planning or curriculum ownership decisions.
- Editing implementation or design files as part of normal QA activity.

## Quality Loop
1. Intake
- Read feature diff and linked task (`TASKS.md` / module prompt).
- Capture user-facing intent and technical intent.

2. Risk Scoring
- Assign risk: `critical`, `high`, `medium`, `low`.
- Prioritize by learner impact + regression blast radius.

3. Test Design
- Author assertions for intent, edge cases, and regression boundaries.
- Prefer minimal deterministic tests with strong failure messages.

4. Test Integration
- Unit/integration tests: `tests/**/*.{test,spec}.{ts,tsx}` (Vitest).
- Browser behavior tests: `tests/e2e/**/*.spec.ts` (Playwright).
- Keep tests in common paths so existing scripts execute them.

5. Execution
- Baseline: `npm run lint`, `npm run type-check`, `npm run test`.
- Run targeted e2e for changed behavior.
- Log pass/fail and evidence.

6. Feedback
- On failures, open a finding file in `qa-watchtower/findings/`.
- Include exact repro steps, expected vs actual, and fix guidance.

7. Closure
- Re-test after fixes.
- Mark finding as closed only after test passes.

## Test Design Standards
- Every test must validate feature intent, not implementation trivia.
- Failure output must identify the violated intent.
- Include at least one negative/edge assertion for non-trivial features.
- Avoid flaky timing assumptions; prefer stable selectors and deterministic state.

## Severity Model
- `P0`: Release blocker, data loss, broken core learning path.
- `P1`: Major functionality broken, incorrect curriculum behavior.
- `P2`: Partial degradation, confusing UX, recoverable issue.
- `P3`: Cosmetic or low-impact inconsistency.

## Deliverables Per Feature
- Intake row in `FEATURE_INTAKE_TRACKER.md`.
- New or updated test files in shared suite.
- Analysis entry in `ANALYSIS_LOG.md`.
- Finding file if any acceptance criteria fail.

## Reporting Cadence
- Update trackers once per feature change set.
- Keep findings current as soon as failures are reproduced.
- Keep unresolved P0/P1 findings at the top of `QA_TASKS.md`.
