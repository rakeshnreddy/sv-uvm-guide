# NB1 lesson page: review, round 1 (2026-10-04)

**Reviewer:** NB1 reviewer (read-only). **Branch:** `curriculum-quality-program`. **Build log:** [`NB1-lesson-page.build.md`](NB1-lesson-page.build.md).

**Verdict: pass.** There are no S1 or S2 findings, and validation is green.

- **S3: 3 findings.**
  - S3-1 is for the builder: duplicate anchor ids from the practice block.
  - S3-2 is for the lead: a canonical redirect served from the production cache has no `Location` header. The builder already raised it as lead request 1. It does not count against this build, but the lead should fix it before release.
  - S3-3 needs a decision from the builder or the lead: the G30-PAGE-09 acceptance at 390 px.
- **S4: 7 findings.**

## Validation (run by the reviewer)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p . --incremental false` | exit 0, no output |
| `npx eslint --max-warnings=0` on every changed or new source file, the 12 unit specs, the 9 touched e2e specs and `scripts/generate-curriculum-redirects.mjs` | exit 0 |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run` on the builder's 12 spec files | 12 files, 86 tests pass |
| Existing specs that touch these files: `DiagramKit`, `curriculum-navigation`, `expert-index`, `heading-slug`, `remark-callouts`, `remark-concept-links`, `remark-jsx-paragraphs`, `qa/curriculumCoverageAudit`, `search-engine`, `ConceptLinkModal`, `practice-links`, `LearnInLesson` | 12 files: 248 tests pass, 2 are skipped |
| Full `npx vitest run` | 247 files: 2,999 tests pass, 4 are skipped (exit 0) |
| `node scripts/generate-curriculum-redirects.mjs --check` | "Validated 34 curriculum redirects." |
| `node scripts/check-mdx.mjs` on E-PSS-1 (to check that the registry parse still works) | 0 errors |
| `npx playwright test --list` on the 9 e2e specs the builder touched | 46 tests in 9 files collect. They were not run: this role may not start a server, and none was running. |

**Scratch checks** (in the session scratchpad, not in the repo):

- **Redirects under Next's matcher.** I ran HEAD's `curriculum-redirects.mjs` and the new one through Next's own `getPathMatch` and `modifyRouteRegex`. The old rules miss `/curriculum/T2_Intermediate/I-UVM-3_Sequences`, `/curriculum/T1_Foundational/F3B_Tasks_and_Functions` and `…/I-UVM-5_Phasing_and_Synchronization/index`. The new rules land them, so the rewritten test would have caught the dead rules.
- **The page's real MDX pipeline over all 105 lessons.** I used `lessonRemarkPlugins`, `getPracticeForModule` and `getAllLabs`, and collected every heading id, every literal JSX `id` and the practice-slot ids. The only duplicate is S3-1.
  - The slot lands at the root in 104 lessons. In I-SV-2B/solver-debug it lands inside `<InfoPage>`.
  - "Teach it back" is an H3 inside Practice in 38 lessons and an H2 in 67.
  - 27 lessons get Expert entries.
- **Contrast.** I computed contrast for the new token pairings in all 12 themes in `globals.css`. Every text pairing passes AA:
  - muted text on `card/80`, `muted/30`, `card/60` and `muted`: lowest 5.58:1;
  - foreground on `primary/10`: lowest 6.40:1.
  - The decorative `›` active-entry marker is `aria-hidden`; its lowest ratio is 3.48:1 (forest-dark).

## What I checked

### 1. Correctness against G30 and the task

**Item 1: heading ids and "On this page" (G30-PAGE-02).**
- `remarkHeadingIds` runs right after the slot plugin and before callouts and concept links. It feeds every markdown heading, at any depth and inside JSX, through one `createSlugger()`.
- Its ids match the search index generator and NB2's expert-index test, which agree for all lessons.
- The TOC is H2/H3 with nested `ol`s. The Expert badge is text. Push Further subsections and `Expert:` headings are marked.
- The disclosure works with NB3's `t` shortcut contract: `nav[aria-label="On this page"]`, `button[aria-controls]`, and `aria-current="location"`.
- Only InfoPage wraps TOC headings. No lesson hides a TOC heading in an accordion, so every TOC target is in the DOM.
- Defect: the slot's fixed ids can collide with authored headings (S3-1).

**Item 2: orientation (G30-PAGE-01, G30-PAGE-V01).**
- "Lesson k of N in <module>" and "module m of M in <tier>" follow the manifest order. I checked this against the manifest's I-UVM-3B list.
- The track badge is text, and the milestone labels match `tb-mastery-progression.md` M0–M8.
- "Before you start" links canonical URLs for the manifest prerequisites. On later pages of a module, the previous page comes first.
- Only F1A has no prerequisites, so "this lesson is a starting point" is accurate.
- The H1 is still `topic.title`, so 28 titles keep their " | Series" suffix. This is pinned by `curriculum-links` and `amba-curriculum`, and it belongs to the generator and content (G30-ORD-14).

**Item 3: `<BeforeYouStart />` and `<NextLesson />`.**
- Both are registered, and `check-mdx` parses both names.
- `getMdxComponents(…, { lessonSlug })` binds them to the page's lesson. An explicit `lesson` prop wins.
- Each renders a block `span`, so it is valid inside or outside a `p`.
- `NextLesson` equals `findPrevNextTopics` for all 105 lessons, as the test shows.
- Edge cases:
  - the last core lesson (E-SOC-1) gives "end of the core path";
  - the last elective gives "last lesson in the curriculum";
  - I-SV-8 (elective) returns to A-UVM-6.
- The wording differs slightly from the pager (S4-1).

**Item 4: canonical URLs (G30-PAGE-03, G30-LINK-V03, G30-LINK-V11).**
- `resolveCurriculumRequest` is byte-exact on three segments. Pretty, wrong-case, two-segment, one-segment and longer-than-three forms all 308 to the canonical URL.
- Every folder name is ASCII, so there is no redirect loop.
- Only canonical params are prerendered.
- `layout.tsx` has no `loading.tsx`, and no layout wraps the page in `Suspense`. So in `next dev` the redirect aborts the shell and returns 308 with `Location`, as the e2e expects.
- In production, the ISR cache replays 308 without `Location` (S3-2). I confirmed the builder's reading in Next 14.2.35:
  - `app-render.js:828-840` sets `Location` on `res` only;
  - `base-server.js:1484-1491` caches `metadata.headers` and `res.statusCode`;
  - `base-server.js:1744-1772` replays only those.

**Item 5: redirects (G30-LINK-03..06).**
- There are 13 `(/:slug*)` sources in HEAD and none now.
- 34 rules pass `checkCustomRoutes`, and every non-wildcard destination is a canonical lesson.
- Specific child rules sort before the `:slug*` rules.
- No rule captures a current lesson in any letter case.
- The test uses Next's `getPathMatch`, `modifyRouteRegex`, `prepareDestination` and `checkCustomRoutes`, and it fails on the old data.
- Mappings checked: F3C goes to F2C, which teaches fork/join (`F2C…/index.mdx:135`); heartbeats goes to E-DBG-1/hang-lab (verifier); uvm-callbacks goes to A-UVM-5.
- Older removed URLs are outside the rule set (S4-4).

**Item 6: not-found pages (G30-PAGE-04).**
- The root `not-found.tsx` disables the default not-found that Next inserts at the `(learning)` group (`next-app-loader.js:246-254`). So `notFound()` anywhere in `(learning)` bubbles to the root page.
- The root page wraps itself in `LearningLayout`, so there is exactly one navbar and one `main`.
- `curriculum/not-found.tsx` serves lesson 404s inside the layout.
- "This page could not be found." is kept, so `feature-flags.spec` still matches.
- No shell component uses `useSearchParams`, so the static `/_not-found` prerender will not bail out.

**Item 7: breadcrumbs (G30-PAGE-05..08, PAGE-14, PAGE-V14).**
- The trail is an `ol` in `nav[aria-label="Breadcrumb"]`, and only the last crumb has `aria-current="page"`.
- The tier crumb links `/curriculum#tN`, matching NB2's `tierAnchor`.
- On a module page the trail ends on the module crumb.
- There are no status icons and no "mins left".
- "Jump to" is a disclosure containing an `ol`. It handles Escape and returns focus, and it appears only for multi-lesson modules.

**Item 8: practice placement (G30-PAGE-V02).**
- The slot ends "Practice & Reinforce", or goes before "References", or goes at the end of the lesson.
- I checked the two unusual Practice H2s:
  - `solver-debug.mdx:82` ("Practice: Debugging a Real Conflict");
  - `flow-control.mdx:175` ("Practice Prompts").
  In both, the block lands before Interview and References.
- "Reinforce the essentials" is still a single `section`.

**Item 9: concept links.**
- `conceptLinking` now defaults to `false`.
- Only `I-SV-2A/index.mdx` sets the flag, and it sets `false`.
- `remarkConceptLinks` and `ConceptModal` still run behind the flag.

### 2. Accessibility and UX

- **Landmarks.** All three new navs have names: "Breadcrumb", "On this page" and "Previous and next lesson". The page has one `main` (the layout's) and one H1. The `header` sits inside `main`, so it is not a banner.
- **Focus order.** Crumbs, then "Jump to", then the "Before you start" chips, then the TOC button, then the article, then the pager.
- **Focus rings and targets.** Every control has a visible focus ring. Touch targets are at least 2.5rem below xl.
- **Escape.** It closes "Jump to" (a document listener) and the TOC disclosure (from within the nav), and returns focus in both cases.
- **No colour-only cues:**
  - TOC active entry: bold, a tinted background and a `›` marker;
  - current crumb: bold and last in the trail;
  - Jump to: a "Current" tag;
  - Expert: a text badge.
- **Reduced motion.** Every transition has `motion-reduce:transition-none`, and there is no smooth scrolling.
- **390 px.** Reading the classes:
  - `nav` is `flex-1 min-w-0` and "Jump to" is `shrink-0`, so the jump button never wraps and its `right-0` panel (`min(20rem,100vw-2rem)`) stays on screen;
  - chips are `max-w-full` and `break-words`;
  - the practice grid uses `minmax(min(100%,16rem),1fr)`;
  - the not-found path uses `break-all`.
  I found no overflow risk in NB1's markup.
- **Polish items:** S4-3 and S4-5.

### 3. Pinned behaviour (spine §3.5 and `tests/e2e`)

I read every e2e spec that visits a lesson for selectors the new markup could break.

**The H1.**
- `header h1` (`regression-gates`, `learner-flow`) still matches. The navbar has no H1, and the e2e lessons have no InfoPage or markdown H1.
- `getByRole('heading', { level: 1 }).first()` (`curriculum-links`, `-integrity`, `-navigation-comprehensive`, `amba-curriculum`, `t3_t4_new_modules`) still finds the chrome H1.

**Flashcards.** `section` filtered by "Reinforce the essentials" (`regression-gates` on B-AXI-4, `learner-flow` on E-PSS-1) still matches exactly one section: the slot is at the root in both lessons.

**Other e2e-pinned elements.**
- The arbitration to libraries Next adjacency.
- E-PSS-1's "Launch Lab" and its Next to E-PWR-1.
- The `/practice/lab/` LabLink.
- The AMBA "Reinforce the essentials" heading and "Card 1 of N".

**Text selectors.** Only `f1-revamp`, `f2-revamp` and `F4_lessons` read heading text with `getByText`, so only those could hit the TOC copy. The builder scoped them to `lesson-content`. The other `getByText` targets (Modport Explorer, Design vs. Verification, Event Region Scheduler, "The fundamental building blocks…") are not headings.

**`main nav a[href=…]`** (`curriculum-navigation-comprehensive`, `amba-curriculum`) may now resolve to a breadcrumb crumb with the same href. That crumb goes to the same URL, so the test still passes.

**Other specs.** `navigation`, `curriculum-navigation-comprehensive`, `amba-curriculum`, `regression-gates` and `learner-flow` were updated correctly. `home-links` normalises `/index`, and home links are canonical. `curriculum-diagram` hrefs are canonical.

**Not run.** The e2e suites were not executed, so the lead's run is the evidence. The one risk I could not check by reading is `lesson-orientation.spec.ts:131`: no sideways scroll on virtual-sequences at 390 px, a page that has a Monaco editor and a `BlockDiagram` (`minWidth` 300).

### 4. Tests

The tests are meaningful.

- **Redirects.** The redirect test fails on HEAD's rules, as the scratch check above shows.
- **Navigation.** The all-lessons tests are:
  - Next and Prev against `findPrevNextTopics`;
  - prerequisites pointing backward;
  - one canonical URL per lesson;
  - practice before References;
  - heading ids against the index algorithm.
- **Components.** The component tests check names, `aria-current`, Escape and the focus return.

**Gap.** The uniqueness test covers markdown heading ids only. It misses the slot-id collision (S3-1).

## Findings

| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| S3-1 | S3 (builder) | `src/lib/curriculum/remark-heading-ids.ts:84`; `src/lib/curriculum/lesson-mdx.ts:20-22`; `src/components/curriculum/LessonPractice.tsx:88`; `src/components/curriculum/LessonToc.tsx:159` | **The practice block's fixed ids can duplicate authored heading ids.** `B-AXI-5…/index.mdx:199` has `## Hands-On Practice`. The module has a lab, so the slot also renders `<h2 id="hands-on-practice">`. As a result:<br>- the page has two elements with that id;<br>- "On this page" lists two entries with the same id, which is also a duplicate React `key`;<br>- the block's TOC link jumps to the authored section instead;<br>- both entries go active together.<br>`tests/lib/remark-heading-ids.test.ts:137-150` checks only markdown heading ids, so it misses this. Any future `## Teach it back` or `### Reinforce the essentials` would collide the same way. | In `remarkHeadingIds`, run each `data.tocEntries` entry through the page's slugger in document order, so a clash becomes `hands-on-practice-1`. Write the resolved ids back onto the slot node as an attribute such as `ids`, and render them in `LessonPractice`. Keep `reinforce-the-essentials` as the default id. Extend the all-lessons test to assert unique ids across headings, slot entries and literal JSX `id`s. Optionally, leave "Hands-on practice" out when the lesson already has a hands-on H2. |
| S3-2 | S3 (lead; release blocker) | `src/app/(learning)/curriculum/[...slug]/page.tsx:48` | **In production, canonical redirects lose `Location` after the first request.** Non-canonical forms are rendered on demand and cached by ISR. The cache entry keeps the 308 status but not the `Location` header. From the second request on, `next start` returns 308 with no `Location` and an empty error shell.<br>- JS browsers land later, through the client router.<br>- curl, link checkers, non-JS crawlers and a production run of `lesson-orientation.spec.ts:32` do not.<br>`next dev` (the e2e) is unaffected. | Do lead request 1: run `resolveCurriculumRequest` in `src/middleware.ts` and return `NextResponse.redirect(url, 308)`, scoped to `/curriculum/:path*`. Keep the in-page `permanentRedirect` as a fallback. Add a production smoke check that requests each URL form twice and asserts `Location` both times. |
| S3-3 | S3 (builder or lead) | `src/app/(learning)/curriculum/[...slug]/page.tsx:99-104`; `src/components/layout/Breadcrumbs.tsx:52-57` | **The G30 acceptance "at 390 px, the module's lessons are visible before the article body" (G30-PAGE-09) is not met.** The old "Lessons in this module" aside is gone. Below lg, a module's lessons are reachable only behind "Jump to" or the outline drawer. The verifier also asked for a data-driven track stepper for multi-page modules, to replace "Page k of 8". The builder recorded this as partial. | Either render a compact module stepper under the header below lg, for modules with more than one lesson: an `ol` with `aria-current`, collapsible for long modules. Or the lead accepts "Lesson k of N" plus "Jump to" as meeting PAGE-09 and amends the acceptance. Then add the 390 px assertion to `lesson-orientation.spec.ts`. |
| S4-1 | S4 | `src/components/mdx/NextLesson.tsx:18-23` | **The MDX Next line and the Next card disagree at a tier boundary.** `stepNote` gives the tier boundary precedence and drops "back on the core path". I-SV-8's line reads "(starts Tier 3: Advanced)", while its Next card reads "Starts Tier 3: Advanced, back on the core path". | Add the `returnsToCore` note on tier steps too, or reuse `next.boundary` in lower case. |
| S4-2 | S4 | `src/lib/curriculum/lesson-urls.ts:98`; `src/lib/curriculum/lesson-context.ts:47-60`; `src/lib/curriculum-overview.ts:19-38` | **The same helpers exist three times.** `cleanTitle` is defined in both of NB1's files. `cleanTitle`, `moduleCodeOf` and `tierAnchorId` duplicate NB2's `cleanLessonTitle`, `moduleCode` and `tierAnchor`. The tier crumb's `#tN` must match the overview's anchors, so separate copies can drift. | At integration, import one set of helpers, for example from `curriculum-overview.ts` or a shared `curriculum-naming.ts`. |
| S4-3 | S4 | `src/components/curriculum/ModuleJumpMenu.tsx:63`, `:70` | **"Jump to" disclosure details.**<br>- `aria-controls` points to a panel that is not in the DOM while closed.<br>- Tabbing out of the open panel leaves it open over the page, until a pointer click or Escape. | Always render the panel with `hidden={!open}`, and close it on `focusout` when focus leaves the container. |
| S4-4 | S4 (lead) | `content/curriculum/redirects.json`; `tests/lib/curriculum-redirects.test.ts:125-126`; `src/lib/curriculum/lesson-urls.ts:141-143` | **Some removed URLs still 404 with no suggestion.**<br>The test comment and the build log say "every page that ever existed under a legacy folder". In fact this covers only folders that already had a rule. `git log --all` shows about 50 more removed lesson URLs with no rule, including:<br>- `T1_Foundational/F3D_Interprocess_Communication` and `F3E_System_Tasks_and_File_IO` (live 2025-11 to 2026-02);<br>- `T2_Intermediate/I-SV-2_Constrained_Randomization/*`, `I-SV-3_Functional_Coverage/*`, `I-SV-4_Assertions_SVA/*`, `I-SV-4A_Assertions_SVA_Fundamentals/*` and `I-SV-4B_Advanced_SVA/*`;<br>- `E-SOC-1/{coverage-closure,regression-triage}`, `E-INT-1/{dpi,pss}` and `E-DBG-1/reusable-vip`, removed in 2026-03.<br>They reach the not-found page, but `suggestLessonsForPath` needs an exact module code, so most get no "Did you mean". | Add rules for the 2026-era folders and lessons (lead decision on how far back to go). Reword the test comment. Let `suggestLessonsForPath` match code families, so `i-sv-4…` suggests I-SV-4A, I-SV-4B and I-SV-4C. |
| S4-5 | S4 | `src/components/curriculum/LessonOrientation.tsx:42-48`, `:57-67` | **The header repeats information, and single-page modules read oddly.**<br>- The tier appears twice: in the eyebrow ("Tier 2: Intermediate · …") and in the "T2 · Intermediate" badge.<br>- The 55 single-page modules read "Lesson 1 of 1 in F2A…". | Drop the tier badge or the tier from the eyebrow. Show "Lesson k of N" only when N > 1, and keep the module-position clause. |
| S4-6 | S4 | `src/app/not-found.tsx:10`; `src/app/(learning)/curriculum/not-found.tsx:8` | **The 404 tab title is the site default.** Neither not-found page sets metadata. | Export `metadata = { title: "Page not found" }` from both. |
| S4-7 | S4 (authors and lead) | `src/components/curriculum/LessonPractice.tsx:69-113`; `I-UVM-1B…/index.mdx:197`, `I-UVM-2B…/index.mdx:281`, `I-SV-2B…/solver-debug.mdx:90`, `I-SV-3B…/closure-workflow.mdx:97` | **Two gaps against G30.**<br>- The practice block omits two G30-PAGE-13 items: the quiz anchor and the module's interview questions (`/interview-prep` exists now).<br>- Four lessons use raw JSX `<h3>` headings, which get no id and no TOC entry. | Add a "Quiz" link when the lesson has a quiz heading, and an "Interview questions" link from NB4's map. Ask authors to turn the 4 raw `<h3>` headings into markdown `###`. |

## Notes for the lead

1. **S3-2 is the only finding that affects production behaviour.** Middleware is the clean fix. Nothing in NB1's files can avoid the ISR replay: `headers()`, `noStore()` or `revalidate = 0` would either break static generation for every lesson or raise "static to dynamic" errors.
2. **The e2e suites need the lead's run.** These are the 9 specs NB1 touched plus `lesson-orientation.spec.ts`; all collect. Watch `lesson-orientation.spec.ts:131`, the 390 px overflow check on virtual-sequences.
3. **The builder's lead requests 1–6 are accurate.** I confirmed that `curriculumCoverageAudit.spec.ts:114-125` collapses `--` (request 3) and the Next 14.2 caching path behind request 1.
