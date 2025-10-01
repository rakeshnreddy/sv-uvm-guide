# Automated Testing Strategy

This session focused on filling gaps for recent curriculum and dashboard features so that regressions are caught before they hit production.

## Coverage Targets
- **Curriculum quick links:** `InteractiveUvmArchitectureDiagram` now has a Rendering test that walks the quick summary controls and verifies that the detail panel and CTA track the active node. This ensures the curriculum anchors stay synchronized with the verification stack map.
- **Learner progress tracking:** The `useCurriculumProgress` hook is covered with unit tests that assert localStorage hydration, completion tracking, and visit logging. Fixtures keep the module structure deterministic while exercising the production persistence logic.
- **Dashboard shell:** A Vitest integration spec renders `DashboardPageClient` with a mocked curriculum status feed and checks the derived coverage counts, backlog messaging, and module progress list.

## Patterns & Tooling
- All specs live in `tests/` alongside existing suites and reuse Testing Library helpers (`render`, `renderHook`, `within`).
- `next/link` and `next/image` are mocked per-suite to keep component markup shallow and deterministic.
- Progress hook tests mock `@/lib/curriculum-data` fixtures so calculations can be asserted without loading the entire generated dataset.

## Expansion Plan
1. **Curriculum experience:** Extend quick-link coverage to the curriculum landing page (`src/app/curriculum/page.tsx`) once filtering logic stabilizes.
2. **Progress analytics:** Add integration tests for recommendation surfaces that consume `useCurriculumProgress`, especially the tier unlock states when gating rules ship.
3. **Dashboard telemetry:** When real activity data flows through `buildCurriculumStatus`, promote the mock to a shared factory and add Playwright smoke tests that click through `/dashboard/coverage`.

Keep these suites in the pre-commit loop (`npm run lint`, `npm run test`, `CI=1 ANALYZE=true npm run build`) and capture Playwright output when the system dependencies (`OPS-1`) land.
