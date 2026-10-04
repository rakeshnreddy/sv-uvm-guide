# NB3 shell: review, round 1 (2026-10-04)

**Reviewer:** NB3 reviewer (read-only). **Branch:** `curriculum-quality-program`. **Build log:** [`NB3-shell.build.md`](NB3-shell.build.md).

**Verdict: pass.** There are no S1 or S2 findings, and validation is green. There are 4 S3 findings:

- 3 are for the builder;
- 1 is an e2e collision between NB3's footer and another builder's spec. The lead routes it, and it does not count against this build.

There are 7 S4 findings.

## Validation (run by the reviewer)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0, no output. The earlier `practice/lab/[labId]/page.tsx` failure is gone. |
| `npx eslint --max-warnings=0` on every owned source file, `src/components/search/`, `scripts/generate-search-index.mjs`, the 9 unit spec files and the 4 updated e2e specs | exit 0 |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run` on the builder's 9 spec files | 9 files pass: 207 tests pass (19 + 105 + 15 + 12 + 18 + 17 + 10 + 5 + 6). No other unit test imports these files. |
| Full `npx vitest run` | 247 of 247 files pass: 2,999 tests pass and 4 are skipped |
| `node scripts/generate-search-index.mjs --check` | "Search index is up to date (105 lessons, 1184 headings)". There are no MDX parse warnings. |
| `npx playwright test --list` on the 4 updated e2e specs | collects 27 tests. Not run, because this role may not start a server. |
| Hard-coded colours in the new UI (hex, `rgba(`, palette utilities, `--blueprint`) | none |

## What I checked

**1. Correctness against G30 and the brief.** I read the diff of every owned file and every new file in full.

*Outline (G30-SIDE-01, 02, 03, 08, 09, V08).*
- `buildCourseOutline` walks `curriculumData` in manifest order.
- The test compares against `curriculum.manifest.json` itself, so a sorted or filtered outline fails it. It covers 4 tiers, 69 modules, every lesson and the tier titles.
- Electives are maximal runs, and their label is true. `findPrevNextTopics` skips electives from a core lesson, which matches "(optional: the core path skips them)". There is one group at the end of T2 (I-SV-8) and one at the end of T4 (5 modules).
- I checked these edge cases:
  - A module index is current: the module link carries `aria-current="page"`.
  - A sub-lesson is current: its module opens.
  - Pretty and two-segment URLs: these are marked through `normalizeSlug`, and the page also redirects them.
  - Non-lesson pages: `/curriculum`, `/curriculum/expert-index`, `/curriculum/does-not-exist` and URLs with extra segments return `null`.
- Status badges, fake bookmarks and the arbitrary quick link are gone.
- The outline is docked outside `main` on lesson pages at lg and wider. That meets the G30-SIDE-01 acceptance ("on a lesson at 1280 px"). Other pages open it as a drawer, which is a defensible reading of the brief.

*Drawer.*
- It has `role="dialog"`, `aria-modal`, and a name from its h2.
- Focus moves to the current lesson, else to Close, and returns to the opener. The Tab trap skips collapsed (`hidden`) panels.
- Escape, the backdrop and Close all close it, and the body scroll lock is restored.
- After a navigation started from the drawer, focus moves to the new H1.
- Growing the window past lg on a lesson page hands over to the docked column.

*Search (G30-SRCH-01, 02).*
- The index has 105 lessons and 1,184 headings in 70 KB, with no body text.
- Anchors match `remarkHeadingIds` for all 105 lessons. The practice slot inserts no markdown headings, so the page's ids equal the test's ids.
- The JSON loads as a separate chunk on first focus.
- The script imports only declared dependencies (`gray-matter`, `remark-*`, `unified`, `typescript`), and `heading-slug.ts` has no imports, so the `data:` URL load is safe.
- The acceptance queries pass: "mailbox" ranks I-SV-5/mailboxes first, and "WSTRB" and "uvm_config_db" rank their lessons in the top 3. I also ran 60 other queries, with the results in S3-4.
- Results are real links to canonical URLs, with `#anchor` for sections.
- The combobox follows ARIA 1.2: `aria-activedescendant`, a listbox with options, a status region, an IME guard, and modified clicks left alone.
- No lesson heading sits inside collapsible JSX, so no deep link lands on hidden content.

*Shortcuts (G30-SRCH-04, 05, 06).*
- `baseKey` falls back to `event.code`, so Option+1/2/3/C/T fire on macOS. AZERTY, Cyrillic and AltGr are handled.
- Ctrl or Cmd alone with another key is left to the browser.
- `[` and `]` use `findPrevNextTopics`, as `LessonPager` does. They do nothing on the first and last lesson and off lesson pages, and leave the key alone there.
- `t` opens the "On this page" disclosure below xl before it focuses the list.
- The help dialog shows only the shortcuts that work under the current flags. It has captions, sr-only table headers and spoken key names.
- No other `src` key handler uses `[`, `]`, `t`, `/` or `?`.

*Skip link (G30-PAGE-V18).*
- It is the first focusable element and lands on the H1 inside `main#main-content`. On a lesson, that is the orientation header just before the body. On a page with no H1 it falls back to `main`.
- Without JavaScript it is a plain `#main-content` link.

*Navbar (G30-SIDE-06, 08, V07, PAGE-V14).*
- The navbar is a `header` banner, with `nav` "Main", `role="search"` "Curriculum" and `aria-current` on the active link.
- One outline button carries `aria-expanded` and `aria-controls`.
- Account UI and the bell render only when `accountUI` is on. `fetch` is not called when it is off.
- The account menu opens on click, Enter or Space and closes on Escape with focus returned. Sign out is wired to `useAuth().signOut`.
- Dialogs sit outside the `backdrop-filter` header, so `position: fixed` is not trapped by it.

*Footer and legal pages (G30-SIDE-07, V06).*
- Every footer link resolves.
- Privacy and Terms each have a home link, "Back to the curriculum", one `main` and the site map, and they leave out the shortcuts button.
- The `(public)` layout is unchanged.

*Deferrals.* I accept G30-SIDE-04, SIDE-05, the SRCH-01 extension, SRCH-03/OVW-05 and SRCH-V17 as reasoned. None of them was in the brief's six items. SIDE-05 is a one-line `navLinks` change now that `/interview-prep` and the route chooser exist; the lead decides when.

**2. Accessibility and UX.**
- Landmarks: banner, "Main", search "Curriculum", "Course outline" (docked, outside `main`), one `main`, and contentinfo with "Site map". Every one is named.
- Current state is never shown by colour alone:
  - the current lesson has `aria-current="page"`, a 4 px left border and semibold text;
  - the active search option has `aria-selected` and a left border;
  - result kinds are text badges.
- Contrast: I computed the token pairs in all 10 theme blocks. The lowest is muted-foreground on the footer's `muted/40` tint, at 5.62:1 (violet-light). All pass AA.
- Reduced motion:
  - the drawer's framer-motion slide is under `MotionConfig reducedMotion="user"` (ClientProviders);
  - every transition class has `motion-reduce:transition-none`.
- Layout at 390 px:
  - the header row needs about 300 px;
  - the drawer is `min(22rem, 88vw)`;
  - the dialogs use `w-full` with `px-4`;
  - long titles use `min-w-0 break-words`.

  I found no overflow risk with the default flags. At lg with every flag on, see S4-6.
- Touch targets are mostly 40 px or more. S4-4 lists the ones that are not.

**3. Pinned behaviour (spine §3.5 and `tests/e2e`).**
- These still hold:
  - `navigation.spec.ts:3-10` (arbitration → libraries) selects the pager by name;
  - `main nav a[...]` (amba-curriculum, comprehensive) still finds the pager, because the outline is outside `main`;
  - `header h1` (learner-flow, regression-gates) matches only the lesson header, because the navbar header has no H1;
  - `curriculum-integrity` crawls `/curriculum`, which has no docked outline;
  - `theming` still finds "Toggle theme".
- The f2-revamp, mobile, navigation and comprehensive edits are needed. The all-links crawl now requests each target once.
- Two e2e problems remain: S3-1 (NB3's own spec) and S3-2 (another builder's spec, broken by NB3's footer link).

**4. Tests.** The tests would fail on the defects they target:
- the outline is checked against the manifest JSON;
- the drawer test checks focus in and back, the trap and the scroll lock;
- the shortcut tests use real `KeyboardEvent`s with the macOS `key`/`code` pairs, so a `key`-only match fails them;
- the ranking tests use the G30 acceptance queries;
- the anchors test runs the page plugin over every lesson.

Gaps are S4-3 and S4-5.

## Findings

| ID | Sev | Location | Problem | Fix |
|---|---|---|---|---|
| S3-1 | S3 | `tests/e2e/mobile-navigation.spec.ts:86-87` (drawer motion: `src/components/layout/Sidebar.tsx:337-339`) | The 390 px fit check measures the outline drawer right after the click. The drawer then still slides in from `x: -100%` over 200 ms. `getBoundingClientRect()` includes the transform, so `box.left >= -1` is false. `playwright.config.ts` does not emulate reduced motion, so this assertion fails, or at best flakes. | Wait for the slide to finish before measuring. Either use `await expect.poll(() => fits('[role="dialog"]')).toBe(true)`, or call `await page.emulateMedia({ reducedMotion: 'reduce' })` at the start of the test. |
| S3-2 | S3 (cross-builder; for the lead) | `tests/e2e/lesson-orientation.spec.ts:141`; NB3's `src/components/Footer.tsx:34-36`; `src/components/curriculum/CurriculumNotFound.tsx:71-72` | On `/curriculum/does-not-exist`, the footer's new "Curriculum overview" link and the not-found page's link share a name. The unscoped `page.getByRole('link', { name: 'Curriculum overview' })` resolves to 2 elements, so Playwright fails in strict mode. The spec was written after the footer link, and builders do not run e2e, so neither side saw it. | Scope the assertion to the page body: `page.getByRole('main').getByRole('link', { name: 'Curriculum overview' })`. NB3 may apply this under the "update the spec you break" rule; then add it to `e2eSpecsUpdated`. |
| S3-3 | S3 | `src/components/search/shortcuts.ts:92-102`; `src/components/layout/KeyboardShortcuts.tsx:104-110` | `?`, `/`, `[`, `]` and `t` are single-character shortcuts that work everywhere on the page. There is no way to turn them off or remap them. That fails WCAG 2.1.4 Character Key Shortcuts (Level A). The typing guard covers fields only. A speech-input user who dictates outside a field, or a learner with a tremor, can leave the lesson with `]` or move focus with `t` or `/`. | Add a "Single-key shortcuts" on/off switch to the help dialog, remembered per browser in `localStorage` (wrapped in try/catch) and read by `KeyboardShortcuts`. Alternatively, move the lesson keys to Alt/Option+`[`/`]`. Add a test: with the switch off, `]` does nothing and Ctrl/Cmd+K still works. |
| S3-4 | S3 | `src/components/search/search-engine.ts:254-260` (`stems`), `:351-356` (per-lesson cap) | Stemming works in one direction only, and the per-lesson cap can drop the lesson itself:<br>- "property" gives 0 results, although "properties" is indexed (I-SV-4A/immediate-vs-concurrent, I-SV-4B/local-variables, B-AMBA-F1).<br>- "nonblocking" gives 0, although F2C and F3C have "Non-Blocking" and "non-blocking".<br>- "phase" never lists the I-UVM-1C lesson. "phase" does not match "Phasing", and three I-UVM-1C sections fill `MAX_RESULTS_PER_LESSON` before the lesson entry (score 5.25). The top hits are A-UVM-6, E-CUST-1 and E-UVM-ML-1 sections. | Normalise index and query tokens with the same light stemmer: -ies → -y, -es/-s, and -ing/-ed with the trailing e restored. Also index hyphenated compounds joined ("non-blocking" → "nonblocking"). Keep a lesson's own entry outside the per-lesson cap, or cap sections at 2 plus the lesson. Add ranking tests for "property", "nonblocking" and "phase" (I-UVM-1C in the top 3). |
| S4-1 | S4 | `src/components/search/SearchCombobox.tsx:266-270` | The no-results state is a sentence with no way forward. Because the index holds no body text, which the brief requires, core terms such as "always_ff" and "type_id::create" return nothing. | Under the message, add "Search covers lesson titles, descriptions and section headings", plus a "Browse the curriculum" link, as the error state already does. |
| S4-2 | S4 | `tests/e2e/f2-revamp.spec.ts:12`, `:68` | Scoping to `#main-content` keeps the outline's copy out of the match. But for F2C, `.first()` can still be satisfied by the pager card "Next lesson Procedural Flow Control", so the spine-pinned in-content link (§3.5, F2C and F2D rows) is no longer pinned on its own. | Scope both locators to `page.getByTestId('lesson-content')`. |
| S4-3 | S4 | `tests/search/search-index-anchors.test.ts:34` | The test runs `remarkHeadingIds` alone, not the page's `lessonRemarkPlugins`. A future plugin that runs before it and changes headings would pass this test while the ids drift. | Build the processor from `lessonRemarkPlugins({ toc, hasFlashcards: false })`. Before comparing, filter out the practice-slot entries (`reinforce-the-essentials`, `hands-on-practice`, `teach-it-back`). |
| S4-4 | S4 | `src/components/layout/Sidebar.tsx:363-376`; `src/components/Footer.tsx:8-9`; `src/components/search/ShortcutsHelpButton.tsx:21` | Some touch targets are under the 40 px rule in visual-language §7:<br>- the drawer's "Curriculum overview" and "Practice hub" links are about 20 px tall;<br>- the footer site-map links are about 24 px (`py-0.5`);<br>- the footer's "Keyboard shortcuts" button is about 28 px.<br>All are used on phones. | Add `inline-flex min-h-10 items-center` to these links and the button. |
| S4-5 | S4 | `src/components/search/shell-store.ts:104-109`; `src/components/layout/Sidebar.tsx:428` | The server snapshot ignores the remembered "hide outline" choice. So a learner who hid the docked outline still gets it in the server HTML on every lesson, and it disappears after hydration. That is a flash and a layout shift at lg and wider. No test covers it. | Before paint, set a `data-outline-collapsed` attribute on `<html>` with a tiny inline script that reads `localStorage` (wrapped in try/catch). Hide `#course-outline-docked` with CSS while the attribute is set, or keep the choice in a cookie that the layout reads. |
| S4-6 | S4 | `src/components/Navbar.tsx:345-390` | With every flag on, as the e2e server runs, the row holds 4 links, the theme select and toggle, the bell and the account button. At 1024 px that leaves the inline search field about 70 px wide, though the popup still opens at 20 rem. With the default flags the field is about 350 px. | From lg to xl, move the flagged links (Dashboard, Community) into the account menu, or give the search area `min-w-[14rem]` and let the nav wrap or collapse. |
| S4-7 | S4 | `docs/curriculum-quality/reviews/NB3-shell.build.md:30` | The log says "Vitest, 210 tests". The 9 files run 207. | Correct the count. |

## Notes for the lead (not findings)

- **Lead requests 1 to 5 in the build log stand.** Wiring `generate-search-index.mjs` into `generate:curriculum`, and `--check` into CI, matters. Until then, every heading edit by a phase-4 author fails `tests/search/search-index-anchors.test.ts` for that lesson.
- **Nested `main` elsewhere.** `dashboard/DashboardPageClient.tsx:50` and `community/CommunityPageClient.tsx:49` still render a `<main>` inside the layout's `main`. These pages are behind flags and are not NB3's files.
- **Client bundle.** `course-outline.ts` pulls the whole 26 KB manifest (about 2.9 KB gzipped) into the client to read 3 tier fields. Lead request 3 removes this once the generator emits tier titles. The old Sidebar's `@dnd-kit` imports are gone, so the outline should still be a net bundle saving. Confirm with `npm run bundle:check`.
