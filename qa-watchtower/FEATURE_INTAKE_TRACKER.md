# Feature Intake Tracker

Use this file to register every feature delivered by the implementation agent before QA test authoring starts.

| Feature ID | Date | Source Task ID | Area | Intent Summary | Risk | Planned Tests | Test Files | Status |
|---|---|---|---|---|---|---|---|---|
| FEAT-BOOTSTRAP-QA | 2026-02-27 | QA-001 | QA Infrastructure | Establish independent QA process, tracking, and reporting workspace | medium | Documentation verification | `qa-watchtower/*` | complete |
| FEAT-W5-ISV2B-CONSTRAINT-SOLVER | 2026-02-27 | W5-ISV2-SPLIT | Frontend Visual (Randomization) | Ensure the constraint explorer enforces mode intent: full base space vs constrained valid-only distributions | high | Component intent tests for empty, base, and dist modes | `tests/components/visuals/ConstraintSolverExplorer.test.tsx` | complete |

## Status Definitions
- `planned`: Feature captured, tests not authored yet.
- `in_test`: Tests being authored or executed.
- `blocked`: Waiting on missing dependency or upstream fix.
- `complete`: Tests merged and all acceptance checks pass.

## Periodic Check Notes
- 2026-03-03: No implementation-agent commits were present after checkpoint `a82a4c2d1b26840b71321469656c60c3d1ab687e`; QA expanded regression coverage instead via `tests/qa/curriculumCoverageAudit.spec.ts`, `tests/components/visuals/EventRegionGame.test.tsx`, and `tests/components/visuals/MailboxSemaphoreGame.test.tsx`, surfacing open curriculum defects for implementation follow-up.
