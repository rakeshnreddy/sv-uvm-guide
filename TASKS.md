# Next Action Tracker

This file consolidates open implementation and feedback items so the team has a single queue to reference between sessions. Update the status column as items progress and prune tasks once they are delivered.

## Status Legend
- `todo`: Not started.
- `in-progress`: Work underway or partially delivered.
- `blocked`: Waiting on another task or external dependency.
- `ready-for-review`: Awaiting verification/approval.

## Active Tasks
| ID | Status | Area | Summary | Notes |
|----|--------|------|---------|-------|
| L4 | 🟢 completed | Curriculum UX | Restore a performant verification stack visualization or keep refining the quick-link fallback. | Lightweight interactive diagram shipped alongside upgraded placeholders and passing E2E coverage; curriculum quick links stay in sync with the visualization. |
| NF-5 | 🟢 completed | Curriculum UX | Replace temporary diagram link targets with real curriculum anchors. | Run after L4 so nodes resolve to finalized slugs. |
| VIS-1 | 🟢 completed | Curriculum UX | Replace generic curriculum bar charts with context-appropriate visuals. | Data type comparison now uses card-style SVG glyphs that teach state space, driver resolution, and usage context; responsive + dark-mode coverage verified. |
| M1-1 | 🟢 completed | Build Quality | Re-enable TypeScript error checking during builds. | `npm run build` now gates on `tsc --noEmit` before `next build`, re-enabling the TypeScript fail-fast guard in CI. |
| M1-2 | 🟢 completed | Build Quality | Re-enable ESLint error checking during builds. | ESLint now runs (and fails) during `next build`; repo is lint-clean. |
| P1 | 🟢 completed | Performance | Finish lazy-loading remaining heavy components. | EngagementEngine now defers its Recharts activity graph via `next/dynamic`, keeping the dashboard shell lightweight until the chart loads. |
| P2 | 🟢 completed | Performance | Capture bundle stats post-D3 modularization. | Added JSON bundle analysis via `ANALYZE=true` builds, captured a baseline in `docs/bundle-baseline.json`, and wired a `bundle:check` script plus tests to enforce budgets. |
| P3 | 🟢 completed | Performance | Standardize on a single charting library (prefer D3). | Replaced remaining Recharts visualizations with D3-powered SVG charts and removed the dependency. |
| P4 | 🟢 completed | Performance | Implement image optimization using `next/image`. | Migrated hero, dashboard, and curriculum blueprints to `next/image`, tuned responsive sizing, and stabilized review assistant tests to keep CI green. |
| P5 | 🟢 completed | Performance | Optimize font loading with `next/font`. | Implemented centralized `next/font` loaders for Cal Sans, Inter, and JetBrains Mono with swap behavior plus Tailwind fallbacks. |
| D1 | 🟢 completed | Platform Stability | Guard `InteractiveCode` so SSR never touches `window`. | Confirm curriculum slugs render without 500s in `next build`. |
| D3 | 🟢 completed | DX | Automate local setup and document Playwright/browser prerequisites. | `.env.example`, refreshed onboarding docs, and postinstall Playwright install script now capture browser + troubleshooting guidance. |
| M1 | 🟢 completed | Testing | Refactor remaining Playwright specs to use unique, stable locators. | Updated navigation, labs, and interactive demo specs to rely on accessible roles/test ids with matching aria hooks in the UI. |
| M2 | 🟢 completed | Testing | Enforce code quality via Husky + lint-staged pre-commit hooks. | Husky pre-commit runs lint-staged (Next lint + Vitest related); run `npm install` to pick up the new dev dependencies. |
| M3 | 🟢 completed | Testing | Add exemplar unit/integration tests and document strategy. | Seed Vitest coverage for utilities and UI components. |
| M4 | 🟢 completed | Documentation | Write ADRs for routing, state management, and asset strategy. | Added docs/adr/0001-0003 outlining routing, state, and asset strategy decisions. |
| QA-4 | 🟢 completed | Testing | Add or update unit, integration, and E2E tests alongside new features or feedback fixes. | Added a Vitest suite for the bundle guard CLI and refreshed E2E selectors to align with the new accessibility hooks. |
| QA-5 | 🟢 completed | Testing | Extract shared time mocking helpers for deterministic scheduling tests. | Added `tests/setup/time-travel.ts` with `withFrozenTime`; SRS actions spec now uses the shared helper. |
| DX-2 | 🟢 completed | DX | Consolidate Prisma client management for server actions. | Avoid per-action instantiation uncovered while expanding SRS coverage. |
| PROD-1 | 🟢 completed | Product | Expand placement quiz into an interactive assessment with scoring/analytics. | `/quiz/placement` now delivers a 10-question assessment with weighted scoring, tier recommendations, category breakdowns, and follow-up resource links. |
| PROD-2 | ⚪ todo | Product | Power notifications with real activity events and user preferences. | Replace placeholders with real data. |
| PROD-3 | ⚪ todo | Product | Replace settings stub with persisted profile/theme/communication preferences. | Integrate with existing auth/session flows. |
| OPS-1 | 🔴 blocked | Tooling | Install Playwright system deps and rerun focused + full e2e suites. | Playwright browsers install automatically, but `npm run test:e2e` still fails in this container because required system libraries are missing (`npx playwright install-deps` hits proxy/apt restrictions). |
| OPS-2 | ⚪ todo | QA | Capture a new Playwright report once suites pass. | Share report and update Milestone 4 status. |
| OPS-3 | 🟢 completed | QA | Run `npm run lint && npm run test && npm run build` after major changes. | Latest session verified all three checks (`npm run lint`, `npm test`, `CI=1 npm run build`) without issues. |

## Recently Completed
- [2025-10-10] Replaced homepage community stats with curriculum-focused hero content (tracked in git history).
- [2025-10-10] Added curriculum recommendation engine driven by last-visited metadata.

Update this section as additional work ships.
