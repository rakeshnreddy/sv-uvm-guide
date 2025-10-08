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

## Testing Guidelines
Vitest specs live in `tests/` and feature-aligned `__tests__/`; snapshots stay in `tests/__snapshots__/`. Core Playwright suites (`curriculum-links`, `curriculum-nav`, `curriculum-diagram`, `uvm-architecture-visual`) share helpers in `tests/fixtures/`. Until `npx playwright install-deps` succeeds (`OPS-1`), document e2e failures and rerun when libraries install. Store Playwright, bundle, and audit outputs in `test-results/`; run `npm run audit:uvm-factory` after UVM changes.

## Task Tracking & Session Handoffs
`TASKS.md` is the high-level backlog. For curriculum work, a more detailed workflow is defined below.

## Curriculum Modernization Workflow

The modernization of the curriculum is managed through two key files:
1.  **`TASKS.md`**: This file contains a high-level table of all refactoring and modernization tasks. Use it to get a strategic overview of the project and see the status of major work items.
2.  **`curriculum_modernization_tasks.md`**: This file contains detailed, self-contained prompts for each task listed in `TASKS.md`. Each prompt is designed to be given directly to a coding agent.

**Workflow:**
1.  Consult `TASKS.md` to identify a task with the status `todo`.
2.  Locate the corresponding detailed prompt in `curriculum_modernization_tasks.md`.
3.  Provide the entire text of that prompt to the coding agent.
4.  The agent will follow the instructions within the prompt, which include creating or modifying lessons, adding labs, creating visuals, and running all required tests.
5.  Upon completion, the agent is instructed to update the status in both `curriculum_modernization_tasks.md` and `TASKS.md`.

## Commit & Pull Request Workflow
Keep commits focused and imperative, referencing relevant task IDs. PRs should summarize learner impact, link `TASKS.md`, and list executed checks (`npm run lint`, `npm run type-check`, `npm run test`, targeted Playwright runs). Follow `.github/PULL_REQUEST_TEMPLATE.md` and `docs/pr-checklist.md`: update trackers, attach UI evidence, refresh `docs/topic-template-migration.md`, confirm automation status.

## Configuration & Security Notes
Secrets remain in `.env.local`. Export `PLAYWRIGHT_SKIP_INSTALL_DEPS=true` when system packages manage browsers; otherwise run `npx playwright install-deps && npx playwright install` to resolve `OPS-1`. `@next/bundle-analyzer` is optional—the build disables it gracefully if missing but reinstall it before running `ANALYZE=true` pipelines.
