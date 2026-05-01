# TASKS.md — Active Backlog and Site State

Last Updated: 2026-05-01
Purpose: single source of truth for active pending work. Completed historical task details were intentionally removed from this tracker so future coding sessions can start from the current state without scanning obsolete backlog.

---

## Active Pending Tasks

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| — | — | — | — | No open tasks | Add a new row here when a new workstream is approved |

## Current Site State

- **Curriculum:** 69 MDX module entry points across T1 Foundational, T2 Intermediate, T3 Advanced, and T4 Expert.
- **Major topic coverage:** SystemVerilog language fundamentals, simulation scheduling, assertions/SVA, functional coverage, UVM components/factory/phasing/TLM/sequences/RAL, scoreboards, VIP construction, multi-agent environments, AHB, AXI, AMBA bridge/coherency topics, PSS, pyUVM, AI-assisted verification, RISC-V verification, emulation, power-aware verification, formal integration, performance, debug, and SoC-level strategy.
- **Visualizers:** 20 React visualizers in `src/components/visualizers`, including SV scheduler, UVM phase/TLM/factory/sequence tools, coverage/RAL/PSS views, and AMBA/AHB/AXI bridge and deadlock visualizers.
- **Practice labs:** 27 registered labs in `src/lib/lab-registry.ts`; canonical lab assets live under `content/curriculum/labs/`.
- **Flashcards:** 56 JSON flashcard decks under `content/flashcards/`.
- **Interview banks:** 6 JSON banks under `content/interview-questions/`: AMBA, Debug, SoC/System Design, SVA/Formal, SystemVerilog, and UVM.
- **Quality gates:** Vitest component/library tests, curriculum/source metadata audits, strict lab registry audits, and Playwright regression gates for navigation, breadcrumbs, flashcards, quizzes, lab links, and learner-flow paths.

## Recently Closed In This Cleanup

- `LAB-1-T3-SCOREBOARD`: already complete through the canonical `scoreboard-reference-model` lab and linked from `A-UVM-6`.
- `LAB-2-T4-PSS`: completed through the canonical `pss-portable-intent` lab, now registered, linked from `E-PSS-1`, and backed by starter PSS plus generated UVM/C target examples.
- Tracker cleanup: old completed task details removed from `TASKS.md`; current site state captured above.
- `LAB-PLATFORM-1-ASSET-VIEWER`: practice lab pages now load canonical lab assets, expose multi-file file browsing, support starter/solution/reference roles, and use language-aware Monaco modes for SV, PSS, C, Markdown, and JSON.
- `QA-STRICT-LABS-1`: strict lab audit passes through the new `npm run test:labs:strict` script.
- `WARN-1-REACT-HOOK-DEPS`: fixed the production-build hook dependency warnings in `BridgeTranslationExplorer` and `CoverageCrossExplorerVisualizer`.
- `E2E-LEARNER-FLOW-1`: added Playwright coverage for curriculum -> lab -> module return -> flashcards -> quiz -> next module.
- `AUDIT-1-FRESH-CONTENT-PASS`: added `docs/planning/post-completion-audit-2026-05-01.md`; no new blocking implementation findings were opened.

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

When adding new work, add one row to **Active Pending Tasks** and include only tasks that still need execution.

| Order | ID | Priority | Status | Description | Next Action |
|---:|---|---|---|---|---|
| 1 | EXAMPLE-TASK-ID | P1 | todo | Short learner or platform outcome | First concrete implementation step |

Use statuses: `todo`, `in_progress`, `blocked`, `complete`. Remove or summarize completed rows after they land and are reflected in the site state or session handoff.

## Agent Handoff Protocol

1. Read `TASKS.md` and `SESSION_HANDOFF.txt` before editing.
2. Execute the first `todo` row in **Active Pending Tasks** unless the user redirects.
3. Update the row to `in_progress` before substantial edits.
4. Validate with the smallest relevant checks first, then the broader validation baseline when the change touches curriculum generation, navigation, or shared app behavior.
5. Update `SESSION_HANDOFF.txt` with changed files, validation results, residual risks, and any new pending task.
6. Mark a task `complete` only after acceptance criteria pass or any limitation is explicitly documented.
