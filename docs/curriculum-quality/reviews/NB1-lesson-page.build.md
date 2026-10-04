# NB1 lesson page: build log (2026-10-04)

**Builder:** NB1-lesson-page. **Branch:** `curriculum-quality-program`. No git state changes, installs or builds. The previous run of this role had left no work in its files, so everything below is new in this run.

## What changed

| Area | Result |
|---|---|
| Canonical URLs (G30-PAGE-03, G30-LINK-07, G30-LINK-V03, G30-LINK-V11) | `resolveCurriculumRequest` (`src/lib/curriculum/lesson-urls.ts`) classifies every `/curriculum/[...slug]` request. The page calls `permanentRedirect` (308) to `/curriculum/<Tier>/<Module>/<lesson>` for pretty slugs, wrong letter case, two-segment module URLs, one-segment tier URLs and extra trailing segments. Pretty slugs keep working through the redirect. Only canonical URLs are prerendered. |
| Heading ids and "On this page" (G30-PAGE-02) | `remarkHeadingIds` gives every markdown heading, including headings inside JSX, the `heading-slug` id. It feeds the slugger the same way as the search and expert indexes; a test checks this over all 105 lessons. `LessonToc` is a `nav` named "On this page" with nested H2/H3 lists. Below xl it is a collapsed disclosure above the lesson; Escape closes it and returns focus. At xl it is a sticky right column. The section being read has `aria-current="location"`. The Push Further section, its subsections and `Expert:` headings carry a text "Expert" badge. |
| Orientation header (G30-PAGE-01, G30-PAGE-V01) | `LessonOrientation` shows: tier and module; the H1 (still inside `header`); text badges for track ("Core path" or "Elective (optional)") and tier; read time; "Lesson k of N in <module>, module m of M in <tier>" in manifest order; "Builds toward: M…" milestones; and "Before you start" links to the manifest prerequisites. On a later page of a module, the page before comes first. All links are canonical. Data comes from `src/lib/curriculum/lesson-context.ts`, which reads tier titles from the manifest. |
| MDX components (G30-LINK-02) | `<BeforeYouStart />` and `<NextLesson />` are registered in `mdx-component-registry.tsx`. `getMdxComponents(requested, { lessonSlug })` binds them to the lesson being rendered, so authors write them without props; an explicit `lesson` prop still wins. `NextLesson` uses the generated core-path Next, so it always equals the page's Next card. Both render a block `span`, so they are valid on their own line or inside a paragraph. |
| Practice placement (G30-PAGE-V02, G30-PAGE-13) | `remarkPracticeSlot` inserts the page's practice block at the end of "Practice & Reinforce"; otherwise before "References…"; otherwise at the end. The block holds "Reinforce the essentials" (the e2e-pinned flashcards heading, still one `section`), "Hands-on practice" and "Teach it back". "Hands-on practice" lists the module's labs, exercises and interactive models from NB4's `getPracticeForModule`. Planned items are text, not links. Items taught later say "Do this after <lesson>", and labs say "Sign in to run labs". All three headings are in "On this page". |
| Pager (G30-PAGE-10, G30-PAGE-V14) | A `nav` named "Previous and next lesson". Each card says where the step goes: "Lesson 4 of 9 in I-UVM-3B", "Next module: F2D", "Starts Tier 3: Advanced", "back on the core path". After the last lesson, an end card links the overview and the practice hub. The link name still starts "Next lesson <title>" (pinned by `navigation.spec`). |
| Breadcrumbs (G30-PAGE-05..08, G30-PAGE-14, G30-PAGE-V14) | The breadcrumbs are now a server component. The trail is an `ol` in `nav[aria-label="Breadcrumb"]`, with `aria-current="page"` on the last crumb. The tier crumb goes to `/curriculum#tN`, matching `tierAnchor` in the overview. The module crumb goes to its canonical first page, and a module's first page ends the trail without a repeated crumb. The authoring-status icons and "Est. N mins left" are gone. "Jump to" (`ModuleJumpMenu`) is a disclosure listing the module's lessons in an `ol`, with `aria-current`, a "Current" tag, and closing on Escape (focus returns) or an outside click. It appears at every width, for modules with more than one lesson. |
| Landmarks (G30-PAGE-11) | The page no longer renders its own `main`. The article is `#lesson-content` (`data-testid="lesson-content"`). |
| Not-found pages (G30-PAGE-04) | `src/app/not-found.tsx` covers unmatched URLs and `notFound()` outside the curriculum. It wraps itself in the learning layout, so the navbar, outline and footer stay. `src/app/(learning)/curriculum/not-found.tsx` covers lesson 404s inside the layout. `CurriculumNotFound` says "This page could not be found." (pinned by `feature-flags.spec`) and shows the requested path. It adds "Did you mean" links built from the path (`suggestLessonsForPath`; for example, `/T2_Intermediate/I-SV-1_OOP` suggests I-SV-1), the overview, the first lesson and the practice hub, and search tips. |
| Legacy redirects (G30-LINK-03..06) | In `content/curriculum/redirects.json`, every `(/:slug*)` became `/:slug*`. Every destination is now a canonical lesson URL, so legacy URLs land in one hop. Added: `F3_Procedural_Constructs/{flow-control,fork-join,tasks-functions}`, `F3A…/flow-control`, `F3C…/ipc`, `A-UVM-1…/uvm-sequence-item`, `A-UVM-2…/heartbeats` (to E-DBG-1/hang-lab) and `A-UVM-2…/uvm-callbacks` (to A-UVM-5). F3B now goes to F2D/tasks-functions. The F3C base goes to F2C, where fork/join is taught; it used to go to the F2D system-tasks page. `src/generated/curriculum-redirects.mjs` is regenerated: 34 rules, and `--check` passes. |
| Concept links (G30 request 10, G30-PATH-10) | `conceptLinking` now defaults to `false` in `lesson-frontmatter.ts`. A lesson opts in with `conceptLinking: true`, and the `remarkConceptLinks` path is unchanged behind that flag. |

## Files

- **Changed:**
  - `src/app/(learning)/curriculum/[...slug]/{page,layout}.tsx`
  - `src/components/layout/Breadcrumbs.tsx`
  - `src/generated/mdx-component-registry.tsx` (registered `BeforeYouStart`, `NextLesson`; added the `lessonSlug` binding)
  - `content/curriculum/redirects.json` and the regenerated `src/generated/curriculum-redirects.mjs`
  - `src/lib/curriculum/remark-concept-links.ts` (doc comment only)
  - `src/lib/curriculum/lesson-frontmatter.ts` (the `conceptLinking` default, which is the concept-link flag wiring)
- **New:**
  - `src/app/not-found.tsx`, `src/app/(learning)/curriculum/not-found.tsx`
  - `src/components/mdx/{BeforeYouStart,NextLesson}.tsx`
  - `src/components/curriculum/{LessonToc,LessonOrientation,LessonPager,LessonPractice,ModuleJumpMenu,CurriculumNotFound}.tsx`
  - `src/lib/curriculum/{remark-heading-ids,remark-practice-slot,lesson-urls,lesson-context,lesson-mdx}.ts`
- **Not edited (not owned):** `lesson-loader.ts` and `[...slug]/error.tsx`.

## Tests

**Vitest:** 12 files, all passing. The full suite also passes: 247 files, 2,999 tests, 4 skipped. `npx tsc --noEmit -p .` (non-incremental) exits 0, and ESLint `--max-warnings=0` on every touched file exits 0.

- **New (11):**
  - `tests/lib/remark-heading-ids.test.ts`: slugs, repeats, inline code, JSX, the expert flag and slot entries. Over all 105 lessons, ids are unique and equal the search and expert index algorithm. The `uvm-link-map` anchors resolve, apart from 2 known stale ones.
  - `tests/lib/remark-practice-slot.test.ts`: placement rules and JSX wrappers. In every lesson, practice comes before References.
  - `tests/lib/lesson-urls.test.ts`: canonical, two-segment, tier, pretty, wrong-case, extra-segment and encoded forms, plus not-found. Every lesson has one canonical URL. Suggestions.
  - `tests/lib/lesson-context.test.ts`: "Lesson k of N" against the manifest; tiers and tracks; prerequisites always point backward. For every lesson, the Next equals `findPrevNextTopics`. Boundary labels, breadcrumbs, and concept links off by default.
  - `tests/components/BeforeYouStart.test.tsx` and `tests/components/NextLesson.test.tsx`: these include no-props rendering through the registry binding. NextLesson is checked against the generated next for all 105 lessons.
  - `tests/components/LessonToc.test.tsx`
  - `tests/components/LessonOrientation.test.tsx` (it also covers `LessonPager`)
  - `tests/components/CurriculumNotFound.test.tsx`
  - `tests/components/LessonMdxPipeline.test.tsx`: the page's real `compileMDX` pipeline and bound components, rendered to HTML.
- **Rewritten (1):**
  - `tests/lib/curriculum-redirects.test.ts`. It now uses Next's own runtime matcher (`getPathMatch`, strict, case-insensitive, `modifyRouteRegex`), `prepareDestination` and `checkCustomRoutes`.
  - It covers the G30 acceptance URLs and every page that ever existed under a legacy folder (46, from `git log`).
  - It also checks that no rule captures a current lesson in any letter case.
  - It would have caught the dead `(/:slug*)` rules.
- **Updated:** `tests/components/Breadcrumbs.test.tsx`.

## E2E specs updated

All of these edits are targeted; other builders edit some of the same files.

- `navigation.spec.ts`: the breadcrumb test now checks the `ol`, `aria-current`, the tier link, that there are no status icons, and the "Jump to" disclosure (I-UVM-3B, 9 links, Escape).
- `curriculum-navigation-comprehensive.spec.ts` and `amba-curriculum.spec.ts`: breadcrumbs come from `lessonBreadcrumbs` (canonical hrefs, `aria-current` on the last crumb). "Jump to" is checked only for multi-lesson modules.
- `regression-gates.spec.ts` and `learner-flow.spec.ts`: Prev/Next use `getByRole('navigation', { name: 'Previous and next lesson' })`. `main nav` now also matches "On this page", whose "References & Next Topics" link would break strict mode.
- `f1-revamp.spec.ts`, `f2-revamp.spec.ts` and `F4_lessons.spec.ts`: `getByText` on heading text is scoped to `getByTestId('lesson-content')`, because "On this page" repeats every H2/H3.
- New: `tests/e2e/lesson-orientation.spec.ts`. It checks:
  - 308s and their Location for every URL form, plus a legacy redirect;
  - the tier URL, then F1A's Next;
  - one `main` and one `h1`;
  - "Lesson k of N" and the "Before you start" chips against the manifest;
  - the Next card against `findPrevNextTopics`;
  - that every TOC hash exists;
  - practice before References on E-PSS-1;
  - the 390 px disclosure and no sideways scroll;
  - both 404s, including one for a URL that escaped `/curriculum`.

## Deferred

| Item | Why |
|---|---|
| G30-PAGE-04: style `[...slug]/error.tsx` | Not in this role's ownership. |
| G30-PAGE-12: second H1s (`<InfoPage title>` and markdown `#`) | These are in content and in `InfoPage.tsx`, which authors and the lead own. The page chrome has one H1. |
| G30-PAGE-V01: "Page k of 8" lines; G30-LINK-01/07: relative and non-canonical links; placing `<BeforeYouStart />` and `<NextLesson />` | These are lesson edits for authors. The page now renders position, prerequisites and Next from data, and redirects every old URL form. |
| G30-PAGE-09: module stepper under the header | "Jump to" is in the breadcrumb bar at every width, and NB3's course outline covers the rest. A separate stepper would repeat both. |
| G30-OVW-08: two stale anchors in `src/components/diagrams/uvm-link-map.ts` | Not owned. They are listed as known-stale in `remark-heading-ids.test.ts`; drop the entries once the links are fixed. |
| G30-SRCH-V17: sitemap of canonical URLs | `src/app/sitemap.ts` is not in this role's places. |

## Requests for the lead

1. **HTTP-level redirects on cache hits.** Next 14.2 caches an on-demand ISR render that ends in `permanentRedirect` with status 308 but no `Location` header (`base-server.js` stores only `metadata.headers`). The first request gets a proper 308. On a later cache hit, browsers still redirect, through the RSC payload, but non-JS clients do not. For a header-level 308 every time, move the same `resolveCurriculumRequest` check into `src/middleware.ts`. Dev and e2e are unaffected.
2. **Style `[...slug]/error.tsx`.** It has no navigation; reuse the `CurriculumNotFound` look with a retry button (G30-PAGE-04).
3. **QA audit anchors.** `tests/qa/curriculumCoverageAudit.spec.ts` uses its own `slugifyHeading`, which collapses `--`. It would therefore flag correct anchors such as `#practice--reinforce`. Switch it to `createSlugger` from `src/lib/heading-slug.ts`.
4. **For information.** `LessonPractice` depends on NB4's `src/lib/practice-links.ts`, which is untracked; commit both together.
5. **Authors' standard.** Put `<BeforeYouStart />` on its own line at the end of Quick Take, and `<NextLesson />` in References & Next Topics, instead of hand-written lines. Then remove "Page k of 8" and the relative links.
6. **Tier names.** If the generator starts emitting manifest tier titles (NB3 request 3), `getTierInfo` in `lesson-context.ts` can read them from `curriculumData` instead of importing the manifest.
