# Lead integration: review, round 1 (2026-10-04)

**Reviewer:** lead-integration reviewer (read-only). **Branch:** `curriculum-quality-program`. **Build log:** [`lead-integration.build.md`](lead-integration.build.md).

**Verdict: pass.** There are no S1 or S2 findings, and validation is green.

- **S3: 2 findings.** Both are UX decisions in item 3 (navbar and route naming), not defects in the code.
- **S4: 4 findings.** Test strength, tracker accuracy and one h1.

## Validation (run by the reviewer)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0 |
| `npx eslint --max-warnings=0` on the 21 changed or new source files and the 16 changed or new specs | exit 0 |
| `CI=true NODE_OPTIONS='--require @prisma/client' npx vitest run` on 32 files: the builder's new and changed specs, plus every spec that imports a changed module (`CurriculumNotFound`, `CurriculumOverview`, `PlacementQuiz`, `PracticeHub`, `MainLayout`, `LearnInLesson`, `LabNavigation`, `LessonMdxPipeline`, `expert-index`, `curriculum-overview`, `lab-registry`, `lab-assets`, `server/labs`, `labsPlatformAudit`, `placement-links`, `interview-prep-banks`, `amba-curriculum-content`, `unit/uvm-link-map`, `learning`) | 32 files: 456 tests pass, 2 are skipped |
| `tests/qa/curriculumCoverageAudit.spec.ts` with `QA_STRICT_LINK_AUDIT=1 QA_STRICT_ANCHOR_AUDIT=1` | 11 of 11 pass, none skipped (confirms the build log's claim) |
| `npx playwright test --list` on `navigation-entry-points`, `lesson-orientation` and `practice-linkage` | 42 tests in 3 files collect. List mode loads specs only (no web server). Not run: this role may not start a server. |

**Scratch checks** (session scratchpad, not the repo):

- **No chains or loops with the legacy redirects.** I bundled `canonicalLessonRedirect` and `resolveCurriculumRequest` with esbuild and ran them over `curriculum-redirects.mjs`.
  - No redirect source is a live lesson (0), and none is a middleware redirect (0).
  - Destinations are canonical (the builder's test).
  - Edge inputs: a trailing slash passes; `//T1_Foundational` and `…/INDEX` redirect to canonical; `/curriculum/expert-index/x` and a `%2F` inside a segment pass to the 404.
- **Next 14.2.35 internals.**
  - The matcher compiles with Next's own `getMiddlewareMatchers`.
  - `resolve-routes.js` relativizes a middleware `Location` for redirect statuses. So the e2e path comparison holds, and a spoofed `Host` cannot leak into `Location`.
  - The adapter strips `_rsc` before middleware runs (see note 3).
- **The middleware is Edge-safe.** Its import graph is `src/middleware.ts` → `canonical-redirect.ts` → `lesson-urls.ts` → `curriculum-data.tsx`. The last file has no imports and is about 62 KB. No Node APIs.
- **Release pins.** All 17 lab ids used by `<LabLink>` in content are `available`. So E-PWR-1 keeps its `/practice/lab/` link and E-PSS-1 keeps "Launch Lab" → `pss-portable-intent`.

## What I checked

### 1. Correctness, per item

1. **Middleware 308s.** The decision wraps the page's own `resolveCurriculumRequest`, so the two cannot disagree. It sends GET and HEAD only, so Server Action POSTs pass through.
   - The `/curriculum/:path+` matcher skips the overview, `/api`, `/_next` and the rest of the site. Nothing under `public/` or any route handler lives below `/curriculum/`.
   - Canonical URLs never redirect: the test covers all lessons and every static page under `/curriculum`.
   - Query strings are kept. `config.redirects` runs first.
   - No middleware existed before. The `src/middleware.ts` in `origin/backup/curriculum-quality-wip` (2aa64342) is a snapshot of this same work.
   - The page comment and the `permanentRedirect` fallback are fine.
2. **error.tsx.** It is a client boundary inside the learning layout. It has one h1 in a labelled section, a real button with a 44 px target, and `aria-disabled` while pending.
   - `router.refresh()` and `reset()` run inside `startTransition`, which is the documented recovery pattern for server render errors.
   - The always-present `role="status"` region and the digest-only reference are good.
   - `FindYourWayBack` is shared with the not-found page, and its output is unchanged.
3. **Navbar and outline.**
   - The order and hrefs are correct.
   - `navLinkCurrent` never marks `#` links as current.
   - The phone menu lists all five links, and the 390 px header is unchanged.
   - Quick links render in the drawer and in the docked column. Their focus handling reuses `focusAfterNavigation`, which handles hashes.
   - `#routes` (`RouteChooser`) and `#labs` (the Practice Hub h2, from the shared slugger) exist.
   - Production flags are off, so the bar holds the three primary links from md. With all e2e flags on, the 1280 px search is narrow but nothing overflows. That trade-off is documented. See S3-1.
4. **Home cards.**
   - The server page resolves the routes and passes small summaries.
   - Client files import only types from `learning-paths`. I checked every importer: all of them are type-only or server files.
   - The CTAs are F1A, `/quiz/placement` and `/curriculum/expert-index`. `/curriculum#route-<id>` is handled by `routeIdFromHash`.
   - The cards use theme tokens and `MotionConfig reducedMotion="user"` (the public layout).
   - The hero h1 and "Browse the curriculum" are unchanged.
   - No spec pinned the old card text or "Take skill assessment". `home-links`, `hero-animation` and `F2_F3_lessons` still hold.
5. **Alt+T.**
   - `ThemeSwitcher` renders only in `Navbar`, which renders only in the learning layout, where `KeyboardShortcuts` is mounted. So no page lost the shortcut.
   - The layout matches by `event.code` and pauses in fields, including the theme `<select>`.
6. **Dead code.** I found no import, `vi.mock` or script reference to `useKeyboardShortcuts`, `NavigationContext`, `NavigationProvider`, `useNavigation` or `ExerciseList` in src, tests, scripts or content. Only historical G30 docs mention them.
   - `NavigationContext` held only the sidebar toggle.
   - `resolveCurriculumPath`, which the old cards used, still has callers.
7. **3D sandbox.**
   - `<LearnInLesson>` sits under the intro. The h1 and back link render on the server, and only the visualizer is inside `Suspense`.
   - `bg-background` replaces `bg-slate-950`. The visualizer uses `bg-card` and keeps its own dark canvas.
   - `PENDING_BACK_LINKS` is gone from both specs. The source check accepts both quote styles.
8. **LabLink.**
   - Available labs keep the "Launch Lab" name, described by the sign-in note through a per-callout `useId`. `useId` is one of the hooks allowed in Server Components, and the MDX registry is imported only by the server lesson page.
   - Coming-soon and archived labs show a chip and no link.
   - `doAfter` uses the hub's `LabPrerequisiteList`.
   - `labRequiresSignIn` matches the lab route: `requireSession()` for every available lab, and 404 otherwise.
9. **learning-paths.**
   - Practice pages resolve through `getPracticePage`. `validateRoutes` reports unmapped pages.
   - Nothing consumed the removed `'visualizer'` kind.
   - The constants are re-exported, so the e2e imports still work.
10. **Link map.** Both new anchors match the current headings of I-UVM-3A and I-UVM-1A under the page slugger. `knownStale` is gone, and the test now asserts that it checked at least one link.
11. **QA audit.**
    - `scanLessonHeadings` uses one `createSlugger()` per page, in document order. `expert-index.test.ts` holds it equal to the page.
    - Static `/curriculum/*` pages are accepted, and route groups are dropped from app patterns.
    - The TS link-map regex cannot match template literals (it stops at `$`).

### 2. Release-pinned behaviour (spine §3.5)

The following pins are intact:
- "Launch Lab" → `pss-portable-intent` (`learner-flow`) and E-PWR-1's `/practice/lab/` link (`regression-gates`; that spec's two-segment URL now gets its 308 from middleware).
- The hero h1 and "Browse the curriculum".
- The 3D deep-linking spec's case-sensitive `/Array sandbox/`, which still matches only the visualizer title.
- Breadcrumb, Prev/Next and "On this page" landmarks: they are untouched, and the quick links never carry `aria-current`.
- The 404 spec's "Curriculum overview" is correctly scoped to `main`, because the footer and outline repeat that link.

### 3. Tests

The new specs are meaningful:
- The middleware spec checks every lesson and every URL form, agreement with the page, the matcher as Next compiles it, and the real `NextResponse`.
- LabLink uses a mocked forward lab for `doAfter` and checks `labRequiresSignIn` against the route source.
- ThemeSwitcher checks that it registers no global listener.
- The home cards are checked against `LEARNING_ROUTES` and `appRouteExists`.

Weak spots are S4-1 and S4-4.

## Findings

| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| S3-1 | S3 (lead decision) | `src/components/Navbar.tsx:37-38`, `:375` | **From 768 to 1279 px the bar has no Labs or Interview prep.** They are `hidden xl:inline-flex`, and the phone menu is `md:hidden`. At those widths (common laptop and tablet-landscape windows), the only path is the course outline: the drawer quick links, or the docked column on lessons at lg and wider, which a learner may have hidden. The task asked for navbar entries. The build log explains why: the search field would shrink to about 120 px at 1024. | Either record it as the accepted md–xl behaviour (the outline is the path), or add a "More" disclosure in the bar below xl. It would list Labs and Interview prep, and later the flagged links, with `aria-expanded`, `aria-controls` and Escape to close. |
| S3-2 | S3 | `src/components/Navbar.tsx:34`, `src/components/layout/Sidebar.tsx:45` (both `START_HERE_HREF`); `src/lib/learning-paths.ts:165`, `:170` | **"Start here" now names two destinations.** The navbar and outline "Start here" open the route chooser (`/curriculum#routes`). The Junior route's CTA, also "Start here", opens F1A. It is rendered by the route chooser on `/curriculum` and by the home Junior card, whose heading is also "Start here". On `/curriculum`, a screen reader's links list shows two "Start here" links with different targets. The context disambiguates each one (WCAG 2.4.4 passes), but it is confusing, and it fails 2.4.9. | Keep the task-specified nav label. Rename the Junior CTA in `LEARNING_ROUTES` (for example "Start with F1A") and consider the tagline too. Update `tests/lib/learning-paths.test.ts:152`, `tests/components/LearningPathsSection.test.tsx:49`, `:69`, `tests/components/CurriculumOverview.test.tsx:73`, `tests/e2e/curriculum-overview.spec.ts:28` and `tests/e2e/navigation-entry-points.spec.ts:101`. Agree the wording with the NB2 owner. |
| S4-1 | S4 | `tests/e2e/lesson-orientation.spec.ts:41-46`; build log "E2E specs" | **The "twice" loop does not test the cache path under the default config.** It is the production smoke check from NB1 review S3-2. But `playwright.config.ts` starts `next dev`, which has no ISR cache. So the second request proves only that middleware answers in dev, and the loop would pass without the fix. | Say in the spec comment and the build log that the cache-hit guarantee needs a run against `next build && next start -p 3100`. Playwright reuses a server already on 3100 when `CI` is unset. Do that run before release. |
| S4-2 | S4 | `src/components/layout/Sidebar.tsx:37-43`; build log item 3 | **G30-SIDE-04 is cited as done, but only part of it shipped.** The finding asks for quick links to the current module's labs, exercises and visualizers, plus "Find your level". The new quick links are site-wide. They do fix the old "one arbitrary exercise" problem. | Mark G30-SIDE-04 as partial in the build log and the tracker. The module links come with the lesson Practice panel (NB4 request 5). |
| S4-3 | S4 | `src/app/(learning)/visualizations/systemverilog-3d/page.tsx:22` | **The h1 is still hard-coded and does not match the practice map.** It reads "SystemVerilog array sandbox", while the tab title, hub card and back-link label use "SystemVerilog Array Sandbox" from the practice map. Other practice pages render `practice.title`. The build log's reason, that the h1 must not match the deep-link spec's `/Array sandbox/`, does not hold: the map title has a capital "S", so that case-sensitive regex would not match it either. | Render `{practice.title}` in the h1. |
| S4-4 | S4 | `tests/components/LessonError.test.tsx:63-66` | **The status test only checks that an empty `role="status"` exists.** Nothing asserts that "Loading the lesson again…" appears while a retry is pending, that the button is `aria-disabled`, or that a second click is ignored. | Keep the transition pending in the test (for example, mock `useTransition` to return `[true, fn]`). Then assert the status text, `aria-disabled="true"`, and that `reset` is not called again on a second click. |

## Notes for the lead

1. **No build was run** (by the builder or the reviewer). The risky parts check out on reading:
   - the Edge import graph is clean;
   - `useId` in the server `LabLink` is allowed in RSC;
   - `error.tsx` is a client module importing a client module;
   - the 3D page's `metadata` uses a module-scope `requirePracticePage`.

   Still, run `next build` once before merge, so the Edge middleware compile and the RSC boundaries are verified for real.
2. **Run the e2e specs** (`navigation-entry-points`, `lesson-orientation`, `practice-linkage`, `home-links`, `mobile-navigation`, `systemverilog-3d-deep-linking`). Run `lesson-orientation` once against `next start` as well (S4-1).
3. **Deployment caveat, not a defect.** Next strips `_rsc` from the URL middleware sees. So a client navigation or prefetch to a non-canonical lesson URL follows the 308 to the canonical URL without the `_rsc` cache-buster, and with the `RSC` header. Browsers honour `Vary`, and in-app links are canonical (breadcrumbs, the outline and audited content), so exposure is small. But if a CDN that ignores `Vary` ever fronts the standalone server, it could cache an RSC body under a lesson URL. Add "the CDN must respect `Vary: RSC, Next-Router-*`, or bypass the cache" to the deployment checklist.
4. **I agree with the builder's deferrals:**
   - `LabLink` on checkpoint lessons: `uvm-mini-capstone` in I-UVM-1B, 2A, 2B and 3A gives no "after A-UVM-6" hint until the lesson slug is bound to it.
   - The crowded bar when every flag is on.
   - The generated-data regeneration after the content wave.
