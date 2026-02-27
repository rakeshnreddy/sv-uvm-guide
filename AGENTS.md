# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Next.js routes (`app/`), shared UI (`components/`), hooks, and shared types.
- `content/` + `labs/`: Curriculum MDX, quizzes, and lab material; keep module folders consistent.
- `prisma/`: Schema, migrations, seeds—note rollout steps with each migration.
- `scripts/`: Generators, audits, and automation (curriculum builder, bundle guard).
- `public/visuals/`, `public/diagrams/`: Canonical assets aligned with design tokens.
- `docs/`: Product context (`PROJECT_GUIDE.md`), PR checklist, migration tracker—update `docs/topic-template-migration.md` after template work.
- `tests/` with artifacts in `test-results/`.

## Build, Test & Development Commands
`npm run dev` regenerates Prisma and starts Next.js. `npm run build` type-checks then emits `.next/`; `npm start` serves it. `npm run lint` uses the Next ESLint config (restore the CI gate in task `M1-2`). `npm test` runs Vitest; `npm run test:e2e` drives Playwright suites in `tests/e2e/` (blocked by missing deps `OPS-1`). `npm run bundle:check` enforces budgets after `ANALYZE=true npm run build`. `npm run generate:curriculum` refreshes derived content.

## Coding Style & Naming Conventions
Favor modern TypeScript, React Server Components when useful, and Tailwind utilities. Stick to 2-space indentation. Components use `PascalCase.tsx`, hooks `useName.ts`, curriculum `kebab-case.mdx`. Share types from `src/types/`, avoid `any`, and follow the Quick Take → References flow in `PROJECT_GUIDE.md`.

## Testing Guidelines & QA Agent Integration
Vitest specs live in `tests/` and feature-aligned `__tests__/`; snapshots stay in `tests/__snapshots__/`. Core Playwright suites (`curriculum-links`, `curriculum-nav`, `curriculum-diagram`, `uvm-architecture-visual`) share helpers in `tests/fixtures/`. 
**QA Agent Integration:** A parallel QA agent is actively reviewing this repository to ensure quality is maintained and to write comprehensive automated tests for all new features (React interactives, labs, etc.). All executing agents *must* write clean, modular, and easily testable code to support the QA agent. Store Playwright, bundle, and audit outputs in `test-results/`; run `npm run audit:uvm-factory` after UVM changes.

## Task Tracking & Session Handoffs
`TASKS.md` is the high-level backlog. For curriculum work, a more detailed workflow is defined below.

## Curriculum Modernization Workflow

The modernization of the curriculum is strictly managed through a unified process to prevent state fragmentation across multi-agent sessions:

1.  **`TASKS.md`**: This file is the **Single Source of Truth** for the entire modernization backlog. It contains the priority table and the exact instructional prompt to resume work.
2.  **Supporting Documents**: `comprehensive_lrm_audit_report.md` and `curriculum_modernization_tasks.md` contain historical context, detailed analysis, and granular acceptance criteria. Agents should read these for deep context, but must *never* rely on them for active task status.

**Workflow:**
1.  Read `TASKS.md` to identify the first task with the status `todo`.
2.  Optionally consult the supporting documents for additional architectural context on the specific task.
3.  Execute the instructions (creating MDX lessons, React interactives, labs).
4.  Run validation tests (`npx tsx scripts/generate-curriculum-data.ts` and `npx vitest --run`).
5.  Update the status to `complete` **only in `TASKS.md`**.
6.  Yield using the `Agent Handoff Protocol` documented at the bottom of `TASKS.md`.

## Commit & Pull Request Workflow
Keep commits focused and imperative, referencing relevant task IDs. PRs should summarize learner impact, link `TASKS.md`, and list executed checks (`npm run lint`, `npm run type-check`, `npm run test`, targeted Playwright runs). Follow `.github/PULL_REQUEST_TEMPLATE.md` and `docs/pr-checklist.md`: update trackers, attach UI evidence, refresh `docs/topic-template-migration.md`, confirm automation status.

## Configuration & Security Notes
Secrets remain in `.env.local`. Export `PLAYWRIGHT_SKIP_INSTALL_DEPS=true` when system packages manage browsers; otherwise run `npx playwright install-deps && npx playwright install` to resolve `OPS-1`. `@next/bundle-analyzer` is optional—the build disables it gracefully if missing but reinstall it before running `ANALYZE=true` pipelines.
