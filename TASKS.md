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
| M1-1 | todo | Build Quality | Re-enable TypeScript error checking during builds. | Remove `ignoreBuildErrors`, fix outstanding TS errors, confirm `next build` fails on type issues. |
| M1-2 | todo | Build Quality | Re-enable ESLint error checking during builds. | Remove `ignoreDuringBuilds`, clean lint errors once M1-1 succeeds. |
| P1 | in-progress | Performance | Finish lazy-loading remaining heavy components. | EngagementEngine and other experimental surfaces still import chart libs eagerly. |
| P2 | in-progress | Performance | Capture bundle stats post-D3 modularization. | Record baseline bundle metrics and guard with automated check. |
| P3 | todo | Performance | Standardize on a single charting library (prefer D3). | Re-implement Recharts surfaces or retire them. |
| P4 | todo | Performance | Implement image optimization using `next/image`. | Audit `<img>` usage and prioritize LCP assets. |
| P5 | todo | Performance | Optimize font loading with `next/font`. | Ensure `font-display: swap` and preload critical fonts. |
| D1 | todo | Platform Stability | Guard `InteractiveCode` so SSR never touches `window`. | Confirm curriculum slugs render without 500s in `next build`. |
| D3 | todo | DX | Automate local setup and document Playwright/browser prerequisites. | Add `.env.example`, README getting started, and `postinstall` hook for `npx playwright install`. |
| M1 | in-progress | Testing | Refactor remaining Playwright specs to use unique, stable locators. | Navigation/search flows still fail strict-mode checks. |
| M2 | todo | Testing | Enforce code quality via Husky + lint-staged pre-commit hooks. | Depends on M1-1 and M1-2. |
| M3 | todo | Testing | Add exemplar unit/integration tests and document strategy. | Seed Vitest coverage for utilities and UI components. |
| M4 | todo | Documentation | Write ADRs for routing, state management, and asset strategy. | Keep decisions lightweight but searchable. |
| QA-4 | todo | Testing | Add or update unit, integration, and E2E tests alongside new features or feedback fixes. | Treat automated coverage as part of each change; expand suites where gaps exist. |
| PROD-1 | todo | Product | Expand placement quiz into an interactive assessment with scoring/analytics. | Next evolution of `/quiz/placement`. |
| PROD-2 | todo | Product | Power notifications with real activity events and user preferences. | Replace placeholders with real data. |
| PROD-3 | todo | Product | Replace settings stub with persisted profile/theme/communication preferences. | Integrate with existing auth/session flows. |
| OPS-1 | todo | Tooling | Install Playwright system deps and rerun focused + full e2e suites. | Required to unblock M1; run `npx playwright install` locally/CI. |
| OPS-2 | todo | QA | Capture a new Playwright report once suites pass. | Share report and update Milestone 4 status. |
| OPS-3 | todo | QA | Run `npm run lint && npm run test && npm run build` after major changes. | Keeps health checks green between sessions. |

## Recently Completed
- [2025-10-10] Replaced homepage community stats with curriculum-focused hero content (tracked in git history).
- [2025-10-10] Added curriculum recommendation engine driven by last-visited metadata.

Update this section as additional work ships.
