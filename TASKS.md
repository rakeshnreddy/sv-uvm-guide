# TASKS.md — Active Backlog and Site State

Last Updated: 2026-07-19
Purpose: Single source of truth for active pending work. Session state lives in `SESSION_HANDOFF.txt`. Detailed progress for the active workstream is tracked in `docs/planning/lesson-analysis-tracker.md`. The full implementation spec for the T1 upgrade is at `docs/planning/foundational-upgrade-spec.md`.

---

## Active Pending Tasks

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| 1 | T1-FOUNDATIONAL-UPGRADE | P0 | todo | Execute the Foundational Curriculum Implementation Spec: Add LRM citations, normalize code styles, migrate to foundational_systemverilog.json, add 6 new visualizers, and standard katas for all 13 T1 modules. | See SESSION_HANDOFF.txt for the step-by-step implementation plan. |
| 2 | DEEP-ANALYSIS-SWEEP | P1 | in_progress | Fresh-eyes 7-dimension analysis of all 69 curriculum modules — analyze → implement → validate → close, one module at a time | Paused for T1-FOUNDATIONAL-UPGRADE |

## Recently Completed Workstreams

| ID | Priority | Status | Description | Validation |
|---|---|---|---|---|
| PR391-MERGE-BLOCKERS | P0 | complete | Close the PR #391 trust-boundary and release blockers: server-authoritative lab completion and assessment grading, usable self-attested lab steps, corrected AXI deadlock lab, index-aware Find Bit highlighting, real editor-backed queued simulation with an isolated Docker worker, legacy-content migration preservation, and required release checks. | 120 Vitest files / 795 tests; 12 Playwright learner flows; 23 SystemVerilog references compiled with Verilator; non-empty PostgreSQL 16 migration rehearsal; strict labs; 105 MDX + 29 manifests; production build; bundle guard. |
| FS-UVM-REFACTOR | P0 | complete | Implement the full-stack and UVM refactoring report: canonical auth and durable user state, route-group/server boundaries, secured AI and simulation jobs, typed curriculum/lab pipelines, protocol-correct interactives, WebGL limits, reference-code standards, and mandatory quality gates. | Superseded by the PR391-MERGE-BLOCKERS validation record above. |

## Current Site State

- **Curriculum:** 69 MDX module entry points across T1 Foundational, T2 Intermediate, T3 Advanced, and T4 Expert.
- **Visualizers:** 20 React visualizers in `src/components/visualizers`.
- **Practice labs:** 29 manifest-backed labs generated into `src/generated/lab-registry.ts`.
- **Flashcards:** 56 JSON flashcard decks under `content/flashcards/`.
- **Interview banks:** 6 JSON banks under `content/interview-questions/`.
- **Quality gates:** Vitest (120 files, 795 tests), 12 focused Playwright release flows, strict lab/content audits, PostgreSQL migration rehearsal, SV reference compilation, production build, bundle budgets, and isolated simulation-runner image construction in CI.

## Validation Baseline

Run this sweep before a release or after any future curriculum/lab/navigation change:

```bash
npm run generate:curriculum
npm run type-check
npm test
npm run test:labs:strict
npm run test:migration-rehearsal
npm run test:sv-solutions
npm run validate:content
ANALYZE=true SESSION_SECRET=<release-secret> npm run build
npm run bundle:check
npm run test:e2e:release
```

For lab-specific edits, also run:

```bash
npm test -- tests/lib/lab-registry.test.ts tests/qa/labsPlatformAudit.spec.ts
npm run test:labs:strict
```

## New Task Intake Template

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| 1 | EXAMPLE-TASK-ID | P1 | todo | Short learner or platform outcome | First concrete implementation step |

Use statuses: `todo`, `in_progress`, `blocked`, `complete`.

## Agent Handoff Protocol

1. Read `SESSION_HANDOFF.txt` first — it has the current state and next steps.
2. Read `TASKS.md` for the active task row.
3. Read `docs/planning/lesson-analysis-tracker.md` for module-level progress.
4. Execute the first `todo` or `in_progress` row unless the user redirects.
5. Validate with the smallest relevant checks first, then the broader validation baseline.
6. Update `SESSION_HANDOFF.txt` with changed files, validation results, and next steps.
7. Mark a task `complete` only after all acceptance criteria pass.
