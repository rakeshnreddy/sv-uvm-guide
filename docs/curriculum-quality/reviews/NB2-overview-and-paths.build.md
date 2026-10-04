# NB2 build log: curriculum overview and learner paths

**Builder:** NB2-overview-and-paths. **Branch:** `curriculum-quality-program`. **Date:** 2026-10-04.

This run resumed a cut-off run. The previous run had left only `src/lib/learning-paths.ts`, which this run rewrote and split. None of the owned components had been changed yet.

## What changed

- **`/curriculum` is now a server page.** It builds all of its data from the manifest, the generated curriculum, the lab registry and the lesson files. One client island adds what only the browser knows: the route the learner follows, and the lessons they have opened. The page has one `h1` and no inner `main`.
- **Route chooser.** It offers three routes:
  - Junior, "Start here", linking to F1A.
  - Practitioner, "Working DV engineer", linking to "Find your level", the placement quiz.
  - Expert, "Jump in", linking to "Expert layers", the expert index.

  Following a route shows its ordered steps: modules, lessons to skim, practice items (labs say they need sign-in; labs that are coming soon are not links) and milestones. The current step is marked "You are here" with `aria-current="step"`. Below the steps is a "Left for later" list of the core modules the route skips. The choice is saved in `localStorage` and is also set by `/curriculum#route-<id>`.

  A milestone ladder (M0–M8) shows which route builds each milestone and its practice lab.
- **Routes** live in `src/lib/learning-paths.ts`. Spine §8 does not exist, so they follow G30's "Routes" section.
  - **G30-PATH-V10 fixed:** the Junior route takes I-UVM-4 before A-UVM-6.
  - **Labels** for practice items match the practice registry, and lab titles come from the lab registry.
- **Modules by tier.**
  - Each tier `h3` wraps its disclosure button, which has `aria-expanded` and `aria-controls`.
  - Each tier shows its manifest audience ("Who it is for"), counts and an elective count.
  - Modules appear in manifest order. Electives have a dashed border and an "Elective" label.
  - The tier sections have ids `t1` to `t4`, and `/curriculum#t3` opens Tier 3.
  - "Expand all tiers" opens every tier.
- **Search.** It matches module codes, titles and descriptions, and every lesson's title and description. Matching is by word start, so "config_db" finds `uvm_config_db` and "ral" does not find "general". Every tier with a match opens, and a polite live region reports the count.
- **Module cards** show the lesson count, reading time (counted the way the lesson header counts it), "Before you start" links, milestones, labs with a sign-in note, and an expandable lesson list. A "Visited" or "You are here" marker comes from real visit data.
- **The "Diagram View" placeholder is replaced** with a curriculum map:
  - Tiers are columns and tracks are lanes. Every module node links to its first lesson.
  - Focus or hover marks the modules a node needs first and the modules that build on it, with text tags. Each link's description carries the same facts.
  - Planned spine modules (F2E, I-UVM-1D, I-UVM-3C, A-UVM-9, B-APB-1) appear as "Planned" text, not links.
- **"Recommended For You" is now "Pick up where you left off".** It shows the next lesson on the route the learner follows, the lesson after the one they opened last (from the generated `findPrevNextTopics`; F2D/ipc leads to F3A), and the lessons they visited recently. It renders nothing on a first visit.
- **The dead filters are removed.** The difficulty filter did nothing, and the status filter and the progress bars always read 0 because `completeLesson` has no caller.
- **`/curriculum/expert-index`** is a new server page that reads the MDX at build time.
  - It lists every `Expert:` heading as a deep link, grouped by tier and module.
  - Anchors come from `headingSlug` and `createSlugger`, fed every heading in document order. A test runs NB1's `remark-heading-ids` over all 105 lessons and gets identical ids.
  - No lesson is tagged yet, so each module shows an honest empty state, with a fallback link to its Push Further section where one exists.
- **Placement quiz.**
  - **Links:** the three dead lesson links now point to real lessons. Each category links three or four lessons and one practice page.
  - **Tier labels** are the manifest tier titles.
  - **Starting point:** each tier maps to a route step:
    - T1: Junior, step 1 (F1A);
    - T2: Junior, step 4 (I-SV-1), skimming the T1 steps;
    - T3: Practitioner, "environments" (A-UVM-6), skimming the T2 deep dives;
    - T4: Expert, step 1 (E-DBG-1).
  - **Results** say "Start at <lesson>", with "See the <Route> route" and a skim list.
  - **Gated links:** "Go to dashboard" and the assessment-center link appear only when the `tracking` flag is on.
  - **Theme tokens:** the old hard-coded light text was unreadable in light themes; it now uses tokens.
  - **Accessibility:**
    - Questions are a radio group inside a fieldset.
    - Answer feedback is announced through a live region.
    - Focus moves to the next control after each action.
    - Inline code in questions renders as `code`.

## Files

**Owned files changed:**
- `src/app/(learning)/curriculum/page.tsx`
- `src/components/curriculum/{TierSection,ModuleCard,LearningPathDiagram,Recommendations}.tsx`
- `src/components/assessment/{placementQuizData.ts,PlacementQuiz.tsx}`
- `src/app/(learning)/quiz/placement/page.tsx`

**New:**
- `src/lib/learning-paths.ts`: routes, validation, resolution, milestones, placement plans.
- `src/lib/learning-route-state.ts`: the chosen route and route position. It is client-safe and small.
- `src/lib/curriculum-overview.ts`: overview data, naming helpers, search matching, planned modules. It is pure.
- `src/lib/expert-index.ts`: heading scan and expert-index builder. It is pure.
- `src/lib/curriculum-scan.ts`: build-time file reads (manifest tiers, lesson bodies, reading time). It is server only.
- `src/app/(learning)/curriculum/expert-index/page.tsx`
- `src/components/curriculum/{RouteChooser,CurriculumBrowser,CurriculumOverview}.tsx` and `overview-ui.ts`

## G30 IDs addressed

- **Overview:** OVW-01, OVW-02, OVW-03, OVW-04, OVW-05 (lesson-level metadata search), OVW-06, OVW-07, OVW-09, OVW-10 (overview and placement), OVW-11, OVW-V12, OVW-V13.
- **Learner paths:**
  - PATH-01, PATH-02, PATH-03, PATH-06 and PATH-08;
  - PATH-V10;
  - PATH-04 (routes defined and shown on the overview);
  - PATH-07 and PATH-09 (overview part only).
- **Page:** PAGE-11 on `/curriculum` (the second `main` is gone).
- **Verifier's visuals notes:** the map's conditions (manifest prerequisite edges, columns and lanes, position marked by label and shape, planned modules not linked, the list as text equivalent) and the milestone ladder.
- **Verifier's completeness gap 2:** the expert index falls back to Push Further sections.

## Tests

**Added:**
- `tests/lib/learning-paths.test.ts`: every route against the manifest and lab registry. It checks that lessons exist on disk and that each prerequisite comes earlier on the route, is listed for review or is assumed. It also covers negative cases, the milestone ladder, placement plans and route position.
- `tests/lib/expert-index.test.ts`: the heading scan, its fallback, duplicate suffixes and grouping. It runs over the real curriculum and checks the contract with NB1's heading ids.
- `tests/lib/curriculum-overview.test.ts`: manifest order, audiences, prerequisites and unlocks, labs, reading time, next pointers, search and planned modules.
- `tests/placement-links.spec.ts`: every placement link resolves, the three dead links are gone, tier labels equal the manifest titles, start lessons sit in their tier, and the dashboard and assessment links are absent when flags are off.
- `tests/components/CurriculumOverview.test.tsx`: the route chooser, steps and hash, the ladder, tier semantics, the `#t3` hash, search, the lesson list, the map and the resume panel.
- `tests/components/PlacementQuiz.test.tsx`: the radio group, feedback, focus, Tier 4 and Tier 1 outcomes, the skim list and the dashboard gating.
- `tests/app/curriculum-overview-pages.spec.tsx`: server render of both pages, checking one `h1`, no `main`, and that every link resolves.

**Shared helper:** `tests/fixtures/site-routes.ts` resolves links against the curriculum, the lab registry and the `src/app` tree.

## E2E specs

- **Updated `tests/e2e/curriculum-diagram.spec.ts`:** links are now scoped to the "Explore the verification stack" region. The page has more links now, and a name such as "Functional Coverage Fundamentals" would trip strict mode.
- **New `tests/e2e/curriculum-overview.spec.ts`:** G30's overview, placement and expert-index acceptance checks. I could not run it here (no `next dev`).

## Deferred

- **OVW-08:** the stale anchors are in `uvm-link-map.ts`, which I do not own (see lead request 2).
- **PATH-05, PATH-07 (navbar), PATH-09 (home):** the home page and navbar are not mine.
- **PATH-04 on lesson pages** ("Step k of N on your route") belongs to the lesson page; the data and helpers are ready.
- **PATH-10, PATH-11, PATH-V16:** not mine.
- **OVW-05 heading-level search** belongs to the global search (SRCH-01).
- **Expert topics:** none exist yet. Authors add `### Expert:` headings in phase 4.
- **Milestone labs:** the M0 and M1 labs are coming soon and M5 has none. They are shown as text, not links.

## Requests for the lead

1. Run the e2e specs: `curriculum-overview` (new), `curriculum-diagram` (scoped) and `curriculum-integrity`. The integrity crawl now also visits `/curriculum/expert-index` and about 16 lesson pages.
2. Fix two stale anchors in `src/components/diagrams/uvm-link-map.ts` (OVW-08):
   - `#the-handshake-uvm_sequence-and-the-driver` becomes `#the-handshake-sequence--sequencer--driver` (I-UVM-3A);
   - `#uvm_component-vs-uvm_object` becomes `#objects-travel-components-stay-anchored` (I-UVM-1A).
3. Align the home path cards (`LearningPathsSection`, `HeroSection`) with `LEARNING_ROUTES`:
   - Junior goes to F1A;
   - Practitioner goes to `/quiz/placement`;
   - Expert goes to `/curriculum/expert-index`.

   Add a "Start here" item to the navbar pointing to `/curriculum#routes` (PATH-05, PATH-07, SIDE-05).
4. `tests/qa/curriculumCoverageAudit.spec.ts` treats every quoted `/curriculum/...` literal in an e2e spec as a lesson path. Let it accept static pages under `/curriculum` such as `expert-index`. My spec imports the constant instead.
5. Lesson page (NB1): `/curriculum#tN` now opens tier N, so the tier crumb can link there. The route position can come from `resolveRoutes` with `nextOnRoute` and `readSelectedRoute`.
6. When a planned spine module lands in the manifest:
   - remove it from `PLANNED_MODULES` (a test fails until you do);
   - add F2E, I-UVM-1D and I-UVM-3C to the Junior route.
7. Consider adding the routes to the spine as §8, so the route data has a spine source.

## Validation

All of these passed:
- `npx tsc --noEmit -p .`
- `npx eslint --max-warnings=0` on every file above.
- The new and related Vitest suites.
- The full `npx vitest run`: 247 files, 2,998 passed and 4 skipped.

I rendered static copies of the overview, expert index and placement pages, plus the followed-route, open-tier, map and quiz question and result states, with the compiled project CSS. At 390 px and 1,280 px, in the default light and dark themes, they showed:
- no horizontal overflow;
- AA contrast for every text element on a solid background (the shared gradient `Button` was not measured);
- no duplicate ids or dangling ARIA references.
