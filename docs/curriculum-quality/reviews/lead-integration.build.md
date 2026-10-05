# Lead integration build log (2026-10-04)

**Builder:** lead integration, after the navigation foundations (`caadcb12`). **Branch:** `curriculum-quality-program`. No git state changes, installs, builds or servers. Inputs: the "Requests for the lead" sections of the NB1–NB4 build logs. Nothing under `content/**`, `package.json`, the manifest or the generated curriculum data was edited.

## What changed, per item

| # | Item | Result |
|---|---|---|
| 1 | Header-level canonical redirects (NB1 request 1, review S3-2) | New `src/middleware.ts`. There was no middleware before (none in git history), so there was no existing behaviour to keep. It runs `canonicalLessonRedirect` (new, `src/lib/curriculum/canonical-redirect.ts`), which wraps the page's own `resolveCurriculumRequest`, so the two cannot disagree. Every non-canonical lesson URL (pretty slug, wrong case, two-segment module, one-segment tier, extra segments) now gets a 308 with `Location` on every request, before the ISR cache that drops `Location` on a hit. The query string is kept. Canonical lessons, non-lessons (the page still answers 404), static pages such as `/curriculum/expert-index`, and methods other than GET/HEAD pass through unchanged. The matcher is `/curriculum/:path+`, so `/curriculum` and the rest of the site never run middleware. The `next.config.mjs` legacy redirects still run first, and every destination is already canonical, so there is no second hop. The page keeps `permanentRedirect` as the fallback; a comment in `[...slug]/page.tsx` now says so. Next relativizes middleware `Location` headers, so e2e sees the same paths as before. |
| 2 | Styled `[...slug]/error.tsx` (NB1 request 2, G30-PAGE-04) | Same card as `CurriculumNotFound`: an "Error" eyebrow and one h1 ("This lesson could not be shown") in a labelled region. It shows the server's error reference (digest) only when one is sent. "Try again" is a real button. It calls `router.refresh()` and then `reset()` inside a transition, so a failed server render refetches. A `role="status"` line announces "Loading the lesson again…". The "Find your way back" block is now `FindYourWayBack`, exported from `CurriculumNotFound.tsx` and shared by both pages (output unchanged). Theme tokens only. |
| 3 | Navbar and sidebar entries (G30-SIDE-04/05, G30-PATH-07) | The main nav is now Start here (`/curriculum#routes`), Curriculum, Practice, Labs (`/practice#labs`) and Interview prep (`/interview-prep`), then the flagged links. Measured with Cal Sans metrics, the three primary links fit from md (about 670 of 720 px at 768). Labs and Interview prep join the bar from xl (`hidden xl:inline-flex`), which leaves the inline search about 375 px wide at 1280 (it would be about 120 px at 1024). The phone menu lists every link. `navLinkCurrent` never marks a link to part of a page (`#…`) as current; the page's own link carries `aria-current`. The course outline has a labelled "Quick links" list (Start here, Curriculum overview, Practice hub, Labs, Interview prep) in both the drawer (where following a link closes the drawer and moves focus to the target, as the tree does) and the docked column. That covers Labs and Interview prep wherever the bar hides them. Hrefs are shared constants in the new `src/lib/site-links.ts`. |
| 4 | Home page path cards (NB2 request 3, G30-PATH-05) | `LearningPathsSection` now renders the three `LEARNING_ROUTES` cards instead of four invented tiers. The home page (a server component) resolves the routes and passes `summarizeRoutes(...)` as small plain data, so the client cards never bundle the curriculum. Each card is an article labelled by its tagline. It shows "<Name> route", the audience, "N steps · M lessons", the ordered step titles, the route's CTA and "See the <Name> route" (`/curriculum#route-<id>`, which follows that route on the overview). Junior → F1A ("Start here"), Practitioner → `/quiz/placement` ("Find your level"), Expert → `/curriculum/expert-index` ("Expert layers"). The section intro links the route chooser, and the footer CTA is "Take the placement quiz". The cards use theme tokens and the overview's shared button classes; the old white text on emerald, sky, violet and amber buttons measured 2.2:1 to 4.2:1, below AA. In the hero, "Take skill assessment" becomes "Find your level" (same target), matching the Practitioner CTA and the quiz page's h1. The pinned hero h1, the rotating tagline and "Browse the curriculum" are unchanged. |
| 5 | ThemeSwitcher Alt+T (NB3 request 4) | ThemeSwitcher's own `keydown` listener is gone. `themeShortcutHandledByThemeSwitcher` is removed from `shortcuts.ts` and from `KeyboardShortcuts.tsx`, so the layout handles Alt/Option+T once, on every platform. It matches by `event.code` and pauses while typing. |
| 6 | Dead code (NB3 request 2, NB4 request 8) | Callers were searched across src, tests, scripts, content and docs before deleting. Deleted: `src/hooks/useKeyboardShortcuts.ts` (no importers), `src/contexts/NavigationContext.tsx` (its only state was the unused sidebar toggle; its only importers were the dead hook and the provider) and `src/components/exercises/ExerciseList.tsx` (no importers). `NavigationProvider` is removed from `ClientProviders`. ADR 0002, which cited `NavigationContext.tsx`, now points at `shell-store.ts`. |
| 7 | 3D sandbox back link (NB4 request 2, G30-PRAC-02) | `/visualizations/systemverilog-3d` renders `<LearnInLesson item={requirePracticePage(HREF)} />` under the intro. The h1, intro and back link now render on the server: only the visualizer, which reads `?scene=`, sits inside `Suspense`. The page uses theme tokens instead of fixed slate colours, and its metadata title comes from the practice map. The h1 text is unchanged, so the deep-linking spec's `/Array sandbox/` still matches only the visualizer heading. `PENDING_BACK_LINKS` is gone from both `tests/lib/practice-links.test.ts` (the source check now accepts either quote style) and `tests/e2e/practice-linkage.spec.ts`. |
| 8 | LabLink (G30-PRAC-09, G30-PRAC-10) | Available lab: "Launch Lab" (the name stays as pinned by `learner-flow`), with `aria-describedby` pointing at "Sign in required: the lab saves your progress to your account." Each callout gets its own id from `useId`. Coming-soon lab: a "Coming soon" chip, a short note and no link; archived: "Retired". The "Do this lab after <lesson>" line comes from `getLabPrerequisites(lab).doAfter`, through the same `LabPrerequisiteList` the lab page and the hub use. The card uses theme tokens and `not-prose`; the `--blueprint-*` variables it used before are not defined for the ocean, sunset, forest and violet themes. **How auth is determined:** `practice/lab/[labId]/page.tsx` calls `requireSession()` for every available lab and 404s the rest. The new `labRequiresSignIn(lab)` in `lab-registry.ts` states that rule, and a test holds it to the route source. "Sign in to save progress" alone would understate it: an unsigned learner cannot open the lab at all. |
| 9 | learning-paths reads the practice map (NB4 request 8) | Route steps name practice pages by route only (`practicePage(href)`, kind `'page'`). `resolvePractice` reads the title, kind and href through `getPracticePage`, so the overview's route steps, the Practice Hub and the page h1s cannot drift. `validateRoutes` reports a page that is missing from `PRACTICE_PAGES`. Kind labels for pages are now the practice map's ("Interactive model", "Diagram", "Exercise", "Tool"); the route steps used to say "Interactive" for diagrams too. `EXPERT_INDEX_HREF`, `PLACEMENT_QUIZ_HREF` and `INTERVIEW_PREP_HREF` now live in `site-links.ts` and are re-exported, so existing imports still work. learning-paths now imports server data through practice-links, so client components must keep importing only types from it, as they do today; the module comment says so. |
| 10 | Stale uvm-link-map anchors (NB2 request 2, G30-OVW-08) | Fixed: `#the-handshake-uvm_sequence-and-the-driver` becomes `#the-handshake-sequence--sequencer--driver` (4 links), and `#uvm_component-vs-uvm_object` becomes `#objects-travel-components-stay-anchored`. The `knownStale` list is removed from `remark-heading-ids.test.ts`, which now checks every anchored link-map href. |
| 11 | QA coverage audit (NB1 request 3, NB2 request 4) | Lesson anchors now come from `scanLessonHeadings` (`src/lib/expert-index.ts`). It applies one `createSlugger()` per page, in document order, exactly like the page's `remark-heading-ids` (held equal by `expert-index.test.ts`), so `#practice--reinforce` and repeat suffixes resolve. The practice block's own headings and `id="…"` attributes count too. The audit now accepts static pages under `/curriculum`, read from the App Router tree, as curriculum routes; `/curriculum/expert-index` passes. Two fixes on the way: app route patterns now drop route groups, and TS link maps are read for string literals. The opt-in strict link audit used to flag every `(learning)` route (11 false positives), and the anchor audit never read `uvm-link-map.ts`. Both strict audits (`QA_STRICT_LINK_AUDIT=1`, `QA_STRICT_ANCHOR_AUDIT=1`) now pass on the current content. |

## Files

- **New:**
  - `src/middleware.ts`, `src/lib/curriculum/canonical-redirect.ts`, `src/lib/site-links.ts`
  - Tests: `tests/lib/curriculum-middleware.test.ts`, `tests/components/{LessonError,ThemeSwitcher,LearningPathsSection,LabLink}.test.tsx`
  - E2E: `tests/e2e/navigation-entry-points.spec.ts`
- **Changed:**
  - `src/app/(learning)/curriculum/[...slug]/{error,page}.tsx` (page: comment only)
  - `src/app/(learning)/visualizations/systemverilog-3d/page.tsx`, `src/app/(public)/page.tsx`
  - `src/components/{Navbar.tsx,layout/Sidebar.tsx,layout/KeyboardShortcuts.tsx,ui/ThemeSwitcher.tsx,search/shortcuts.ts,providers/ClientProviders.tsx}`
  - `src/components/curriculum/CurriculumNotFound.tsx`, `src/components/diagrams/uvm-link-map.ts`, `src/components/mdx/LabLink.tsx`
  - `src/components/home/{LearningPathsSection,LearningPathCard,HeroSection}.tsx`
  - `src/lib/{learning-paths,lab-registry}.ts`
  - `docs/adr/0002-state-management.md`
  - Tests: `tests/components/{Navbar,Sidebar,KeyboardShortcuts}.test.tsx`, `tests/search/shortcuts.test.ts`, `tests/lib/{learning-paths,practice-links,remark-heading-ids}.test.ts`, `tests/qa/curriculumCoverageAudit.spec.ts`
  - E2E: `tests/e2e/{lesson-orientation,practice-linkage}.spec.ts`
- **Deleted:** `src/hooks/useKeyboardShortcuts.ts`, `src/contexts/NavigationContext.tsx`, `src/components/exercises/ExerciseList.tsx`

## Tests

- **Middleware (14):**
  - every canonical lesson passes;
  - every lesson's pretty, upper-case, module, extra-segment and tier forms redirect to it;
  - the decision equals the page's `resolveCurriculumRequest` on every sample;
  - encoded segments, 404 URLs and GET/HEAD only;
  - static pages under `/curriculum` (scanned from `src/app`) are never redirected;
  - no legacy-redirect destination is redirected again;
  - the real `middleware()` returns 308 with an absolute `Location`, keeps the query string, and returns `x-middleware-next` otherwise;
  - the matcher, compiled with Next's own `getMiddlewareMatchers`, runs on `/curriculum/*` and nowhere else.
- **Error page (6):** one h1 in a labelled region; retry calls `refresh` and `reset` (click and keyboard); a status region; the digest only when sent; the way-back links.
- **Navbar (+3):** order and hrefs of the five links; `hidden xl:inline-flex` only on Labs and Interview prep; `aria-current` on pages and never on `#` links. The phone-menu test now also checks that every link is listed.
- **Sidebar (+2, 2 rewritten):** the drawer's quick links equal `OUTLINE_QUICK_LINKS`; following one closes the drawer; the docked column ends with the list and none is `aria-current`. The Tab-trap test now uses the last quick link.
- **Shortcuts (+1, 1 rewritten):** Alt+T and Option+T toggle exactly once; nothing toggles while typing. ThemeSwitcher ignores Alt/Option+T, and its button still toggles. The guard's own test is removed.
- **Home (6):** summaries follow `LEARNING_ROUTES`; the card CTAs (F1A, the placement quiz, the expert index); "See the route" links; steps and audience; every link resolves through `tests/fixtures/site-routes.ts`; hero links.
- **LabLink (8):** the "Launch Lab" name and description; coming-soon has no lab link; doAfter (through a mocked registry entry with a later module prerequisite); unique ids for two callouts; unknown id; `labRequiresSignIn` against the route source.
- **learning-paths (+2):** every practice page's label, kind and kind label come from the practice map; an unmapped page is reported and refused.
- **QA audit (+3):** static curriculum pages are accepted; route-group app routes match; anchors use the page slugger (`--`, the practice block) and the link map is read.

## E2E specs

None of these could be run here (no dev server). `tsc` type-checks them.

- **New `navigation-entry-points.spec.ts`:**
  - at 1280 px: the three new nav links and where they land (`#routes` and `#labs` in view, Interview prep current);
  - the quick links in the drawer and the docked column;
  - at 390 px: the phone menu lists all five and the header has no sideways scroll;
  - home cards: CTAs and a click to the expert index, then no overflow at 390 px;
  - the E-PSS-1 lab callout's sign-in description;
  - Alt+T flips `data-theme` exactly once per press.
- **`lesson-orientation.spec.ts`:**
  - every redirect form is requested twice and must return 308 with `Location` both times (the production smoke check from review S3-2);
  - the 404 "Curriculum overview" check is scoped to `main`, because the footer site map has the same link, which would be a strict-mode violation.
- **`practice-linkage.spec.ts`:** now covers the 3D sandbox too.
- **Release-pinned behaviour (spine §3.5) is intact:**
  - "Launch Lab" on E-PSS-1 and the `/practice/lab/` LabLink on E-PWR-1;
  - the hero h1 and "Browse the curriculum";
  - "Reinforce the essentials";
  - the lesson Prev/Next and breadcrumb landmarks.

## Validation

- `npx tsc --noEmit -p .` exits 0.
- `npx eslint --max-warnings=0` on every changed and new file above exits 0.
- **Full `NODE_OPTIONS='--require @prisma/client' npx vitest run`: 249 of 252 files pass; 3,029 tests pass and 4 are skipped.**
  - The baseline before this work was 247 of 247 files.
- **The 3 failing files all come from the lesson rewrite in progress under `content/**` and `content/flashcards/**`, not from this work.** Every failing case names a lesson or deck that is modified in the working tree.
  - `tests/search/search-index-anchors.test.ts` fails for 16 lessons whose headings changed: F1A, F1B, F2A (3 pages), F2B, F2C, F2D (3 pages), F3A, F3B, I-SV-5 events and semaphores, I-SV-6 and I-SV-7. `src/generated/search-index.json` needs regenerating after the wave.
  - `tests/curriculum-generator.test.ts` (2 cases, including the snapshot) fails because lesson descriptions changed; `src/lib/curriculum-data.tsx` needs regenerating.
  - `tests/lib/flashcard-registry.test.ts` (2 cases) fails because the new `F2B_Dynamic_Structures.json` and the edited `F2_Data_Types.json` are not registered.
- `tests/app/feature-gating.spec.tsx` timed out once (5 s) during a run at load average 50; it passes alone and in the second full run.

## Deferred and follow-ups

- **Navbar with every flag on.** With dev/e2e flags on (Dashboard, Community and the account controls), the 1280 px bar leaves the search field about 80 px wide. At 768 px, the flagged links already overflowed before this change. Production flags are off. If those flags ship, move Dashboard into the account menu (it is already there) and add a "More" disclosure for the rest.
- **LabLink on checkpoint lessons.** `uvm-mini-capstone` is linked from I-UVM-1B, 2A, 2B and 3A but launched from A-UVM-6. Saying "after A-UVM-6" there needs the lesson slug bound to LabLink in `getMdxComponents`, the way `BeforeYouStart` is bound. The task scoped this item to `doAfter`.
- **Generated data after the content wave:**
  - regenerate `src/lib/curriculum-data.tsx` and `src/generated/search-index.json`;
  - register the new flashcard decks;
  - wire `generate-search-index.mjs` into `generate:curriculum`, which needs a `package.json` edit (out of bounds here; NB3 request 1).
- **Content requests from NB1 and NB4 (lesson authors):**
  - B-AMBA-F3 → `/interview-prep#amba-protocol-interview-question-bank`;
  - lab README site URLs;
  - the lab manifest prerequisite fixes;
  - `<BeforeYouStart />` and `<NextLesson />` placement.
