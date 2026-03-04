# Feature Intake Tracker

Use this file to register every feature delivered by the implementation agent before QA test authoring starts.

| Feature ID | Date | Source Task ID | Area | Intent Summary | Risk | Planned Tests | Test Files | Status |
|---|---|---|---|---|---|---|---|---|
| FEAT-BOOTSTRAP-QA | 2026-02-27 | QA-001 | QA Infrastructure | Establish independent QA process, tracking, and reporting workspace | medium | Documentation verification | `qa-watchtower/*` | complete |
| FEAT-W5-ISV2B-CONSTRAINT-SOLVER | 2026-02-27 | W5-ISV2-SPLIT | Frontend Visual (Randomization) | Ensure the constraint explorer enforces mode intent: full base space vs constrained valid-only distributions | high | Component intent tests for empty, base, and dist modes | `tests/components/visuals/ConstraintSolverExplorer.test.tsx` | complete |
| FEAT-QA-FOLLOWUP-2026-03-04 | 2026-03-04 | QA-CURRICULUM-INTEGRITY-AUDIT | Curriculum / Navigation | Revalidate stale-link repairs, MDX topic-renderer coverage, learner-facing practice discoverability, and intentional retirement of the interactive demo surface after implementation follow-up | high | Strict link audit plus static QA checks for MDX tag registration and practice-hub discoverability | `tests/qa/curriculumCoverageAudit.spec.ts` | complete |
| FEAT-W5-IUVM1-SPLIT-MERGE | 2026-03-04 | W5-IUVM1-SPLIT-MERGE | Curriculum (UVM) | Validate the completed I-UVM-1 split/merge keeps the factory lesson and merged route references represented in generated curriculum data and fallback links | high | Curriculum generation plus route/fallback integrity audits | `tests/qa/curriculumCoverageAudit.spec.ts` | complete |

## Status Definitions
- `planned`: Feature captured, tests not authored yet.
- `in_test`: Tests being authored or executed.
- `blocked`: Waiting on missing dependency or upstream fix.
- `complete`: Tests merged and all acceptance checks pass.

## Periodic Check Notes
- 2026-03-03: No implementation-agent commits were present after checkpoint `a82a4c2d1b26840b71321469656c60c3d1ab687e`; QA expanded regression coverage instead via `tests/qa/curriculumCoverageAudit.spec.ts`, `tests/components/visuals/EventRegionGame.test.tsx`, and `tests/components/visuals/MailboxSemaphoreGame.test.tsx`, surfacing open curriculum defects for implementation follow-up.
- 2026-03-04: Reviewed `30efbd78a9a794796540f02ac63129973acdb8e0..00928a1cb9777c44bb573c36c61b50767d3cc0c6`; strict link audit, MDX component registry audit, practice discoverability audit, and full Vitest all passed. The prior curriculum/navigation findings were closed, while the infrastructure issue around `npx tsx scripts/generate-curriculum-data.ts` remains open.
