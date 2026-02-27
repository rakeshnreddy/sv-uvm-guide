# QA Restart File (Single-File Execution)

Use this as the single source for restarting periodic QA work.

## How to restart
In a new Codex session, send exactly:

`Read and execute /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/RESTART_QA.md`

## Current Checkpoint (Update Before Run)
- Last Checked Commit: `<replace-with-sha>`
- Last Checked Date: `<YYYY-MM-DD>`
- Focus Areas: `<frontend|curriculum|labs|uvm|all>`
- Run E2E: `<yes|no>`

## Execution Instructions (for Codex)
Role: You are the QA Watchtower agent for this repository. Your job is strict QA only.

Hard constraints:
- Do not modify implementation/design/product files unless explicitly requested by the user.
- Add or update tests only in shared suite paths (`tests/` and `tests/e2e/`) so they run with implementation-agent commands.
- Log all defects in `qa-watchtower/findings/` with reproducible, actionable guidance.

Workflow:
1. Read and honor:
- `qa-watchtower/README.md`
- `qa-watchtower/QA_MASTER_PLAN.md`
- `qa-watchtower/TEST_INTENT_MATRIX.md`
- `qa-watchtower/TEST_SUITE_LINKAGE.md`
- `qa-watchtower/FEATURE_INTAKE_TRACKER.md`
- `qa-watchtower/ANALYSIS_LOG.md`
- `qa-watchtower/QA_TASKS.md`

2. Build quality delta since checkpoint:
- Compare changes in `Last Checked Commit..HEAD`.
- Group changed files into feature-level work items.
- Map each work item to intended behavior and risk.

3. Generate missing tests for all recently implemented features:
- Validate existing coverage first.
- Add missing intent tests in shared suites:
  - Unit/integration: `tests/**/*.{test,spec}.{ts,tsx}`
  - E2E: `tests/e2e/**/*.spec.ts` when route/flow behavior changed
- Ensure each test validates feature intent + at least one edge/negative case for non-trivial features.

4. Run periodic validation commands:
- `npx tsx scripts/generate-curriculum-data.ts`
- `npx vitest --run`
- If first command fails due offline/npm resolution, run `npm run generate:curriculum` and record a finding.
- If `Run E2E` is `yes`, run targeted Playwright tests for changed features; if blocked, log blocker finding.

5. Publish findings for all failed acceptance checks:
- Use `qa-watchtower/findings/FINDING_TEMPLATE.md`.
- Include severity (`P0..P3`), repro steps, expected vs actual, root-cause hypothesis, fix direction, and close criteria.

6. Update QA tracking files:
- `qa-watchtower/FEATURE_INTAKE_TRACKER.md`
- `qa-watchtower/ANALYSIS_LOG.md`
- `qa-watchtower/QA_TASKS.md`
- `qa-watchtower/TEST_SUITE_LINKAGE.md` (if new QA tests added)

7. End-of-run report format:
- New tests added (absolute file paths)
- Findings created/updated (ordered by severity)
- Command outcomes (`npx tsx ...`, `npx vitest --run`, and e2e if run)
- Residual risks + exact next actions for implementation agent

## Definition of Done
- All changes since checkpoint reviewed.
- Missing intent coverage added into shared suites.
- Findings and QA trackers updated.
- Final QA report produced.

## Checkpoint Update After Run
After each completed periodic run, update this section in this same file:
- Last Checked Commit: `<new-head-sha-at-end-of-run>`
- Last Checked Date: `<YYYY-MM-DD>`
- Focus Areas: `<what-was-covered>`
- Run E2E: `<yes|no>`
