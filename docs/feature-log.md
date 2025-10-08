# Feature Log

This log tracks shipped work so the team has a single reference outside the day-to-day tracker.

## Curriculum & Visual Experiences
- **L4 – Verification stack visualization refresher**: Upgraded interactive diagram plus quick-link sync; E2E coverage kept green.
- **NF-5 – Real curriculum anchors**: Rewired temporary diagram links to final lesson slugs.
- **VIS-1 – Contextual charts**: Replaced generic bar charts with SVG/D3 glyphs tailored to each lesson.

## Platform Performance
- **P1 – Lazy-load heavy components**: Deferred the EngagementEngine chart with `next/dynamic` to trim the dashboard shell.
- **P2 – Bundle guard**: Captured baseline bundle stats (`docs/bundle-baseline.json`) and added the `bundle:check` gate.
- **P3 – D3 standardisation**: Removed the last Recharts dependency in favour of D3-powered SVGs.
- **P4 – Image optimisation**: Migrated hero/dashboard/curriculum imagery to `next/image`.
- **P5 – Font loading**: Centralised `next/font` usage for Cal Sans, Inter, and JetBrains Mono with sensible fallbacks.

## Developer Experience & Stability
- **M1-1 – Type-check in builds**: Restored `tsc --noEmit` to the build pipeline.
- **M1-2 – ESLint in builds**: Reintroduced lint failure gating during `next build`.
- **D1 – InteractiveCode SSR guard**: Prevented `window` access during prerender for curriculum routes.
- **D3 – Developer onboarding**: Refresh of `.env.example`, Playwright notes, and postinstall steps.
- **DX-2 – Prisma client consolidation**: Ensured server actions reuse Prisma clients safely.

## Testing & Quality Gates
- **M1 – Resilient Playwright selectors**: Adopted accessible roles/test IDs across suites.
- **M2 – Pre-commit enforcement**: Added Husky + lint-staged to block dirty commits.
- **M3 – Vitest exemplars**: Seeded utility and component tests as references.
- **M4 – Architecture ADRs**: Documented routing, state, and asset strategy (ADR 0001–0003).
- **QA-4 – Test freshness**: Added bundle guard tests and refreshed selectors for accessibility updates.
- **QA-5 – Time mocking**: Introduced `tests/setup/time-travel.ts` for deterministic scheduling specs.
- **OPS-1 – Playwright automation**: Standardised local runs on port `3100` with the account UI flag.
- **OPS-2 – Playwright reporting**: Archived the latest HTML report at `test-results/playwright-10_8/`.
- **OPS-3 – Core checks loop**: Revalidated `npm run lint`, `npm run test`, and `npm run build` as the default loop.

## Product Surface Enhancements
- **PROD-1 – Placement quiz**: Ten-question assessment with weighted scoring, tier recommendations, analytics, and resource follow-ups.
- **PROD-2 – Notification feed**: Engagement-derived notifications wired into navbar and `/notifications`, plus Vitest coverage.
- **PROD-3 – Account settings**: Persisted theme, telemetry, and notification preferences through `/api/preferences`, `/settings`, and the notification UI.

_Last updated: 2025-10-10_
