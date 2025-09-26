# Actionable Task Plan

*This document is being generated based on a comprehensive codebase audit. Tasks are grouped by milestone and prioritized.*

## Now

### Milestone 1: Learning-First & Scaffolding

#### [L1] Build docs/Learning-First-Audit.md
**Why:** To create a definitive guide for which content is essential to the learning mission and which can be de-scoped, flagged, or removed.
**Scope:** `docs/Learning-First-Audit.md`, all routes in `src/app`.
**Steps:**
1. Audit every route identified in the `Page & Route Inventory`.
2. For each route, define its learning outcome, identify must-have content, and mark non-essential UI elements.
3. Populate the table in `docs/Learning-First-Audit.md` with these findings.
**Acceptance Criteria:**
- The `Learning-First-Audit.md` file is complete and provides a clear recommendation for every route.
**Est. Impact:** Foundational for all other learning-first cleanup tasks.
**Effort:** M
**Dependencies:** None

#### [L2] Introduce tools/featureFlags.ts
**Why:** To provide a centralized, code-based mechanism for enabling or disabling features, allowing for safe removal of mock UI without deleting the underlying code immediately.
**Scope:** `src/tools/featureFlags.ts`
**Steps:**
1. Create the `src/tools/featureFlags.ts` file.
2. Define flags for `community`, `tracking`, `personalization`, `fakeComments`, and `accountUI`, all defaulted to `false`.
3. Export a helper function `isFeatureEnabled` to easily check flag status.
**Acceptance Criteria:**
- The `featureFlags.ts` file exists and contains the required flags.
- The `isFeatureEnabled` function is available for use throughout the application.
**Est. Impact:** Enables safe de-scoping and progressive feature rollouts.
**Effort:** S
**Dependencies:** None

#### [L3] Gate Mock UI & Associated Heavy Components
**Why:** Several heavy components are used exclusively on mock pages (Dashboard, Community, etc.) that provide no current learning value. Gating them is a quick way to improve performance and simplify the codebase.
**Scope:** `src/app/dashboard`, `src/app/community`, `src/app/history`, `src/components/assessment`, `src/components/gamification`, etc.
**Steps:**
1. Use the `isFeatureEnabled` function from `[L2]`.
2. Identify all pages and components related to the mock features (see `Learning-First-Audit.md`).
3. On each page (e.g., `src/app/dashboard/page.tsx`), wrap the main component return in a check for the appropriate feature flag. If disabled, return a simple placeholder or a `notFound()` call.
4. This will ensure that components used only by these pages (e.g., `ProgressAnalytics`, `HistoryTimelineChart`) are not included in any primary learning path bundle.
**Acceptance Criteria:**
- The mock feature pages are no longer accessible when their feature flags are off.
- Bundle analysis confirms that components like `ProgressAnalytics`, `SkillMatrixVisualizer`, `HistoryTimelineChart`, and `EngagementEngine` are not included in the main production bundles.
**Est. Impact:** High. Reduces bundle size and removes distracting, non-functional UI.
**Effort:** M
**Dependencies:** [L2]

#### [M1-1] Enable TypeScript Error Checking in Build
**Why:** The project currently ignores TypeScript errors during the build (`typescript: { ignoreBuildErrors: true }`), which defeats the purpose of using TypeScript and hides potentially critical bugs.
**Scope:** `next.config.mjs`
**Steps:**
1. Open `next.config.mjs`.
2. Remove the line `typescript: { ignoreBuildErrors: true },`.
3. Run `npm run type-check` to see the full list of existing TypeScript errors.
4. Run `npm run build` and observe the build failing with TypeScript errors.
5. Address all existing TypeScript errors until `npm run build` completes successfully. This may require significant refactoring and type correction across the codebase.
**Acceptance Criteria:**
- The `typescript: { ignoreBuildErrors: true }` block is removed from `next.config.mjs`.
- `npm run build` fails if there are any TypeScript errors.
- `npm run build` completes successfully after all initial errors are fixed.
**Est. Impact:** Critical improvement to code quality and stability.
**Effort:** M (Could be L to XL depending on the number of existing errors)
**Dependencies:** None

#### [M1-2] Enable ESLint Error Checking in Build
**Why:** The project currently ignores ESLint errors during the build (`eslint: { ignoreDuringBuilds: true }`), allowing inconsistent code styles and potential issues to go unchecked.
**Scope:** `next.config.mjs`
**Steps:**
1. Open `next.config.mjs`.
2. Remove the line `eslint: { ignoreDuringBuilds: true },`.
3. Run `npm run lint` to see the full list of existing linting errors.
4. Run `npm run build` and observe the build failing if lint errors exist.
5. Address all existing ESLint errors until `npm run build` completes successfully.
**Acceptance Criteria:**
- The `eslint: { ignoreDuringBuilds: true }` block is removed from `next.config.mjs`.
- `npm run build` fails if there are any ESLint errors.
- `npm run build` completes successfully after all initial errors are fixed.
**Est. Impact:** Significant improvement to code consistency and quality.
**Effort:** M
**Dependencies:** [M1-1] (It's best to fix TS errors first)

### Milestone 2: Performance & Weight Reduction

#### [P1] Lazy-Load Heavy Components
**Why:** Several components import heavy libraries (`@monaco-editor/react`, `d3`, `recharts`), causing large initial bundle sizes. Lazy-loading them defers the JS download and execution until they are needed.
**Scope:** All pages and components that use heavy visualization, diagram, and editor components.
**Steps:**
1. Identify all components that directly import `@monaco-editor/react`, `d3`, or `recharts`.
2. In the parent component, change the static import to a dynamic one using `next/dynamic` with `{ ssr: false }`.
**Acceptance Criteria:**
- Bundle analysis shows that Monaco, D3, and Recharts are moved from the main bundle to separate, dynamically-loaded chunks.
**Est. Impact:** High. Significant reduction in initial JS load.
**Effort:** L
**Dependencies:** None

#### [P2] Refactor D3 Imports for Tree-Shaking
**Why:** The current `import * as d3 from 'd3'` pattern bundles the entire D3 library. Importing only the necessary modules will dramatically reduce the size of the D3-related code.
**Scope:** All files that use `d3`.
**Steps:**
1. Replace the monolithic import with modular imports from their respective packages (e.g., `import { select } from 'd3-selection'`).
**Acceptance Criteria:**
- No file in the codebase contains the `import * as d3 from 'd3'` statement.
- Bundle analysis shows a significant reduction in the size of chunks containing D3 code.
**Est. Impact:** High. Can reduce the D3 bundle footprint by over 80%.
**Effort:** M
**Dependencies:** None

#### [P3] Standardize on a Single Charting Library
**Why:** The project uses both `d3` and `recharts`, which is redundant. Standardizing on one will simplify the codebase and reduce bundle size.
**Scope:** All chart components.
**Steps:**
1. **Decision:** Standardize on `d3` due to its flexibility for complex, custom diagrams.
2. Re-implement the charts currently using `recharts` with `d3`.
3. Remove `recharts` from `package.json`.
**Acceptance Criteria:**
- `recharts` is removed from the project.
- All charts are functional.
**Est. Impact:** Medium. Reduces bundle size and simplifies dependencies.
**Effort:** M
**Dependencies:** [P2]

#### [P4] Implement Image Optimization
**Why:** Large, unoptimized images are a major cause of slow page loads.
**Scope:** All components and pages that display images.
**Steps:**
1. Replace all `<img>` tags with the Next.js `<Image>` component.
2. Ensure `priority` prop is used on LCP images.
**Acceptance Criteria:**
- No `<img>` tags are used for content images.
- Lighthouse scores for image optimization are high.
**Est. Impact:** High. Improves LCP and reduces network weight.
**Effort:** M
**Dependencies:** None

#### [P5] Optimize Font Loading
**Why:** Web fonts can block rendering and contribute to layout shift.
**Scope:** `src/app/layout.tsx`
**Steps:**
1. Ensure font loading is done correctly using `next/font` to preload and self-host.
2. Ensure `font-display: swap` is being used.
**Acceptance Criteria:**
- Fonts are preloaded and self-hosted via `next/font`.
- Font-related CLS is minimized.
**Est. Impact:** Medium. Improves CLS and TBT.
**Effort:** S
**Dependencies:** None

### Milestone 3: Local Dev & Navigation

#### [D1] Fix SSR `window is not defined` Error
**Why:** A `ReferenceError: window is not defined` in `InteractiveCode.tsx` breaks server-side rendering for all curriculum pages, causing 500 errors and making local development impossible.
**Scope:** `src/components/ui/InteractiveCode.tsx` and related curriculum pages.
**Steps:**
1. Analyze how `InteractiveCode.tsx` is loaded. Even with `next/dynamic`, some code might be executing on the server.
2. Ensure any code that accesses the `window` object is inside a `useEffect` hook or is otherwise guarded to run only on the client.
3. Confirm that curriculum pages (e.g., `/curriculum/T1_Foundational/F2_SystemVerilog_Basics/index`) load correctly in the dev environment without 500 errors.
**Acceptance Criteria:**
- The `ReferenceError: window is not defined` is eliminated.
- E2E tests for curriculum pages pass without 500 errors.
**Est. Impact:** Critical. Unblocks all curriculum-related development and fixes major production bugs.
**Effort:** M
**Dependencies:** None

#### [D2] Fix MDX Content Parsing Error
**Why:** A syntax error in an MDX file is causing a build failure on at least one curriculum page.
**Scope:** The MDX file identified in the E2E test logs (related to `soc_virtual_seq`).
**Steps:**
1. Locate the MDX file containing the code snippet: `` `uvm_object_utils(soc_virtual_seq) ``.
2. Correct the syntax error (likely an unescaped backtick or incorrect formatting).
3. Re-run the E2E tests to confirm the page now builds and renders correctly.
**Acceptance Criteria:**
- The MDX parsing error is resolved.
- The corresponding E2E test passes.
**Est. Impact:** Critical. Fixes a production bug on a curriculum page.
**Effort:** S
**Dependencies:** None

#### [D3] Document and Automate Local Development Setup
**Why:** To ensure any developer can get the project running reliably, the setup process must be documented and automated where possible.
**Scope:** `README.md`, `.env.example`, `package.json`
**Steps:**
1. Create a `.env.example` file.
2. Add a "Getting Started" section to `README.md` with clear setup steps.
3. **Crucially, add `npx playwright install` to the `postinstall` script in `package.json`** to automate the download of E2E test browser binaries.
**Acceptance Criteria:**
- A new developer can clone the repo, run `npm install`, and then `npm run test:e2e` successfully.
**Est. Impact:** High. Dramatically improves developer onboarding and testing reliability.
**Effort:** S
**Dependencies:** None

## Next

### Milestone 4: Maintainability

#### [M1] Refactor E2E Tests to Use Unique Locators
**Why:** The E2E tests are failing due to `strict mode violation`, meaning locators are not unique. This makes the test suite brittle and unreliable.
**Scope:** All files in `tests/e2e/`.
**Steps:**
1. Review all failing E2E tests.
2. For each `strict mode violation`, identify the non-unique locator.
3. Add `data-testid` attributes to the corresponding components in the application code.
4. Update the test files to use `getByTestId` to ensure locators are unique.
**Acceptance Criteria:**
- All `strict mode violation` errors in the E2E test suite are eliminated.
- The test suite provides a reliable signal of application health.
**Est. Impact:** High. Makes the E2E test suite usable and trustworthy.
**Effort:** L
**Dependencies:** None

#### [M2] Enforce Code Quality with Pre-commit Hooks
**Why:** To automate code formatting and linting, ensuring that all committed code adheres to the project's standards.
**Scope:** `package.json`, `.husky/`
**Steps:**
1. Add `husky` and `lint-staged` as dev dependencies.
2. Configure `husky` to set up a `pre-commit` hook to run `lint-staged`.
**Acceptance Criteria:**
- Code that does not meet linting or formatting standards cannot be committed.
**Est. Impact:** High. Improves code quality and consistency automatically.
**Effort:** M
**Dependencies:** [M1-1], [M1-2]

#### [M3] Introduce Unit/Integration Test Scaffolding
**Why:** To establish a testing foundation, ensuring that critical functionality can be verified automatically.
**Scope:** `vitest.config.mts`, `src/lib`, `src/components`
**Steps:**
1. Write a sample unit test for a critical utility function and an integration test for a simple UI component.
2. Document the testing strategy in the `README.md`.
**Acceptance Criteria:**
- At least two new, well-structured tests are added as examples.
**Est. Impact:** Medium. Provides a safety net and encourages a culture of testing.
**Effort:** M
**Dependencies:** None

#### [M4] Write Architecture Decision Records (ADRs)
**Why:** To document significant architectural decisions, providing context for future developers.
**Scope:** `docs/ADR/`
**Steps:**
1. Populate the ADR files for Routing, State Management, and Asset Strategy.
**Acceptance Criteria:**
- The three ADRs are populated with clear and concise descriptions.
**Est. Impact:** High. Improves long-term maintainability.
**Effort:** M
**Dependencies:** None
