# TASKS.md — Active Backlog and Site State

Last Updated: 2026-10-03
Purpose: Single source of truth for active pending work. Session state lives in `SESSION_HANDOFF.txt`. Detailed progress for the active workstream is tracked in `docs/planning/lesson-analysis-tracker.md`. The full implementation spec for the T1 upgrade is at `docs/planning/foundational-upgrade-spec.md`.

Learning-outcome audit + visual slice (2026-10-03): [audit index](docs/audit/2026-10-03-learning-outcomes/README.md) · [improvement plan](docs/audit/2026-10-03-learning-outcomes/improvement-plan.md) · [handoff prompt](docs/audit/2026-10-03-learning-outcomes/implementation-handoff-prompt.md) · [visual language](docs/visual-learning/visual-language.md).

Context audit (2026-10-03): [Project analysis](docs/project-analysis-2026-10-03.md) and [new-agent prompt](docs/agent-context-prompt.md). Analysis performed on latest merged `main`, `488f7f43`; active task statuses below are unchanged. The report distinguishes fresh local checks from historical CI and documents schema/integration gaps before implementation resumes.

---

## Active Pending Tasks

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| 1 | T1-FOUNDATIONAL-UPGRADE | P0 | in_progress | Execute the Foundational Curriculum Implementation Spec: Add LRM citations, normalize code styles, migrate to foundational_systemverilog.json, add 6 new visualizers, and standard katas for all 13 T1 modules. | 2026-10-03: F3C delivered as the visual-first reference lesson (spec's `RaceConditionDebugger` + 4 companion visuals on a tested scheduler model, 2 katas); scheduling content corrected in F2C/F3A/F3B/F4C. **Before continuing, fix the spec's clause numbers and region model** (audit appendix A §6). Next: NetResolutionSimulator (VIS-SV-1), ClockingBlockSkewVisualizer (VIS-SV-5), foundational bank via the existing bank schema, katas for the other 12 modules. |
| 2 | DEEP-ANALYSIS-SWEEP | P1 | in_progress | Fresh-eyes 7-dimension analysis of all 69 curriculum modules — analyze → implement → validate → close, one module at a time | Paused for T1-FOUNDATIONAL-UPGRADE |

## Recently Completed Workstreams

| ID | Priority | Status | Description | Validation |
|---|---|---|---|---|
| VISUAL-F3C-SLICE | P0 | complete | Learning-outcome audit (6 deliverables + 9 appendices) and first visual-learning slice: deterministic IEEE 1800-2023 §4.5 scheduler model, reusable visual system, F3C rebuilt prediction-first; platform fixes for InteractiveCode extraction, GFM tables + callouts, numeric quiz keys, interview playground options, code ligatures, mobile lesson overflow (28→12 lessons), MDX nested-paragraph hydration errors (7 lessons → 0); scheduling misconceptions corrected and lint-guarded. | Preloaded vitest 128 files / 836 pass / 5 skip; type-check; lint; validate:content (105 MDX / 29 manifests); generate:curriculum no drift; production build + bundle budget pass; Playwright sweep of all 105 lessons at 390 px (0 page errors, 0 literal callouts/pipe tables/`[object Object]`; 12 legacy-component overflows remain → PLAT-5). |
| PR391-MERGE-BLOCKERS | P0 | complete | Close the PR #391 trust-boundary and release blockers: server-authoritative lab completion and assessment grading, usable self-attested lab steps, corrected AXI deadlock lab, index-aware Find Bit highlighting, real editor-backed queued simulation with an isolated Docker worker, legacy-content migration preservation, and required release checks. | 120 Vitest files / 795 tests; 12 Playwright learner flows; 23 SystemVerilog references compiled with Verilator; non-empty PostgreSQL 16 migration rehearsal; strict labs; 105 MDX + 29 manifests; production build; bundle guard. |
| FS-UVM-REFACTOR | P0 | complete | Implement the full-stack and UVM refactoring report: canonical auth and durable user state, route-group/server boundaries, secured AI and simulation jobs, typed curriculum/lab pipelines, protocol-correct interactives, WebGL limits, reference-code standards, and mandatory quality gates. | Superseded by the PR391-MERGE-BLOCKERS validation record above. |

## Current Site State

- **Curriculum:** 69 MDX module entry points across T1 Foundational, T2 Intermediate, T3 Advanced, and T4 Expert.
- **Visualizers:** 20 React visualizers in `src/components/visualizers`.
- **Practice labs:** 29 manifest-backed labs generated into `src/generated/lab-registry.ts`.
- **Flashcards:** 64 JSON files under `content/flashcards/`; 54 deck keys registered in `src/lib/flashcard-decks.ts` (F3C added 2026-10-03). 31 MDX references still point to unregistered deck IDs (task PLAT-1).
- **Interview banks:** 6 JSON banks under `content/interview-questions/`.
- **Quality gates:** Vitest (128 files, 841 tests incl. 5 optional skips, as of 2026-10-03), 12 focused Playwright release flows, strict lab/content audits, PostgreSQL migration rehearsal, SV reference compilation, production build, bundle budgets, and isolated simulation-runner image construction in CI.

Latest local validation (2026-10-03): generation, clean type-check, lint, strict labs, content/redirect checks, production build, bundle guard, and 62 authored internal HTTP paths passed. Ordinary `npm test` has one local missing-secret test failure caused by Prisma reloading `.env`; `NODE_OPTIONS='--require @prisma/client' npm test` passed all 120 files (790 passed, 5 skipped). The optional strict link audit has stale route matching. Authenticated E2E, migration rehearsal, Docker execution, and SV compilation were not rerun locally; see the analysis for prerequisites and evidence.

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

## Proposed (not yet prioritized)

From the 2026-10-03 learning-outcome audit. The full table, with scope, acceptance and validation, is in [improvement-plan.md](docs/audit/2026-10-03-learning-outcomes/improvement-plan.md). Suggested order:

1. PLAT-3/4/5: dead links, test isolation, mobile/table guard.
2. TRUST-1…6: UVM, RAL, AMBA, T2-SV and T1 semantic sweeps with lints.
3. PLAT-1/2: flashcard registry, authored navigation order.
4. RUN-1…5: runnable, mutant-graded labs with a UVM-capable runner.
5. LAB-M1 → LAB-M8: graded milestone ladder.
6. VIS-*: visual rollout on `src/components/visual-system/`.
7. PROG/ASSESS: progress and assessment truth.

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
