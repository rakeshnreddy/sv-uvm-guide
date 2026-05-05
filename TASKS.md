# TASKS.md — Active Backlog and Site State

Last Updated: 2026-05-05
Purpose: Single source of truth for active pending work. Session state lives in `SESSION_HANDOFF.txt`. Detailed progress for the active workstream is tracked in `docs/planning/lesson-analysis-tracker.md`.

---

## Active Pending Tasks

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| 1 | DEEP-ANALYSIS-SWEEP | P1 | in_progress | Fresh-eyes 7-dimension analysis of all 69 curriculum modules — analyze → implement → validate → close, one module at a time | Continue from F2C; see SESSION_HANDOFF.txt |

## Current Site State

- **Curriculum:** 69 MDX module entry points across T1 Foundational, T2 Intermediate, T3 Advanced, and T4 Expert.
- **Visualizers:** 20 React visualizers in `src/components/visualizers`.
- **Practice labs:** 27 registered labs in `src/lib/lab-registry.ts`.
- **Flashcards:** 56 JSON flashcard decks under `content/flashcards/`.
- **Interview banks:** 6 JSON banks under `content/interview-questions/`.
- **Quality gates:** Vitest (107 files, 720 tests), Playwright regression gates, strict lab audits.

## Validation Baseline

Run this sweep before a release or after any future curriculum/lab/navigation change:

```bash
npm run generate:curriculum
npm run type-check
npm test
npm run build
npx playwright test tests/e2e/regression-gates.spec.ts --reporter=line
npx playwright test tests/e2e/learner-flow.spec.ts --reporter=line
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
