# QA Restart File (Single-File Execution)

Use this as the single source for restarting periodic QA work.

## How to restart
In a new Codex session, send exactly:

`Read and execute /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/RESTART_QA.md`

## Current Checkpoint (Update Before Run)
- Last Checked Commit: `30efbd78a9a794796540f02ac63129973acdb8e0`
- Last Checked Date: `2026-03-03`
- Focus Areas: `curriculum|navigation|visualizations|qa`
- Run E2E: `no`
- Checkpoint Note: This checkpoint now includes the latest reviewed implementation commit (`8e391801`) and the QA follow-up commit (`30efbd78`). On restart, review new changes after `Last Checked Commit`, then use open findings in `qa-watchtower/findings/` plus `qa-watchtower/IMPLEMENTATION_HANDOFF_2026-03-03.md` as the active follow-up queue. If the diff is empty, do not re-audit old commits; only validate new work or explicitly requested regressions.

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
- `qa-watchtower/IMPLEMENTATION_HANDOFF_2026-03-03.md` (if present)

2. Build quality delta since checkpoint:
- Compare changes in `Last Checked Commit..HEAD`.
- Group changed files into feature-level work items.
- Map each work item to intended behavior and risk.
- If the diff is limited to `qa-watchtower/` and `tests/`, treat it as QA maintenance. Prioritize implementation/content changes in `src/`, `content/`, `labs/`, and `public/`.

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
- Last Checked Commit: `30efbd78a9a794796540f02ac63129973acdb8e0`
- Last Checked Date: `2026-03-03`
- Focus Areas: `curriculum|navigation|visualizations|qa`
- Run E2E: `no`
