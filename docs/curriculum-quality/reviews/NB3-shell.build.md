# NB3-shell build log (2026-10-04)

**Builder:** NB3-shell (navigation shell: outline, search, shortcuts, skip link, account UI, footer).
**Branch:** `curriculum-quality-program`. No git state changes, no installs, no builds.

## What changed

| Area | Result |
|---|---|
| Course outline (G30-SIDE-01, 02, 03, 08, 09, V08) | `Sidebar.tsx` now renders tiers, then modules, then lessons in manifest order. The current lesson has `aria-current="page"`, and its tier and module open by default. Each tier, and each multi-lesson module, is a disclosure button with `aria-expanded`. Electives are grouped in a dashed, labelled group ("Electives (optional: the core path skips them)"). On lesson pages at lg and wider the outline is docked outside `main` (a sticky `nav` named "Course outline"); learners can hide it, and the choice is remembered in localStorage. Below lg, and on other pages, it opens as a modal drawer: `role="dialog"`, `aria-modal`, focus moved in (to the current lesson) and returned, a Tab trap, Escape, backdrop click, and body scroll lock. The status badges, fake bookmarks and arbitrary quick link are gone. |
| Navbar (G30-SIDE-06, 08, V07, PAGE-V14) | The navbar is a `header` (banner) holding a `nav` named "Main", with `aria-current` on the active link and a `role="search"` landmark. One outline button for every width ("Course outline", `aria-expanded`/`aria-controls`, Ctrl/Cmd+B). The bell and the account menu render only when `accountUI` is on. The account menu opens on click, Enter or Space, and closes on Escape or an outside click. It shows real session data, and offers "Sign out" (wired to `useAuth().signOut`) only to a signed-in learner. The phone menu is a modal dialog. Colours are theme tokens only; the old hard-coded navy broke light mode. |
| Search (G30-SRCH-01, 02) | `scripts/generate-search-index.mjs` writes `src/generated/search-index.json`: 105 lessons and 1,184 H2/H3 headings, about 69 KiB (19 KiB gzipped; the previous run's format was 117 KiB). It holds titles, descriptions, module, tier and track; there is no body text. Anchors use `heading-slug`, and an anchor is stored only when `headingSlug(text)` cannot rebuild it. `--check` reports a stale index. The engine (`search-engine.ts`) uses tokenized prefix matching with field weights, plural stems and identifier parts (so "config db" finds `uvm_config_db`), with at most 3 results per lesson. A section must match its own heading. The UI (`SearchCombobox.tsx`) is an ARIA 1.2 combobox with a listbox; each option is a real link to the canonical lesson URL or `#anchor`. ↑/↓ move, Enter opens, and Escape closes. A status region announces the result count. The index loads on first focus as a separate chunk. From lg the navbar field is inline. Below lg, the search buttons (phone, and md to lg) open `SearchDialog.tsx`. After a dialog navigation, focus moves to the chosen heading or the new page's H1. |
| Shortcuts (G30-SRCH-04, 05, 06) | `shortcuts.ts` matches letters and digits by `event.key` when it is a plain letter or digit, and by `event.code` otherwise, so Option+1/2/3/C/T work on macOS, AZERTY and Cyrillic layouts. Ctrl/Cmd+K and "/" open search; Ctrl/Cmd+B toggles the outline; Alt/Option+1 and 2 (plus 3 and C behind their flags) go to sections; Alt/Option+T switches theme, covering only the macOS case so ThemeSwitcher never double-toggles. "[" and "]" move to the previous and next lesson (same rule as the Prev/Next links). "t" jumps into the lesson's "On this page" list. "?" opens an accessible help dialog: one table per group with a caption, `kbd` keys with spoken names, and only the shortcuts that work under the current flags. A footer button also opens it. Single-key and Alt shortcuts pause while typing. |
| Skip link (G30-PAGE-V18) | `SkipLink` is the first focusable element. It moves focus to the page's H1 (on a lesson, the start of the lesson body), else to `main#main-content`. Without JavaScript it is a plain `#main-content` link. `MainLayout` keeps exactly one `main`, and the outline stays outside it, so `main nav` selectors still find the lesson pager. |
| Footer and legal pages (G30-SIDE-07, V06) | The footer has a "Site map" `nav`: the curriculum overview, one "Start Tier N" link per tier (to its first lesson), the practice hub, exercises, the keyboard shortcuts button, Privacy and Terms. The Privacy and Terms pages keep the public layout, because the landing page must stay chrome-free. Each page now renders a header with a home link and "Back to the curriculum", one `main`, and the footer, plus page `metadata`. |

**Files** (owned): `src/components/layout/{Sidebar,MainLayout,KeyboardShortcuts}.tsx`, `src/components/{Navbar,Footer}.tsx`, `src/app/(learning)/layout.tsx`, `src/app/(public)/{privacy-policy,terms-of-service}/page.tsx`. `src/app/(public)/layout.tsx` is unchanged.

**New files:**
- `scripts/generate-search-index.mjs` and `src/generated/search-index.json`;
- under `src/components/search/`:
  - `search-engine.ts`, `load-search-index.ts`, `SearchCombobox.tsx`, `SearchDialog.tsx`;
  - `shortcuts.ts`, `ShortcutsHelpDialog.tsx`, `ShortcutsHelpButton.tsx`, `platform.ts`;
  - `course-outline.ts`, `shell-store.ts`, `useModalDialog.ts`, `focus-target.ts`, `SkipLink.tsx`.

The outline, dialog and focus helpers sit under `search/` only because that is the new-file location this role owns.

## Tests

Vitest, 210 tests, all passing:

| File | Tests | What it covers |
|---|---:|---|
| `tests/search/search-engine.test.ts` | 19 | Index is 105 lessons in manifest order; titles and descriptions match `curriculumData`; tracks; canonical URLs; no body text. Ranking: "mailbox", "WSTRB", "uvm_config_db", "config_db", "config db", codes, plurals, stop words. Deep links. |
| `tests/search/search-index-anchors.test.ts` | 105 | Runs the lesson page's `remarkHeadingIds` over every lesson and requires the index's heading texts and anchors to equal its TOC ids. |
| `tests/search/shortcuts.test.ts` | 15 | macOS Option keys; Windows, AZERTY and Cyrillic layouts; AltGr; browser shortcuts left alone; the typing guard; theme and flag routing; help covers every shortcut. |
| `tests/search/SearchCombobox.test.tsx` | 12 | Combobox and listbox ARIA, arrow keys, Enter, Escape twice, no results, modified clicks; the search dialog's focus and Escape; `focusAfterNavigation`. |
| `tests/components/Sidebar.test.tsx` | 18 | Rewritten. The outline equals the manifest (4 tiers, 69 modules, every lesson); electives grouped; current lesson, module and tier; URL forms. Docked nav: keyboard and collapse, no status badges, hide and remember. Drawer: dialog, focus in and back, backdrop, Tab trap, scroll lock. |
| `tests/components/KeyboardShortcuts.test.tsx` | 17 | Real keydown events: Option+1/2, flags, Ctrl/Cmd+B, Ctrl/Cmd+K (field or dialog), the typing guard, repeat, `[`/`]`, `t`, Option+T, route-change close, and the help dialog. |
| `tests/components/Navbar.test.tsx` | 10 | Landmarks, `aria-current`, accountUI off hides everything; account menu on click, Escape and Sign out; notifications; outline button; phone search; phone menu dialog. |
| `tests/components/MainLayout.test.tsx` | 5 | The skip link is first and lands on the H1 (or `main`); one `main` with the outline outside it; footer site map and tier links resolve. |
| `tests/app/legal-pages.test.tsx` | 6 | Privacy and Terms each have a back link, one `main` with its H1, and the footer site map. |

## E2E specs updated

- `tests/e2e/navigation.spec.ts`:
  - The "Quick Access" toggles become the course outline drawer: button, Ctrl/Cmd+B and Escape.
  - The account and notification tests are gated on `accountUI` and use click.
  - New tests: search then Enter (G30 acceptance); Alt+Digit1/2; "?" help; account UI hidden by default.
  - New lesson-shell tests at 1280 px: the docked outline does not overlap `main`, hides and comes back; the skip link; `[`/`]`; `t`; a WSTRB deep link.
  - Specs wait on `html[data-shortcuts-ready]`, which `KeyboardShortcuts` sets once it is live.
  - Another builder has since added its breadcrumb test to this file.
- `tests/e2e/mobile-navigation.spec.ts`:
  - New outline names.
  - The drawer on a lesson lists I-SV-5's lessons and closes from the backdrop.
  - The search button opens the dialog; typing then Enter navigates.
  - The navbar, footer and dialogs fit in 390 px.
- `tests/e2e/f2-revamp.spec.ts`: the F2C and F2D chapter links are scoped to `#main-content`. Otherwise `.first()` would match the docked outline's copy of the link and stop testing the spine-pinned in-content link.
- `tests/e2e/curriculum-navigation-comprehensive.spec.ts`: the all-links check requests each unique target once and reports every source page. Before, the outline's links on every page would have meant about 12,000 GETs. Another builder has also edited the breadcrumb part.

## Deferred

| ID | Why |
|---|---|
| G30-SIDE-04 (module practice links in the outline) | Removed the arbitrary quick link. The module's labs, exercises and visualizers are in the lesson's practice block (`LessonPractice`, owned by the lesson-page builder). The drawer links the practice hub and the overview. |
| G30-SIDE-05 (Start here, Interview prep in the primary nav) | Those surfaces (route chooser, `/interview-prep`) are being built in this wave by other builders. Adding a link now risks a dead end; it is a one-line `navLinks` change once they are final. |
| G30-SRCH-01 (labs, exercises, glossary in the index) | The brief limits the index to lessons and headings. There is no glossary yet (G30.verify gap 5). Practice items can be added from the lab registry and practice map later. |
| G30-SRCH-03 / OVW-05 (overview search) | The overview page is another builder's file. `loadSearchDocuments()` and `searchCurriculum()` are ready to reuse. |
| G30-SRCH-V17 (sitemap.xml) | Out of this role's files. |

## Requests for the lead

1. **Wire the index.**
   - `package.json`: `"generate:curriculum": "ts-node --project tsconfig.scripts.json scripts/generate-curriculum-data.ts && node scripts/generate-search-index.mjs"`.
   - Add `node scripts/generate-search-index.mjs --check` to `validate:content` or CI, and commit `src/generated/search-index.json`.
   - When lesson headings change, `tests/search/search-index-anchors.test.ts` fails until the index is regenerated.
2. **Remove dead code:** `src/hooks/useKeyboardShortcuts.ts` and the sidebar state in `src/contexts/NavigationContext.tsx`. They have no callers now; the shell uses `src/components/search/shell-store.ts`. These files are outside my ownership.
3. **Tier names:** emit the manifest tier `title` and `audience` from `scripts/generate-curriculum-data.ts`, so breadcrumbs, the lesson header, the outline and the footer share one tier name (G30-OVW-10). `course-outline.ts` and `Footer.tsx` import the manifest JSON directly until then.
4. **ThemeSwitcher:** drop its own Alt+T listener. It compares `event.key`, so it is dead on macOS and fires while typing. Then remove the `themeShortcutHandledByThemeSwitcher` guard in `KeyboardShortcuts.tsx`.
5. **Primary nav:** add "Start here" and "Interview prep" to `navLinks` in `Navbar.tsx` once those routes are final (G30-SIDE-05).
6. **For information:**
   - `tests/components/Breadcrumbs.test.tsx` fails against the in-progress Breadcrumbs rewrite.
   - `tests/qa/curriculumCoverageAudit.spec.ts` flags `/curriculum/expert-index` in the new `tests/e2e/curriculum-overview.spec.ts`.
   - Both belong to other builders.
7. **Optional:** move the non-search shell modules (`course-outline`, `shell-store`, `useModalDialog`, `focus-target`, `SkipLink`) to `src/components/shell/`.
