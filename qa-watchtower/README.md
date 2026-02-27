# QA Watchtower

This directory is the independent QA workspace for validating all new features built by the implementation agent.

## Mission
- Verify intent, correctness, and regression safety for each new feature.
- Add missing tests into the shared repository test suites (`npm run test` and `npm run test:e2e`).
- Publish actionable findings for fast remediation.

## Operating Rules
- QA owns quality verification, not feature implementation.
- Every feature gets an intent record before test authoring.
- Every defect gets a written finding in `qa-watchtower/findings/`.
- Test additions must be committed under `tests/` so they run in the same suite as all existing tests.
- QA does not modify main implementation/design files except when explicitly requested by you.

## Directory Map
- `QA_MASTER_PLAN.md`: End-to-end quality strategy and execution loop.
- `QA_TASKS.md`: Ongoing QA backlog and status.
- `FEATURE_INTAKE_TRACKER.md`: Feature-by-feature intake and coverage plan.
- `TEST_INTENT_MATRIX.md`: Mapping from feature type to test strategy.
- `ANALYSIS_LOG.md`: Historical run log and QA decisions.
- `TEST_SUITE_LINKAGE.md`: Where QA-authored tests live in the shared suite.
- `findings/`: Defect reports and feedback for the implementation agent.

## Quick Start (Per Feature)
1. Add the feature to `FEATURE_INTAKE_TRACKER.md`.
2. Select tests using `TEST_INTENT_MATRIX.md`.
3. Add or update tests under `tests/` and `tests/e2e/`.
4. Run relevant suites and record outcomes in `ANALYSIS_LOG.md`.
5. If failing, create a finding from `findings/FINDING_TEMPLATE.md`.
