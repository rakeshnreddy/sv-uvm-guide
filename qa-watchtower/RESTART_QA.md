# QA Restart File (Single-File Execution)

Use this as the single source for restarting periodic QA work.

## How to restart
In a new Codex session, send exactly:

`Read and execute /Users/Rakesh/Projects/sv-uvm-guide/qa-watchtower/RESTART_QA.md`

## Current Checkpoint (Update Before Run)
- Last Checked Commit: `9b65b8707586714330a67d215a15e1f6bf78bda5`
- Last Checked Date: `2026-03-06`
- Focus Areas: `labs-platform|iuvm3|qa`
- Run E2E: `no`
- Checkpoint Note: This checkpoint covers the post-WebGL implementation delta through `9b65b870`, including the centralized `W8-LABS-PLATFORM` registry/routing rollout and the completed `W5-IUVM3-SPLIT-MERGE` follow-up. QA added `tests/qa/labsPlatformAudit.spec.ts`; strict labs coverage reproduced three open platform defects: `randomization-advanced-1` points to a missing asset folder, available labs still lack curriculum deep links, and registry ownership metadata conflicts with source lab READMEs. `QA_STRICT_IUVM3_AUDIT=1 npx vitest --run tests/qa/iuvm3SplitMergeAudit.spec.ts` passes, `npm run generate:curriculum` passes, and `npx vitest --run` currently fails on the missing lab asset-path regression. The infrastructure blocker for `npx tsx scripts/generate-curriculum-data.ts` also remains open in restricted/offline shells.

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
- Last Checked Commit: `9b65b8707586714330a67d215a15e1f6bf78bda5`
- Last Checked Date: `2026-03-06`
- Focus Areas: `labs-platform|iuvm3|qa`
- Run E2E: `no`
