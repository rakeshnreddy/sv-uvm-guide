# Site design refresh: review and plan

Date: 2026-11-10. Status: proposed, waiting for the owner's decisions. Nothing in the site has been changed, and `TASKS.md` is untouched.

## What was reviewed

- The live site at commit `32fd8c64`: 21 pages at desktop (1440 px), tablet (820 px) and phone (390 px) widths, in the default dark and light themes, plus four other themes on the home page and one lesson. 207 screenshots and a metrics record per page load.
- Six review lenses, each checked by a second reviewer who tried to refute every finding, then a gap check across all of them: landing page, navigation, theme and tokens, page layout, responsive behaviour and accessibility, and overall design quality.
- The unslop skill, audit and direction steps only, on five screen groups: landing page, app shell and curriculum index, lesson page, practice pages, and dashboard and reference pages.
- Result: 111 verified findings (8 at P1, 58 at P2, 45 at P3) and 70 unslop signs. Reviewers dropped 3 findings and 18 signs as false, duplicate or a matter of taste.

The full findings, with evidence, file paths and the tests each fix must update, are in `findings/`. `capture.cjs` regenerates the screenshots (`node docs/planning/site-design-refresh-2026-11-10/capture.cjs <out dir>` from the repo root).

## Verdict

The content and the wayfinding inside the app are strong. What holds the site back is the visual layer, and the causes are few and shared:

1. **One display font sets every word.** Cal Sans, a single-weight display face, renders all text, including lesson prose that takes 60 to 130 minutes to read and labels as small as 9 px. Headings are synthetic bold. Four lenses found this independently.
2. **The colour tokens work against the content.** In the default dark theme, mint is the body text colour, the heading colour and the accent. Cards sit darker than the page. The default light theme is cream with crimson, so the two modes look like different products. Eight further themes change only four or five variables.
3. **There is no shared page frame.** Each page type has its own width (768 to 1280 px), header pattern and title size (20 to 56 px). Twenty routes use a template with 56 px titles and 108 to 127 character lines.
4. **The landing page describes the product and never shows it.** It has no header, search or theme control, some of its claims are false, its sections are sent at zero opacity until JavaScript runs, and it repeats the route chooser that `/curriculum` already has.
5. **Navigation has gaps.** Five reference pages are reachable only from the footer, a tier has no page and three different destinations, search finds lessons only, and phones have no theme control.

Because the causes are shared, most of the improvement comes from changing tokens and a small set of layout primitives, not from editing a hundred pages one at a time.

All five unslop screen groups were rated heavy. The dashboard and reference pages are clean in layout and copy, and are rated heavy only because they render through the same token layer.

## Defects that should not wait

| Defect | Evidence | Finding |
|---|---|---|
| The live site intermittently answers 503 with Cloudflare error 1102 (Worker exceeded resource limits) | 4 of 50 sequential requests failed in the lead's own probe, including the home page; a reviewer saw 9 of 45. `wrangler.jsonc` sets no limits. | navigation-1 |
| The lab code editor collapses to 5 px tall below 1024 px wide, so labs cannot be used on phones or tablets | Reproduced with Playwright at 390, 820 and 1023 px | responsive-a11y-1 |
| The landing page makes false or contradictory claims: "Reusable playbooks" is not a feature, "every concept" has a lab when there are 30 labs for 112 lessons, and "Open-Source" sits beside "All rights reserved" on an MIT-licensed repo | `HeroSection.tsx`, `Footer.tsx:125` | landing-2 |
| Error text in the dark themes is unreadable: 1.46:1 on the lab console's failure output | Contrast computed from `globals.css` | theme-2 |
| Without JavaScript the landing page shows only its footer, and the headline paints about 0.75 s late with it | 15 elements are served with inline `opacity:0` | landing-1 |

## Direction

The design critic and the unslop audit were run separately and reached the same direction. In the unslop skill's five lines:

- **Product.** A free, long-form SystemVerilog, UVM and AMBA verification course: 112 lessons in four tiers with interactives, labs and interview prep, for engineers from their first testbench to staff-level interviews, with progress kept in the learner's own browser.
- **Character.** Exact, patient, quietly technical.
- **World.** A verification engineer's bench during a regression run: a waveform viewer with named signals and a time cursor, the simulator log, the standard open in a second window.
- **Moments.** The interactives and diagrams inside lessons and practice pages keep their full semantic colour and become the only rich colour on those screens. On the landing page, one real frame of the scheduler model.
- **Signature.** The signal-name tag: every module code, milestone and lesson reference (F1A, I-UVM-1C, M3) set as one small monospace label, like the signal names in a waveform viewer. It already half-exists in the course outline.

What this means in practice:

- **Quiet chrome.** Near-neutral surfaces, near-white text in dark mode, one accent colour used for the primary action, the current item and focus. No gradient buttons, glass panels or colour washes.
- **One brand in two modes.** Light and dark share structure, type and accent hue.
- **A face made for reading.** A text family for interface and prose, JetBrains Mono for code and tags.
- **Semantic colour is protected.** Signal states, pass and fail, regions and phases inside the interactives keep their colours.

The alternative the reviewers considered, a light-first "annotated spec" look with a serif and a crimson accent, was rejected: crimson collides with the fail colour in almost every interactive.

## Decisions for the owner

| # | Decision | Recommendation | Alternative |
|---|---|---|---|
| 1 | Adopt the "verification bench" direction | Yes | Keep navy and mint and fix only the defects |
| 2 | Text typeface | IBM Plex Sans 400 and 500 with JetBrains Mono; retire Cal Sans. It suits the direction and avoids the look of every Inter-based template. It needs the font files added to the repo (free, OFL). | Inter, which is already in the repo but also needs a 500 weight or variable file added. The gap check preferred this as the lower-risk choice. Either way the family becomes one line of config once font roles exist. |
| 3 | Number of themes | Two modes, Light and Dark, plus "System". Stored values such as `ocean-dark` map to the matching mode. One identity, and far less to verify across about 118 interactives. | Keep the ten theme ids as accent-only swaps on shared surfaces, chosen in Settings only |
| 4 | Product name | "SV/UVM Hub" everywhere. The wordmark and the tests already use it. | "SV/UVM Mastery", which page titles use today |
| 5 | Licence wording | The repo has an MIT `LICENSE`, so replace "All rights reserved" with "MIT licensed" and a source link, and keep a truthful "open source" line | If the site should not be presented as open source, remove that claim instead |
| 6 | The 503 errors | Check the Workers plan and CPU or memory use in the Cloudflare dashboard, or give this session `wrangler` access to read the logs | None; it needs the owner's Cloudflare account |
| 7 | Landing page primary action | "Start lesson 1", which becomes "Continue: <lesson>" for a returning learner, with "Find your level" as the secondary | Keep "Find your level" as the primary |

Dark surface colour is a smaller call the token owner will settle with the contrast script: the reviewers split between a navy-tinted slate (closest to today) and a near-neutral blue-black (the unslop "ink" ramp). The recommendation is the near-neutral blue-black, with code panels as the deepest surface.

## Plan

Each phase ends in one checkpoint release, after before-and-after screenshots have been reviewed. Finding ids are given so an implementer can open the evidence.

### Phase 0: fix what is broken

No design decision needed, apart from decision 5 for the licence wording.

1. Diagnose the 1102 errors (CPU or memory, plan limits, Worker start-up size), fix, and add a sitemap probe to the release checks. Needs decision 6. (navigation-1)
2. Give the lab editor a real height below 1024 px, with a Playwright check at 390 and 820. (responsive-a11y-1)
3. Correct the landing claims and take the lab count from the registry. (landing-2)
4. Add a readable danger-text token for dark themes and fix the light destructive pair. (theme-2)
5. Render the landing sections visible without JavaScript: remove the zero-opacity entrances, the rotating tagline, the dynamic-import wrappers and the "Loading Section..." placeholder, and make the hero background full width. (landing-1, landing-9, landing-16, landing-17, design-critic-4, design-critic-10)
6. Small accessibility fixes: the search dialog's focus trap, 16 px inputs on phones, the 404 title, small tap targets in lesson visuals, focusable scroll regions for code and tables. (responsive-a11y-2, -5, -8, -13, -v1)
7. Phone menu: add Appearance, Settings and Course outline rows. (navigation-6, responsive-a11y-3, -14)

### Phase 1: type and colour foundation

Every page changes, so this phase starts and ends with a full screenshot sweep in both modes.

1. Font roles: a text family (decision 2) and JetBrains Mono; Cal Sans leaves body text. A named type scale with a 12 px floor, a codemod for about 700 labels set at 8.5 to 11 px, and the shared uppercase eyebrow style changed to sentence case. (theme-1, theme-12, layout-3, design-critic-1, landing-13)
2. Colour roles: near-white text, one accent, surfaces that step up from the page in dark mode, input borders at 3:1, status roles (success, warning, info, danger), radius, elevation and focus-ring scales, forced-colours borders. Delete the unused blueprint tokens, the glass and gradient utilities and `src/components/Card.tsx`. (theme-3, -4, -5, -13, -15, -17, layout-7, layout-10, design-critic-2, landing-11, gap-6)
3. Theme set and mechanics (decision 3): dark variants keyed on `data-theme` so nothing flashes before hydration, `color-scheme` set, the device preference followed on a first visit with dark as the fallback, print styles, and one theme menu button used in the navbar, the phone menu and the landing header. (theme-6, -7, -8, -9, -16, -v1, design-critic-3, -18, responsive-a11y-7, -10, -v2)
4. Lesson prose mapped to the tokens. (theme-10)
5. A contrast test in CI that reads `globals.css` and checks every text pair for 4.5:1 and every input border for 3:1.
6. The Monaco editor and WaveDrom panels moved onto the code-surface token. (design-critic-13, gap-3)

### Phase 2: navigation

1. One navigation config and one site name in `src/lib/site-links.ts`, read by the navbar, phone menu, sidebar, footer, breadcrumbs and page titles. (navigation-7, -12, design-critic-14, landing-8)
2. Top navigation: Curriculum; Practice (Hub, Labs, Exercises, Interactive models, Waveform Studio); Interview prep; Reference (Knowledge hub, Resources, Projects, Learning strategies, History); Dashboard. "Start here" is removed. The docked outline loses its repeated links. (navigation-5, -8, -11, layout-15, design-critic-19)
3. A public header on the landing and legal pages: skip link, wordmark, the first three navigation items, search, the theme control and "Start learning" or "Continue". (landing-7, landing-14, navigation-2, design-critic-5, responsive-a11y-9)
4. Hierarchy and redirects: tier URLs go to the tier's section of `/curriculum`, tier labels agree everywhere, `/exercises`, `/labs` and the bare practice parents redirect to the hub section, and `/community/test-page` is removed. (navigation-3, -9)
5. Search covers labs, exercises, tools, interview banks and reference pages, each with a kind label. (navigation-4, responsive-a11y-6)
6. One breadcrumb component on every page below the top level, a previous/next pager on practice pages, and a regrouped footer. (navigation-10, -13, -14, layout-12, design-critic-16)
7. The header aligned with the page columns. (gap-4)

### Phase 3: page structure

Two releases: the primitives and the lesson page first, then the other pages.

1. Layout primitives: `PageShell` (three widths), `PageHeader`, `Prose` (68 characters per line, figures at full width), `Card` and `Badge` variants, and `SignalTag` for every module code and milestone. (layout-1, layout-8, design-critic-8)
2. The lesson page: prose on the page instead of in a card, breadcrumb and header unboxed, layer headings clearly stronger than section headings, a table of contents that follows the reader and collapses by layer, one sticky "On this page" bar with reading progress below 1280 px, an error boundary and a shaped placeholder for each interactive. (layout-4, -5, -6, -11, -14, design-critic-9, navigation-v1, responsive-a11y-4, gap-2, gap-5)
3. Code blocks: build-time syntax highlighting with the packages already installed, a language label, a copy button, and a collapse for listings over about 40 lines (one listing is 775 lines today). (theme-11, gap-1)
4. The shared info-page template rebuilt on the primitives, which fixes 20 routes. (layout-2)
5. The other pages moved onto the primitives: learner area, practice hub, lab header, interview prep (jump links and a level filter for its 166 questions), knowledge hub, resources, history, placement quiz, 404, and the curriculum index with its module list higher up. (layout-9, layout-13, layout-v1)
6. `docs/topic-template.mdx` rewritten to match the real lesson shape. (layout-16)

### Phase 4: landing page

1. The public header from phase 2.
2. A split hero: a headline that names SystemVerilog, UVM and AMBA, one factual subhead, a primary and a secondary action (decision 7), and on the right a server-rendered static frame of the scheduler model, generated from the same data as the live interactive and linking to it.
3. A proof strip generated from data: lessons, tiers, labs, interactives, the standards the lessons cite, and "free, no sign-up, progress stays in this browser".
4. One real interactive, mounted lazily below the fold.
5. Four "what you can do" cards with real thumbnails and specific link text.
6. The three routes as a compact strip with one action each and a link to compare them on `/curriculum`.
7. One content width for every section and the footer; a real description, social image and icon in the metadata; no animation library on the page.

Findings: all of theme 4 in `findings/critic.json`. The page's JavaScript should shrink, which the bundle check in CI will confirm.

### Phase 5: polish and guardrails

1. Icons, radius, motion and label case brought to one standard: one icon set at one size, radius by element size, one easing curve, no hover lifts, sentence case in the chrome.
2. The "Hall of Shame" visuals in F1A rebuilt on tokens, without glow effects or titles baked into images.
3. A scripted sweep of all interactives in light and dark, which this review did not cover, fixing chrome that carries its own hue and leaving semantic colour alone.
4. Guardrails: an audit script that fails when hard-coded colours or ad-hoc cards increase, and a screenshot baseline for eight key pages in both modes at two widths.

## What stays

The reviewers named these as strengths that any redesign must keep:

- The lesson orientation block, the course outline with module codes, the previous/next pager and the 404 page's recovery links.
- The four-layer lesson model and the table of contents grouped by layer.
- `VisualFrame` and the fidelity labels on every lesson visual, and the visual-language colour encodings.
- The route data generated from the curriculum, and the concrete, honest copy in the app.
- The accessibility of the shell: skip link, named landmarks, focus rings, focus traps in the phone menu and outline drawer, reduced-motion support, no sideways scroll at any width.
- JetBrains Mono with ligatures off, so `<=` and `===` read exactly.

## Not planned

- **Renaming the four lesson layers to sentence case** ("Quick Take" to "Quick take"). The unslop rules suggest it, but the names are product vocabulary, appear in 112 lessons and are pinned by more than ten test files.
- **Removing "Correct!" from quiz feedback.** It is pinned by several end-to-end tests for little gain. It can join phase 5 if wanted.
- **Generated hero imagery.** The hero is built in code from the site's own model.
- **Merging the phone's outline and menu into one drawer.** Both dialogs work today; a labelled button and a menu row fix discoverability at much lower risk.
- **Tier landing pages.** Tier URLs redirect to the curriculum section for now, with a temporary redirect so a tier page can be added later.

## How the work would run

- Fable plans each phase, writes the briefs, reviews the screenshots at each gate and decides the release. Opus agents build and review. Sonnet agents do mechanical steps such as codemods, redirects and test-text updates.
- Each work package: an Opus builder in a worktree cut from `main`, the local gates (type check, lint, unit tests, targeted Playwright), an Opus reviewer for accessibility and contrast and one for regressions against the "what stays" list, then a screenshot capture of the branch preview with `capture.cjs`.
- Tests that pin current text or selectors are updated in the same change, never deleted; each finding lists them.
- Releases go through `checkpoint-release.sh` as before, one per phase (two for phase 3).

Estimated cost, from the per-agent costs measured in the curriculum programme (these are estimates, not measurements): about 30 to 40 million worker tokens in total, roughly 12 to 16 % of a weekly limit. The review itself used 3.3 million.

## What the review did not cover

- Each of the roughly 118 interactives in both modes (planned as phase 5, item 3).
- Viewports wider than 1920 px; the 2560 px run hit the 1102 error.
- The notebook and review pages with real learner data in them.
- Switching theme while an interactive is mounted.
- Real screen-reader testing.
- The `/community` and `/notifications` routes, which are not in the sitemap.
