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
| L4 | completed | Curriculum UX | Restore a performant verification stack visualization or keep refining the quick-link fallback. | Lightweight interactive diagram shipped alongside upgraded placeholders and passing E2E coverage; curriculum quick links stay in sync with the visualization. |
| NF-5 | todo | Curriculum UX | Replace temporary diagram link targets with real curriculum anchors. | Run after L4 so nodes resolve to finalized slugs. |
| M1-1 | completed | Build Quality | Re-enable TypeScript error checking during builds. | `npm run build` now gates on `tsc --noEmit` before `next build`, re-enabling the TypeScript fail-fast guard in CI. |
| M1-2 | todo | Build Quality | Re-enable ESLint error checking during builds. | Remove `ignoreDuringBuilds`, clean lint errors once M1-1 succeeds. |
| P1 | completed | Performance | Finish lazy-loading remaining heavy components. | EngagementEngine now defers its Recharts activity graph via `next/dynamic`, keeping the dashboard shell lightweight until the chart loads. |
| P2 | completed | Performance | Capture bundle stats post-D3 modularization. | Added JSON bundle analysis via `ANALYZE=true` builds, captured a baseline in `docs/bundle-baseline.json`, and wired a `bundle:check` script plus tests to enforce budgets. |
| P3 | todo | Performance | Standardize on a single charting library (prefer D3). | Re-implement Recharts surfaces or retire them. |
| P4 | todo | Performance | Implement image optimization using `next/image`. | Audit `<img>` usage and prioritize LCP assets. |
| P5 | todo | Performance | Optimize font loading with `next/font`. | Ensure `font-display: swap` and preload critical fonts. |
| D1 | todo | Platform Stability | Guard `InteractiveCode` so SSR never touches `window`. | Confirm curriculum slugs render without 500s in `next build`. |
| D3 | todo | DX | Automate local setup and document Playwright/browser prerequisites. | Add `.env.example`, README getting started, and `postinstall` hook for `npx playwright install`. |
| M1 | completed | Testing | Refactor remaining Playwright specs to use unique, stable locators. | Updated navigation, labs, and interactive demo specs to rely on accessible roles/test ids with matching aria hooks in the UI. |
| M2 | todo | Testing | Enforce code quality via Husky + lint-staged pre-commit hooks. | Depends on M1-1 and M1-2. |
| M3 | todo | Testing | Add exemplar unit/integration tests and document strategy. | Seed Vitest coverage for utilities and UI components. |
| M4 | todo | Documentation | Write ADRs for routing, state management, and asset strategy. | Keep decisions lightweight but searchable. |
| QA-4 | completed | Testing | Add or update unit, integration, and E2E tests alongside new features or feedback fixes. | Added a Vitest suite for the bundle guard CLI and refreshed E2E selectors to align with the new accessibility hooks. |
| QA-5 | ready-for-review | Testing | Extract shared time mocking helpers for deterministic scheduling tests. | Added `tests/setup/time-travel.ts` with `withFrozenTime`; SRS actions spec now uses the shared helper. |
| DX-2 | todo | DX | Consolidate Prisma client management for server actions. | Avoid per-action instantiation uncovered while expanding SRS coverage. |
| PROD-1 | todo | Product | Expand placement quiz into an interactive assessment with scoring/analytics. | Next evolution of `/quiz/placement`. |
| PROD-2 | todo | Product | Power notifications with real activity events and user preferences. | Replace placeholders with real data. |
| PROD-3 | todo | Product | Replace settings stub with persisted profile/theme/communication preferences. | Integrate with existing auth/session flows. |
| OPS-1 | blocked | Tooling | Install Playwright system deps and rerun focused + full e2e suites. | Playwright browsers install automatically, but `npm run test:e2e` still fails in this container because required system libraries are missing (`npx playwright install-deps` hits proxy/apt restrictions). |
| OPS-2 | todo | QA | Capture a new Playwright report once suites pass. | Share report and update Milestone 4 status. |
| OPS-3 | todo | QA | Run `npm run lint && npm run test && npm run build` after major changes. | Keeps health checks green between sessions. |

## Recently Completed
- [2025-10-10] Replaced homepage community stats with curriculum-focused hero content (tracked in git history).
- [2025-10-10] Added curriculum recommendation engine driven by last-visited metadata.

Update this section as additional work ships.
