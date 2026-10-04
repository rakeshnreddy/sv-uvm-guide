# NB2 overview and learner paths: review, round 1 (2026-10-04)

**Reviewer:** NB2 reviewer (read-only). **Branch:** `curriculum-quality-program`. **Build log:** [`NB2-overview-and-paths.build.md`](NB2-overview-and-paths.build.md).

**Verdict: pass.** There are no S1 or S2 findings and validation is green. There are 4 S3 findings, all about how the overview tells a learner where they are on a route, and 12 S4 findings.

## Validation (run by the reviewer)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0 (run at the start and again at the end of the review) |
| `npx eslint --max-warnings=0` on the 18 owned and new source files, the 7 new test files, `tests/fixtures/site-routes.ts` and both e2e specs | exit 0 |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run` on the builder's 7 specs plus `placementQuizLogic`, `server/assessment-question-bank`, `heading-slug` and `remark-heading-ids` | 11 files, 84 tests pass |
| `npx vitest run tests/qa` | 5 files pass (20 tests, 4 skipped), including `curriculumCoverageAudit` with the new e2e spec |
| Full `npx vitest run` | 247 files pass: 2,999 tests pass, 4 skipped |
| `npx playwright test --list` on `curriculum-overview.spec.ts` and `curriculum-diagram.spec.ts` | collects 17 tests. Not run, because this role may not start a server. |
| 390 px check (reviewer's own) | I rendered 10 states to static HTML from the real components and data, then measured them in Chromium with the compiled project CSS at 320, 390 and 1,280 px. The states: the SSR overview; each route followed with every tier and lesson list open; the map with a node focused; search results; the expert index; the placement intro, question and result. Horizontal overflow was 0 px in every case. |

## What I checked

**1. Correctness against G30 and the task.**

*Routes (task item 1; G30-PATH-04, PATH-V10).*
- Spine §8 does not exist, so the routes follow G30 "Routes". That is correct.
- I read `src/lib/learning-paths.ts` in full and resolved every route against the manifest:
  - Junior: 6 steps, 42 lessons.
  - Practitioner: 6 steps, 49 lessons.
  - Expert: 5 steps, 15 lessons.
- Every module is in manifest order. Every manifest prerequisite is earlier on the route, listed for review, or assumed (see S4-8).
- Every listed lab is available and owned by a module in its step. The milestone labs match `tb-mastery-progression.md`.
- **G30-PATH-V10 is fixed.** I-UVM-4 comes before A-UVM-6 on the Junior route. The test fails both ways if I-UVM-4 is removed: through `validateRoutes` and through the explicit check.
- Practice labels match NB4's practice registry today.

*Tier sections (task item 2; OVW-07, V12, V13).*
- Audiences come from the manifest. The `h3 > button` has `aria-expanded` and `aria-controls`, and the panel always exists.
- Electives have a dashed border and an "Elective" label.
- Modules are in manifest order, and `/curriculum#t3` opens Tier 3.
- Search opens every tier that has a match. I ran sample queries through `matchesQuery`:
  - mailbox → F2D, I-SV-5;
  - WSTRB → B-AXI-2;
  - config_db → I-UVM-2C;
  - RAL → A-UVM-4A, A-UVM-4B;
  - "ral" does not match "general".

*Map and resume (task item 3; OVW-02, OVW-06, PATH-09).*
- The map has 69 module links and 5 planned nodes that are not links. Columns are tiers, lanes are tracks, and the edges are the manifest prerequisites.
- The resume panel uses `findPrevNextTopics`: F2D/ipc leads to F3A, and the elective I-SV-8 returns to A-UVM-6.
- The "Explore the verification stack" cards use only anchors that exist. I checked all 5 with the shared slugger.
- The two corrected anchors in lead request 2 exist on the target pages:
  - `the-handshake-sequence--sequencer--driver`;
  - `objects-travel-components-stay-anchored`.

*Expert index (task item 4; PATH-08).*
- The page is a server component that reads the MDX at build time.
- Anchors match NB1's `remark-heading-ids` heading for heading over all 105 lessons. The parity test runs NB1's plugin.
- `remark-practice-slot` adds no markdown headings, so the ids on the real page are the same.
- The empty state is honest. The Push Further fallback follows the verifier's completeness gap 2.
- `/curriculum/expert-index` is not captured by any redirect, and the static segment wins over `[...slug]`.

*Placement (task item 5; PATH-01, 02, 03, 06).*
- The three dead links are gone.
- Every resource label equals its lesson title, and the test enforces this.
- Tier labels are the manifest titles.
- The start lessons are F1A, I-SV-1, A-UVM-6 and E-DBG-1. Each sits in its tier, and its prerequisites are on the skim list or assumed.
- The dashboard and assessment-center links appear only when `tracking` is on.

*Edge cases.*
- Electives: the core Next skips them, and the "Left for later" list excludes I-SV-8.
- Sub-lessons are listed in each module's lesson list and on the routes.
- Modules with no prerequisites (F1A) show no "Before you start".
- The last lessons work: E-SOC-1/pss and E-AI-1 have no next.
- Stale module ids in `curriculumProgress` are ignored.
- Without storage, the route choice is kept in memory.

**2. Accessibility and UX.**
- `/curriculum` has one `h1` and no inner `main`. The heading outline is coherent: h2 sections, h3 tiers and route cards, h4 modules and steps.
- Controls are real buttons and links:
  - `aria-pressed` on the Follow and List/Map toggles;
  - `aria-current="step"` on the current step;
  - `aria-describedby` on map nodes;
  - a polite live region for search counts and quiz feedback.
- The quiz is a fieldset radio group, and focus moves after each action.
- Transitions are `motion-reduce:transition-none`, and there is no smooth scroll. Focus rings come from the shared `focusRing`.
- Electives, the current step, map relationships and quiz correctness each have a text cue as well as colour.
- I computed contrast for every token pair used, in all 10 themes:
  - Default light and dark pass AA. The lowest pair is primary on background in default light, at 4.89:1.
  - Forest-dark fails for `text-primary` on `bg-background` (S4-7).
- The emerald and rose quiz colours have `dark:` variants, as visual-language §4 allows.

**3. Pinned behaviour (spine §3.5 and `tests/e2e`).**
- No lesson content changed.
- `curriculum-diagram.spec.ts` is correctly scoped to the "Explore the verification stack" region. A `<section>` with `aria-labelledby` is a region, and each card title is unique inside it.
- These specs still find what they look for on `/curriculum`: `navigation`, `mobile-navigation`, `ai-assistant-animation` and `curriculum-integrity`.
  - `div.grid` exists in the SSR HTML.
  - There is no "Course outline" heading and no "sign out" text.
  - No other exact-name "Search" button exists.
  - The expert index has an `h1` for the integrity crawl.
- The new spec's selectors are scoped or `exact`.

**4. Tests.** The tests are meaningful. They fail on:
- a forward prerequisite, an unknown or out-of-order lesson, or a coming-soon lab on a route;
- the G30-PATH-V10 regression;
- any of the three dead placement links;
- a tier label that is not the manifest title;
- an `h3` inside a button;
- a search that leaves tiers closed;
- a `#t3` hash that is not honoured;
- an expert anchor that differs from NB1's ids;
- a link on either page that does not resolve.

The gaps are S4-1 and S4-12.

## Findings

### S3

1. **S3 `src/lib/learning-route-state.ts:84-94` (`nextOnRoute`), shown at `src/components/curriculum/Recommendations.tsx:72-79`: route position follows the furthest lesson ever opened, and the "complete" message overstates.**
   - **Problem.**
     - **One late visit moves the position.** Opening one late route lesson once, for example from search, marks every earlier step as passed. A Practitioner who looked at B-AMBA-F1 is told "You are here: Step 6 … Next lesson: B-AMBA-F2", although steps 2–5 were never opened. I reproduced this in a render.
     - **The complete message is false.** When the furthest lesson is the route's last, the resume panel says "You have opened every lesson on this route". Progress keeps only the last lesson per module, so the site cannot back that claim, and it is false whenever the learner jumped ahead. `RouteChooser.tsx:181` says it accurately: "You have opened the last lesson on this route".
   - **Fix.**
     - Base "Next on your route" on the earliest gap: the first route lesson in a module with no visit, or after the module's last opened lesson. Keep the last-visit successor for "Continue the course".
     - At minimum, reword `Recommendations.tsx:74` to "You have reached the last lesson on this route".
     - Update `tests/lib/learning-paths.test.ts:244-253`.

2. **S3 `src/components/curriculum/RouteChooser.tsx:164-167` and `Recommendations.tsx:36-39`: steps without lessons are never current.**
   - **Problem.** The position comes only from `route.sequence`, so a step without lessons is never "You are here".
     - **Practitioner.** A new learner who follows this route gets "You are here: Step 2 … First lesson: I-SV-2B" and "Start with I-SV-2B". That skips Step 1, "Check your level" (placement quiz and skim), which the route's own call to action says to do first.
     - **Expert.** Step 4, interview preparation, likewise never becomes current.
   - **Fix.**
     - When `status === 'not-started'`, mark step 1 current and offer its first practice item, the placement quiz, as the action.
     - Render steps that have no lessons as "any time" steps, and say so, rather than skipping them silently.
     - Add a test that the Practitioner route starts at step 1.

3. **S3 `src/components/assessment/PlacementQuiz.tsx:263-268`, with `src/lib/learning-paths.ts:914-961`: the placement start step is not carried to the route.**
   - **Problem.**
     - **Tier 2.** The result says "Junior route · step 4 of 6 … Start at I-SV-1". "See the Junior route" (`/curriculum#route-junior`) then follows the route, marks Step 1 "You are here — First lesson: F1A", and the resume panel says "Start with F1A".
     - **Tier 3.** The same happens: the result says step 4 (A-UVM-6), and the route says step 2.
     - The mismatch lasts until the learner opens the start lesson.
   - **Fix.**
     - Carry the start step, for example `#route-junior-step-4`, parsed beside `routeIdFromHash` and stored with the route choice.
     - Let `nextOnRoute` start at that step while no later route lesson has been opened.
     - Or, at minimum, show "Your placement starts you at step N" in the route steps.

4. **S3 `src/components/curriculum/ModuleCard.tsx:65-68` and `:81`, `LearningPathDiagram.tsx:157` and `:179`, against `RouteChooser.tsx:203-207`: "You are here" means two things on one page.**
   - **Problem.**
     - On module cards and on the map, it marks the module of the lesson opened last, with `aria-current="location"`.
     - In the route steps, it marks the step of the next lesson.
     - After opening F2D/ipc on the Junior route, the page shows "You are here" on F2D (step 2) and on Step 3 at once. `tests/components/CurriculumOverview.test.tsx:237-252` asserts both.
     - `aria-current="location"` on a link to another page also suggests "this page".
   - **Fix.**
     - Label the route step "Up next" and keep `aria-current="step"`. Or label the cards and map "Last opened".
     - Drop `aria-current` from the card link, or keep it only for the step.
     - Update the two tests.

### S4

1. **S4 `tests/placement-links.spec.ts:104-112`: the tracking-off check cannot see the dashboard link.**
   - **Problem.**
     - The test renders the placement page at its intro stage. "Go to dashboard" exists only in the result stage, so the test cannot fail if `page.tsx:63` stopped passing `showDashboardLink={tracking}`.
     - `PlacementQuiz.test.tsx` covers only the component's default.
   - **Fix.** Mock `PlacementQuiz` in the page test and assert it receives `showDashboardLink: false`. Or render the page with RTL and finish the quiz.

2. **S4 `src/lib/learning-paths.ts:403-409`: the AMBA step lists labs out of prerequisite order.**
   - **Problem.**
     - The AMBA step lists `axi-deadlock-hunt-lab` before `axi-scoreboard-lab`, but the deadlock lab declares the scoreboard lab as a prerequisite (`content/curriculum/labs/axi_deadlock/lab1_hunt/lab.json:10-12`; G30-PRAC-V04).
     - `validateRoutes` (`:621-640`) does not check lab prerequisites.
   - **Fix.**
     - Swap the two entries.
     - Make `validateRoutes` require each lab's `labPrerequisites`, and any lab ids in `modulePrerequisites`, to appear earlier on the route or to be coming soon.

3. **S4 `src/components/curriculum/RouteChooser.tsx:300-308`: a route hash enrols the learner without asking.**
   - **Problem.**
     - `/curriculum#route-<id>` writes the choice to `localStorage`.
     - So "Compare the Junior, Practitioner and Expert routes" (`quiz/placement/page.tsx:97-109`) and "The Expert route" (`expert-index/page.tsx:155`) silently make the learner follow that route.
     - The resume panel then starts tracking it.
   - **Fix.**
     - Let the hash scroll to and highlight the card, and persist only on "Follow" or an explicit follow link from the placement result.
     - Or label those links "Follow the … route".

4. **S4 `src/components/curriculum/CurriculumBrowser.tsx:50-62` and `RouteChooser.tsx:300-308`: same-page hash links do nothing.**
   - **Problem.**
     - Both listen only for `hashchange`. Next.js same-page navigation uses `pushState`, which fires no `hashchange`.
     - So a `<Link href="/curriculum#t3">` clicked while already on `/curriculum`, for example from search or the outline, scrolls but leaves the tier closed.
     - Cross-page links work today.
   - **Fix.**
     - Also re-read `window.location.hash` after client navigation, for example with an effect on `usePathname()` plus `popstate`.
     - Or open the tier on `click` of in-page tier links.

5. **S4 `src/components/curriculum/Recommendations.tsx:43`, `:53`, `:99-103`, and the order at `CurriculumOverview.tsx:50-56`: three small problems in the resume panel.**
   - **Problem.**
     - **(a) Unreachable branch.** `showCourseNext` is false when there is no next lesson and no route lesson, so the "…the final lesson of the curriculum" branch never renders without a route.
     - **(b) Inaccurate subtitle.** "Based on the lessons you opened in this browser" is shown when only a route was chosen.
     - **(c) Layout shift.** The panel is inserted above the route chooser after hydration and on every Follow click. Browsers without scroll anchoring, such as Safari, will jump the clicked button or the `#route-*` target out of view.
   - **Fix.**
     - Compute `showCourseNext` as `Boolean(last) && (!courseNext || courseNext.key !== routeLesson?.key)`.
     - Vary the subtitle with the source of the suggestion.
     - Render the panel after the route cards, or reserve its space.

6. **S4 `LearningPathDiagram.tsx:84-87` and `ModuleCard.tsx:100-135`: some information is available only on hover or focus.**
   - **Problem.**
     - The map says "The list view gives the same prerequisites as text". It does for "needs", but "builds on it" (`unlocks`) appears only on map hover or focus. On touch, focus is followed by navigation, so touch users never see it.
     - Prerequisite chips and milestone chips show the full title only through the `title` attribute.
   - **Fix.** Add an "Unlocks:" row to `ModuleCard`. Show milestone names on the cards, or rely on the ladder and say so.

7. **S4 `src/app/globals.css:194-197` (forest-dark), affecting several NB2 links: `text-primary` fails AA on `bg-background` in one theme.**
   - **Problem.** In forest-dark, `text-primary` on `bg-background` is 3.95:1, below AA. Affected places:
     - milestone lab links on `bg-background` rungs: `RouteChooser.tsx:260`, `:275`;
     - the resume inner panels: `Recommendations.tsx:57`, `:75`, `:85`;
     - the placement skim list: `PlacementQuiz.tsx:256`, `:278`;
     - the map's 10 px "You are here": `LearningPathDiagram.tsx:163`, `:179`;
     - the breadcrumb and header links: `expert-index/page.tsx:128`, `quiz/placement/page.tsx:56`.

     It is 5.20:1 on `bg-card`. The other 9 themes pass. This is the same token problem as NB4 review S4-9.
   - **Fix.** The lead raises forest-dark `--primary` lightness. Or put these links on `bg-card`.

8. **S4 `src/lib/learning-paths.ts:98-100`, `:523-531` and `:605-611`: route validation accepts a third category, "assumed".**
   - **Problem.**
     - The task's rule is "earlier on the route or listed as review". The validator also accepts "assumed": 21 modules for Practitioner and all T1–T3 core modules for Expert.
     - That is reasonable, and it is disclosed through `assumesSummary`. But learners cannot see which modules are assumed.
   - **Fix.** The lead confirms the extension. Optionally, render the assumed modules as a collapsed "Assumed knowledge" list of links in the route steps.

9. **S4 `learning-paths.ts:180-185`, `:203`, `:220-222`, `:243-246`, `:335-337`, `:352`, `:369` and `:404`: data and styles are duplicated.**
   - **Problem.**
     - Practice labels are copied from NB4's registry (`src/lib/practice-links.ts`), and no test ties them together.
     - The style constants are duplicated in `expert-index/page.tsx:17-21`, `quiz/placement/page.tsx:35-37` and `PlacementQuiz.tsx:35-47`, instead of coming from `overview-ui.ts`.
   - **Fix.**
     - Take labels from `getPracticePage(href)?.title`, or assert equality in `learning-paths.test.ts`.
     - Import the shared classes.

10. **S4 `src/app/(learning)/quiz/placement/page.tsx:55-59` and `PlacementQuiz.tsx:194-197`: the copy overstates the result.**
    - **Problem.**
      - "Lessons for any area that scored under 75%": every area lists lessons.
      - "A short list of lessons to skim first": Tier 1 and Tier 4 have none.
      - "Each answer shows why it is right or wrong": the rationale is per question, not per option.
    - **Fix.** Align the copy, for example "…lessons for each area (start with any under 75%)" and "each answer is explained".

11. **S4 `src/app/(learning)/curriculum/page.tsx:29-47`: the client props are large.**
    - **Problem.** The page serializes about 143 KB of JSON into the client props: tiers with every sub-lesson description, plus 106 fully resolved route lessons that repeat the lesson data. The curriculum module is already in the client bundle through `useCurriculumProgress`.
    - **Fix.** Pass lesson keys in the route sequences and resolve them from the client-side lesson index. Consider trimming `lessonDescriptions` to search tokens.

12. **S4 `RouteChooser.tsx:49-52`, `tests/e2e/curriculum-diagram.spec.ts:22-27`, and landmarks at `TierSection.tsx:63` and `RouteChooser.tsx:170-174` and `:250`: three small accessibility and test gaps.**
    - **Problem.**
      - **(a) Route card headings.** The headings read "Start here", "Working DV engineer" and "Jump in", without the route names. "Start here" is both a heading and a link.
      - **(b) Region count.** Every named sub-section becomes a region landmark: 4 tiers, the steps, the ladder and the resume panel, about 10 regions on the page.
      - **(c) Anchor checks.** The stack-card e2e still checks only the URL. G30 request 6 asks it to assert that the anchor exists. All 5 anchors exist today.
    - **Fix.**
      - Add a visually hidden "Junior route:" to the `h3`.
      - Use `div` instead of `section` for the tier and ladder blocks, or drop their names.
      - Add ``await expect(page.locator(`[id="${anchor}"]`)).toHaveCount(1)`` after navigation, or add a unit check with `scanLessonHeadings`.

## Notes for the lead

- **Lead requests.** I checked lead requests 1–7 in the build log, and they are accurate.
  - **Request 2.** Both corrected anchors exist.
  - **Request 4.** The coverage audit passes with the new spec.
  - **Request 5.** NB1 already links `/curriculum#tN` (`src/lib/curriculum/lesson-context.ts:83`).
- **Deferred items.** The deferrals (OVW-08, PATH-05, PATH-07 navbar, PATH-09 home, PATH-04 lesson part, PATH-10/11, PATH-V16, SRCH-01) are outside NB2's ownership and are correctly routed.
- **E2E runs.** Please run `tests/e2e/curriculum-overview.spec.ts`, `curriculum-diagram.spec.ts` and `curriculum-integrity.spec.ts`. They collect but were not run here.
- **Before NB1's "Step k of N on your route".** S3-1 to S3-3 change how route position is computed, so fix them before NB1 builds on `nextOnRoute`. Otherwise lesson pages will repeat the same mismatches.
