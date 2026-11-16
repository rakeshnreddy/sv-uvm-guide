# Design contract: the verification bench

This is the single source for every design decision in the refresh. Builders implement from it and reviewers check against it. If something here conflicts with a finding's suggested fix, this document wins. Owner decisions taken on 2026-11-10: the bench direction, IBM Plex Sans, two modes (Light, Dark, System), the name "SV/UVM Hub", MIT licence wording, and "Start lesson 1 / Continue" as the landing primary action.

## 1. What the site should feel like

- **Product.** A free, long-form SystemVerilog, UVM and AMBA verification course for engineers from their first testbench to staff-level interviews, with progress kept in the learner's own browser.
- **Character.** Exact, patient, quietly technical.
- **World.** A verification engineer's bench during a regression run: a waveform viewer with named signals, the simulator log, the standard open beside it.
- **Moments.** The interactives and diagrams carry the rich colour. Around them, colour says where you are in the course (section 11) and glass marks the layers that float above the page; the reading surface itself stays quiet.
- **Signature.** The signal tag (section 8).

Three goals rank above everything else, in this order: the lesson is comfortable to read for an hour; a learner always knows where they are and what comes next; coming back to the site shows them their progress and their next step at once.

## 2. Colour roles

Two modes, one brand. Values are HSL triplets for the existing `hsl(var(--x))` pattern. A builder may move a lightness by up to 3 points to meet the contrast targets, and must report the final ratios.

| Role (CSS variable) | Dark | Light | Use |
|---|---|---|---|
| `--background` | `222 26% 7%` | `220 20% 98%` | page |
| `--card`, `--popover` | `222 22% 10%` | `0 0% 100%` | cards, menus, dialogs; always one step above the page in dark |
| `--muted`, `--secondary`, `--accent` | `221 18% 14%` | `220 16% 95%` | raised surface: hover, active row, chips, inputs |
| `--border` | `220 14% 20%` | `220 14% 89%` | hairlines and dividers |
| `--input` | `220 9% 46%` | `220 9% 54%` | control boundaries, at least 3:1 against the surface |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `220 20% 93%` | `222 30% 12%` | primary text, headings |
| `--muted-foreground` | `220 10% 68%` | `220 10% 36%` | secondary text |
| `--subtle-foreground` (new) | `220 8% 62%` | `220 8% 39%` | meta and captions only; at least 4.5:1 on every surface it sits on. Phase 4 (colour and glass) moved it from 56%/43% so it holds 4.5:1 over the stronger colour field and the glass on it, beyond the 3-point allowance; recorded for the lead |
| `--primary`, `--ring` | `197 85% 59%` | `200 88% 31%` (darkened from 33% on 2026-11-11 so accent text holds 4.5:1 over the strongest part of the light colour field) | the one accent: primary action fill, links, current-item marker, focus |
| `--primary-foreground` | `222 40% 8%` | `0 0% 100%` | text on the accent |
| `--success` | `152 50% 58%` | `152 65% 28%` | pass, done, progress |
| `--warning` | `38 90% 62%` | `32 90% 32%` | caution |
| `--danger-text` | `0 91% 71%` | `0 72% 45%` | error text |
| `--destructive` / `--destructive-foreground` | `0 62% 45%` / white | `0 72% 45%` / white | destructive fills |
| `--info` | same as primary | same as primary | notes |
| `--code-surface` (new) | `226 40% 5%` | `226 40% 5%` | code blocks, editors, traces: always dark, the deepest surface |
| `--code-foreground`, `--code-muted`, `--code-border` (new) | `220 20% 93%`, `220 10% 68%`, `220 14% 20%` | same as dark | chrome that sits on the code surface (file names, copy buttons, hairlines); never slate classes or arbitrary `hsl()` there |

Each status role also gets a `-subtle` background: the role colour at 12% opacity over the surface.

Rules:

1. Headings and body text use `text-foreground`. A heading is never set in the accent or a status colour.
2. The accent marks what is clickable or current. One filled accent button per view; every other button is the secondary style (raised surface, hairline border, primary text).
3. A current or selected item is a raised surface with a 2 px accent marker on its leading edge and primary text. This is the same in the outline, the menus, the table of contents and tabs.
4. Colour and glass follow section 11 (owner decision, 2026-11-10), which replaces the earlier ban on gradients and glass in the chrome. Still banned everywhere: gradient text, glass on glass, glow halos around single elements, coloured shadows, and any glass or gradient under lesson running text or code. Dark mode depth comes from the surface steps, hairlines and the glass tokens. Use `shadow-card` where a shadow class is needed, never `shadow-lg`, `shadow-xl` or `shadow-2xl` in the chrome.
5. Mint is retired from the chrome. Progress and "done" use `--success`.
6. Text contrast is at least 4.5:1, large text and control boundaries at least 3:1, in both modes. A unit test enforces this from `globals.css`.

## 3. What is protected

- The visual-language encodings in `src/components/visual-system/visual-language.ts` and `docs/visual-learning/visual-language.md` do not change: slate for 0, cyan for 1, rose for X, amber for Z and testbench, violet for design, emerald and rose for match and mismatch, and the rest. Every encoding keeps its non-colour cue.
- Code panels stay dark in both modes.
- The four lesson layers keep their names: Quick Take, Build Your Mental Model, Make It Work, Push Further.
- Everything in the "What stays" section of `PLAN.md`.

The chrome accent is in the same family as the cyan "active" encoding on purpose: in the interactives and in the chrome, that colour means "this is the live one".

## 4. Type

Families:

- **Text and interface:** IBM Plex Sans, weights 400, 400 italic, 500 and 600, self-hosted with `next/font/local` as the Inter and JetBrains Mono files are today (the `@fontsource/ibm-plex-sans` woff2 files, latin subset, plus latin-ext if the lessons use those characters). Fallback stack: `system-ui, sans-serif`.
- **Code, signal tags, counts, keycaps:** JetBrains Mono, ligatures off, as today.
- Cal Sans and Inter are removed, with their font files.

Weights: 400 for text, 500 for labels and controls, 600 for headings up to 24 px and for `strong`. Type of 28 px and larger is set at 500. Nothing renders at 700 or above in the sans face: map Tailwind's `bold` to 600 so the existing `font-bold` classes cannot produce synthetic bold.

Scale (size / line height in px):

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | clamp 40 to 60 / 1.05 | 500 | -0.025em | landing headline only |
| `h1` | 32/40, 28/36 on phones | 500 | -0.015em | page title, one per page |
| `h2` | 24/32 | 600 | -0.01em | section |
| `h3` | 19/28 | 600 | 0 | subsection |
| `h4` | 16/24 | 600 | 0 | minor heading |
| `lead` | 18/28 | 400 | 0 | one-paragraph page intro, secondary colour |
| `body` | 17/29, 16/27 on phones | 400 | 0 | lesson prose, about 65 characters per line on average and never more than 75 (a 31em measure in lessons) |
| `ui` | 14/20 | 400 or 500 | 0 | interface text |
| `label` | 12/16 | 500 | 0 | labels, eyebrows, meta |
| `code` | 13.5/22 | 400 | 0 | code blocks |

Rules:

1. No visible text below 12 px in the shell, cards and page chrome. Micro labels inside interactives are handled in the phase 5 sweep, one component at a time, because they sit in tight layouts.
2. Labels are sentence case with no added tracking. No uppercase tracked eyebrows in the chrome. Module codes and acronyms are naturally uppercase and stay so.
3. Tight tracking only on type of 24 px and larger.
4. Numbers that change or line up use tabular figures.

## 5. Shape, space and width

- Radius by size: tags 4, controls and rows 8, cards 12, panels and dialogs 16. An inner radius is the outer radius minus the padding between them, never less than 4. Pills only for true toggles and chips that the visual language defines as round.
- Borders are 1 px hairlines in `--border`; a bare `border` class draws one. Form field boundaries use `--input` (`border-input`), never the hairline.
- Spacing on a 4 px scale. Cards pad 20 to 24, compact panels 16, page gutters 16 on phones, 24 on tablets, 32 on desktop.
- Three page widths: reading 768 px, content 1152 px, wide 1280 px. A page uses one.
- Controls are 40 px tall, 44 px for primary actions on phones.

## 6. Motion

- One easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`. Hover and press 150 ms, menus and popovers 200 ms, drawers 300 ms.
- Hover is a colour or surface change. No lift, scale-up or glow. Press may scale to 0.98.
- No entrance animation that hides content until JavaScript runs. No scroll-triggered reveals. Nothing loops.
- Instructional motion inside interactives follows the visual-language document and is not part of this contract.
- Everything respects `prefers-reduced-motion`.

## 7. Theme mechanics

- The `data-theme` attribute takes two values, `light` and `dark`. Tailwind's dark variant keys on `[data-theme="dark"]`, so dark styles apply before hydration and no client effect adds a class.
- `next-themes` runs with `enableSystem`, default `system`, and falls back to dark when the device states no preference. (Browser limitation: Chromium reports no preference as light, so in that case the page and the system choice resolve to light. The CSS default on :root is dark, which holds wherever the browser does not match prefers-color-scheme: light.) Old stored values (`default-dark`, `ocean-light` and the other eight) keep working: they map to the matching mode through the provider's value map, and learner-data backups that contain an old id import cleanly.
- `color-scheme` is set per mode, and the viewport exports a `themeColor` per mode.
- Print uses the light values, hides the navbar, outline, table of contents and footer, and prints code with a light background.
- One theme control everywhere: a menu button with Light, Dark and System as radio items, 40 px target, used in the navbar, the phone menu and the public header. The palette picker is removed from Settings.

## 8. The signal tag

Every module code, milestone id and lesson reference (F1A, I-UVM-1C, M3, B-AXI-1) renders as one component, `SignalTag`: JetBrains Mono 12/16, weight 500, secondary text colour, radius 4, 1 px hairline border, 2 px by 6 px padding, no background in lists and a raised background when it stands alone. When it links somewhere it shows the accent on hover and focus only. It is used in the course outline, breadcrumbs, lesson header, "Before you start", "Builds toward", module cards, practice cards and search results, so the same code looks the same everywhere, like signal names down the left of a waveform viewer.

## 9. Copy

- Sentence case for headings, buttons and labels, apart from the four lesson layer names and proper nouns.
- Say what the thing does in the product's own nouns. No hype words, no exclamation marks in the chrome, no claim that cannot be checked against the repo.
- Counts come from data, never from hand-typed numbers.
- A button names its destination ("Open the UVM phase map"), not a generic action.

- Sentence case is for interface text: labels, buttons, headings the site writes, and the names of the site's own tools and destinations wherever they appear, including inside lesson prose ("Waveform studio", "Practice hub"). The titles of course content (lessons, modules, labs and question banks) are titles and keep the case their authors gave them.

## 10. Coming back

These carry the "return again and again" goal and are built in phases 3 and 4:

- **Continue.** Wherever a learner lands (landing page, curriculum, dashboard), the first action is "Continue: <lesson>" once the browser holds a position.
- **Next step at the end of every lesson.** The pager names the next lesson and the lab or review that reinforces this one.
- **Progress as a trace.** Progress through a tier is drawn as a signal trace: one segment per module, high when the module is done. It appears on the dashboard and, in miniature, in the curriculum index.
- **Reviews due.** When flashcards are due, the dashboard and the landing header say how many, with one action to start.

## 11. Colour and glass

Owner decision on 2026-11-10, after phases 0 to 2 were live: the neutral chrome read as "just black and white". The owner asked for a liquid glass feel, glass panels, gradient colours and accents, approved the sketch of this section, and asked for the same treatment in light mode (paler there). One sentence holds the whole rule: **glass on the layers that float, colour fields behind page tops, solid surfaces for reading.**

### Tier colours

Each tier has one colour, the way a waveform viewer colours each signal group. Tokens `--tier-1` to `--tier-4`; each also has `-subtle` (the colour at 14% over the surface) and `-border` (the colour at 38%).

| Tier | Dark | Light | Name |
|---|---|---|---|
| 1 Foundations | `172 66% 50%` | `172 80% 22%` | teal |
| 2 Intermediate | `222 100% 74%` | `222 75% 42%` | blue |
| 3 Advanced | `260 100% 79%` | `262 60% 46%` | violet |
| 4 Expert | `36 90% 63%` | `30 92% 29%` | amber |

- A builder may move lightness by up to 4 points so that each colour, used as text, holds 4.5:1 on the page, on the card surface and on its own subtle fill. A unit test enforces it. As built, light tier 1 is `172 80% 22%` and light tier 4 is `30 92% 29%` (moved from 24% and 32%).
- The tier of a module code comes from the curriculum data (one shared lookup), never from the code's prefix. Milestone ids (M0 to M8) and codes with no tier stay neutral.
- Where it shows: every signal tag (tier-coloured text, subtle fill, tinted border); tier headings on the curriculum page and in the course outline (a small step mark in the tier colour); a 2 px top edge on cards that belong to one tier (the tier colour fading to transparent); on a lesson page the header's tags and the first 48 px of each layer band's rule; progress traces.
- Tier colour always travels with the tier's name or the module code, so it is never the only cue. The sky accent keeps its meaning: clickable or current. Headings and body text stay neutral.

### Colour field

A static, decorative layer behind the top of a page (`aria-hidden`, no pointer events, no animation, no JavaScript): three or four soft radial gradients in the tier colours, masked so it has fully faded by the end of its height.

- Strength: 0.34 to 0.55 alpha per gradient in dark mode, 0.14 to 0.24 in light mode.
- The field does not paint the text-safe tier colours. It has its own tokens, `--field-1` to `--field-4` with `--field-1-alpha` to `--field-4-alpha`: deeper tier hues (dark `172 100% 20%`, `222 90% 37%`, `262 80% 43%`, `32 100% 26%` at 0.48 to 0.5; light `172 70% 42%`, `222 90% 60%`, `262 80% 64%`, `34 92% 52%` at 0.22 to 0.24), so subtle text still holds 4.5:1 over the strongest stop.
- Variants: `all` (landing, curriculum, practice, lab, dashboard, reference and info pages: all four tier colours in fixed positions) and `tier` (lesson pages: that tier's colour leads and its neighbour is faint). Lab pages use the `all` field.
- Height: up to 820 px on hub pages. On lesson pages it is 24rem tall (solid to 66%, then masked to nothing), with the tier's colour centred at 26% across and 58% down (below the header bar, around the title and lead) holding near full strength over the left ~60% of the width and the neighbouring tier at half strength centred at 86% across, so it has fully faded before the first paragraph of the article (a lesson header ends about 26rem to 42rem down).
- Text over the field (page titles, leads, meta) must hold 4.5:1 against the worst-case blend; the unit test composites the strongest gradient stop over the page colour and checks primary, secondary and subtle text.

### Glass

Tokens `--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-shadow`, `--glass-blur`; one utility (`glass`) and one quieter variant without blur (`glass-quiet`).

| Token | Dark | Light |
|---|---|---|
| `--glass-bg` | `222 22% 12% / 0.42` | `0 0% 100% / 0.62` |
| `--glass-border` | `0 0% 100% / 0.12` | `220 14% 70% / 0.35` |
| `--glass-highlight` (inset top edge) | `0 0% 100% / 0.14` | `0 0% 100% / 0.7` |
| `--glass-shadow` | `0 12px 40px rgb(0 0 0 / 0.28)` | `0 8px 30px rgb(16 24 40 / 0.08)` |
| `--glass-blur` | `blur(22px) saturate(170%)` | `blur(22px) saturate(150%)` |

- **Real glass (with backdrop blur)** is for layers that float above content: the header bar, menus and popovers (Practice, Reference, theme, Jump to, search results), dialogs and sheets (search, shortcuts help, the lesson contents sheet, the phone menu and the outline drawer), the sticky "On this page" bar, and at most one card that overlaps a colour field at the top of a hub page (as built, only the landing hero card; route cards, landing highlights, learning-path cards and practice cards are quiet glass), so the three-layer limit holds.
- **Quiet glass (no blur)** is for cards further down hub pages: the translucent fill, the hairline and the top highlight, with no backdrop filter.
- **Never glass:** lesson running text, code blocks and editors, quiz and exercise controls and form fields. Section 12 says which lesson panels take quiet glass (the contents panel, the docked outline, callouts, figure frames, table wrappers). No glass on glass: a glass card never sits inside a glass panel.
- At most three blurred layers are visible at once (header, one menu or dialog, one sticky bar). No `will-change`. The field and the glass must not cause layout shift.
- Fallbacks: without `backdrop-filter` support, with `prefers-reduced-transparency: reduce` and in forced colours, glass becomes the solid card surface with its hairline.
- The header stays 64 px tall (56 px for the public header on phones) and keeps its alignment with the page columns; the glass bar is a rounded background layer (radius 16) inside that height, not a layout wrapper. Content scrolling under it is what shows the glass.
- Text on glass holds 4.5:1 against the worst case (the glass fill over the strongest field colour); the unit test checks it. Text on glass uses the foreground or secondary colour, never the subtle one.
- Chrome glass that can float over the code surface (header bar, menus, popovers, dialogs, sheets, contents bar) uses white at 82% in light mode instead of 62% (`CHROME_GLASS_LIGHT_ALPHA` in `src/components/layout/nav-styles.ts`), so secondary text holds 4.5:1 over code blocks scrolling under it; hub cards keep 62%.

### Gradient accents

Allowed: the reading progress line (tier colour into the accent), progress traces, the 2 px top edge of tier cards, and a vertical sheen on the one primary button (the accent 6 points lighter at the top, 6 darker at the bottom, with an inset highlight; in light mode the top is 4 points lighter so white text holds 4.5:1). Not allowed: gradient text, gradient borders around whole cards, animated gradients.

### Light mode

The same structure, paler: field alphas from the light column, white glass at 62% with the softer shadow, tier colours from the light column. Chrome glass that can float over the code surface (header bar, menus, popovers, dialogs, sheets, contents bar) uses white at 82% in light mode instead of 62%, so secondary text holds 4.5:1 over code blocks scrolling under it; hub cards keep 62%. Both modes are checked at every release.

## 12. Lesson text and glass panels in lessons

Owner decision on 2026-11-11. The owner's words: lesson text was "full of white text on black background and the other way round"; they asked for colour that keeps the text reliable and loses no content, "readable first and then introduce colors", with text colour (not only bold) to tell headings and sub-sections from content. They approved the sketch of this section ("ok looks good") and added: "also have glass panels where feasible to have the liquid glass look". This section adds to section 11 and replaces rule 1 of section 2 inside lesson articles.

### Two guards that come before any colour

- **No lesson content changes.** This is styling plus build-time tagging. A check compares the rendered text of every lesson before and after and fails on any difference.
- **Readable first.** Body text holds at least 10:1 against the page in both modes; every other text colour holds at least 4.5:1 on the surface it sits on, including the quiet glass fill. A unit test enforces both. Colour is never the only cue: size, weight and position still mark the structure.

### The hierarchy

All tier colours below mean the lesson's own tier (`--tier-current`), so a Tier 1 lesson reads teal, Tier 2 blue, Tier 3 violet and Tier 4 amber.

| Element | Treatment |
|---|---|
| Body text | neutral and slightly softer than the heading white: the foreground mixed 88% with the secondary colour (`--prose-body`); 17/29, weight 400 |
| Bold terms | the full foreground at weight 600: they stand out by brightness, not hue |
| Layer headings (h2) | the tier colour, 28/36 at weight 500, on the existing band rule with its 48 px tier segment |
| Section headings (h3) | the tier colour mixed 55% into the foreground, 19/28 at weight 600 |
| Sub-section headings (h4 and below) | the foreground at weight 600, neutral |
| Lead-in labels | a bold label that opens a list item or paragraph and ends in a colon ("What it is:") takes the tier colour mixed 78% into the foreground; tagged at build time, never by editing the lesson |
| List markers | bullets and numerals in the tier colour; numerals in the mono face |
| Inline code | a chip: mono at weight 500 in the foreground colour on a faint fill with a hairline, radius 5; not bold. Code inside a link keeps the link colour. Code blocks are unchanged |
| Links | the accent, underlined |
| Tables | header row with a 10% tier fill, tier-mixed text and a tier-tinted rule; first column in the foreground at weight 500 |
| Callouts | colour-coded by kind with a 2 px leading edge, a label in the role colour and a 10% fill: note or info is the accent, tip is success, pitfall or warning is the warning colour, danger is the danger colour, and standard or reference is the new `--reference` role (violet: `268 85% 78%` dark, `262 55% 46%` light). An unknown kind is a note |
| "Expert" tag | an outlined tag in the tier 4 colour |
| Blockquotes | a 2 px tier rule and the body colour |
| Captions | the subtle colour |

### Glass panels in lessons

Running paragraphs and lists stay directly on the page, and code blocks and editors stay on the solid code surface. Around them, panels take the liquid glass look where it is feasible:

- **Real glass (with blur):** the lesson header block (breadcrumb, tags, title, lead, meta, "Before you start"), because the tier field is behind it. With the header bar and the sticky contents bar that is still at most three blurred layers.
- **Quiet glass (no blur; translucent fill, bright top edge, a faint sheen, radius 16):** the "On this page" panel, the docked course outline (drawn as a background layer so its box, and the header alignment the tests measure, do not change), callouts (with their role tint), figure and interactive frames, table wrappers, and the "Next" block at the end.
- **Never:** paragraphs and lists, code blocks and editors, quiz and exercise controls and form fields inside interactives.

Section 11's fallbacks apply: without backdrop-filter support, with reduced transparency and in forced colours, panels become solid.

## 13. Figures

Owner request on 2026-11-15: many graphs, block diagrams and illustrations were "bland with no color just black and white"; they asked for colour that aids understanding, modern and clear, "functional and aesthetic", working in both modes, without losing functionality. An audit found the cause: the shared diagram kit (`src/components/mdx/DiagramKit.tsx` over `BlockDiagram`, `CycleWaveform` and `SequenceDiagram`, about 1,120 figures across the 112 lessons) drew almost everything in neutrals, and the 313 hand-drawn SVG figures used literal `rgb()` colours that did not adapt to the mode and fell below 3:1 on the light page. This section is the rule for both. It changes the kit and shared CSS only; no lesson is edited.

### Two guards that come before any colour

- **Meaning does not change.** The encodings of section 3 stay as they are: slate for 0, cyan for 1 and active, rose for X, error and mismatch, amber for Z and testbench, violet for design, indigo for multi-bit values, teal for expected, emerald for match. Only their values per mode change. Every glyph, tag, hatch, dash and label stays, so colour is never the only cue. A caption or sentence that names a colour ("the cyan band", "red notes", "amber badges", "green box") stays true of the rendered figure.
- **Geometry and text do not change.** Node sizes, label positions, edge routes and label chips are those `diagram-layout.ts` measures; the layout tests pass unchanged. Arrowheads keep the stroke widths the geometry measures (data 1.8, causal and control 1.5).

### Figure colour roles

One role per meaning, each with a stroke (lines, outlines and filled marks), a text value and a soft fill (a lighter base with its own alpha, so tints stay clean instead of muddy). Tokens `--fig-<hue>`, `--fig-<hue>-text` and `--fig-<hue>-fill`, exposed to Tailwind as `stroke-fig-cyan`, `fill-fig-cyan-text`, `fill-fig-cyan-fill` and so on.

| Role | Meaning | Dark stroke / text / fill | Light stroke / text / fill |
|---|---|---|---|
| `slate` | logic 0 | `215 16% 58%` / `214 32% 84%` / `215 20% 65% / 0.12` | `215 19% 42%` / `215 25% 30%` / `215 16% 47% / 0.1` |
| `cyan` | logic 1, active, the attempt band | `188 86% 50%` / `186 90% 72%` / `188 86% 53% / 0.15` | `192 91% 34%` / `194 85% 26%` / `188 86% 53% / 0.15` |
| `rose` | X, error, mismatch, the fail band | `350 89% 64%` / `352 96% 80%` / `350 89% 60% / 0.16` | `347 77% 47%` / `345 82% 38%` / `350 89% 60% / 0.11` |
| `amber` | Z, testbench, control lines that touch a testbench node, badges | `38 92% 52%` / `43 96% 70%` / `38 92% 50% / 0.12` | `30 92% 36%` / `26 90% 30%` / `38 92% 50% / 0.15` |
| `violet` | design | `258 90% 72%` / `255 95% 84%` / `258 90% 66% / 0.18` | `262 70% 55%` / `263 70% 44%` / `258 90% 66% / 0.12` |
| `indigo` | multi-bit values, data flow, interfaces | `234 89% 72%` / `230 94% 84%` / `234 89% 74% / 0.16` | `239 70% 56%` / `243 60% 44%` / `239 84% 67% / 0.12` |
| `teal` | expected, register model | `172 66% 46%` / `170 76% 68%` / `172 66% 50% / 0.15` | `175 84% 28%` / `176 80% 24%` / `173 80% 40% / 0.13` |
| `emerald` | match, ok, the pass band | `158 64% 48%` / `156 72% 70%` / `158 64% 52% / 0.15` | `161 94% 28%` / `163 88% 23%` / `160 84% 39% / 0.13` |

Contrast, as built (the lowest over the page, the card, and the quiet glass frame with its sheen over each; `tests/app/theme-contrast.test.ts` enforces 3:1 for strokes and 4.5:1 for text):

| Role | Dark: stroke / text / text on its fill / tag on its chip | Light: stroke / text / text on its fill / tag on its chip |
|---|---|---|
| `slate` | 4.95 / 10.61 / 8.64 / 7.05 | 5.44 / 8.69 / 7.72 / 6.90 |
| `cyan` | 8.50 / 11.34 / 8.27 / 6.06 | 4.03 / 6.72 / 6.10 / 5.64 |
| `rose` | 4.75 / 7.87 / 6.69 / 5.58 | 4.95 / 6.69 / 5.80 / 5.10 |
| `amber` | 7.63 / 11.01 / 8.87 / 7.09 | 4.58 / 6.63 / 5.94 / 5.42 |
| `violet` | 4.87 / 8.22 / 6.74 / 5.57 | 5.78 / 8.18 / 7.06 / 6.17 |
| `indigo` | 4.89 / 8.68 / 6.75 / 5.31 | 6.53 / 9.22 / 7.97 / 6.96 |
| `teal` | 7.15 / 11.01 / 8.08 / 5.95 | 4.39 / 5.80 / 5.17 / 4.67 |
| `emerald` | 7.42 / 10.79 / 7.96 / 5.90 | 4.14 / 5.95 / 5.27 / 4.74 |

The light strokes replace values that were below 3:1 on the light page (cyan-500 2.3, amber-500 2.1, slate-400 2.5, emerald-500 2.4, indigo-400 2.9). The test also keeps each hue in its family, checks primary and secondary text on every soft fill, the step badges, and the neutral tint below. Sky, the "blue band" of captions, stays the accent family (`--info`), apart from cyan.

### Architecture diagrams (`BlockDiagram`)

| Element | Treatment |
|---|---|
| Node | soft fill, a 1.5 px stroke and a tag chip, all in the node's role |
| Design (`dut`) | violet, square corners (radius 3), `DUT` chip |
| Testbench (`test env agent sequencer driver monitor scoreboard subscriber predictor model fifo sequence`) | amber, rounded (radius 14, the most the tag chip allows), its tag on the chip. `fifo` is side-overridable: an RTL FIFO or buffer with `role: "design"` draws as design and keeps its FIFO chip (see "Assigning roles in lessons") |
| Interface (`interface`) | indigo, radius 8, `IF` chip: the pins it carries are multi-bit values |
| Register model (`reg`) | teal, radius 8, `REG` chip: the testbench's expected copy of the registers (the mirror). `reg` is side-overridable: a hardware register with `role: "design"` draws as design and keeps its REG chip |
| No role (`generic` with no `role`) | neutral: the secondary colour as the stroke (it carried 20% of the tier colour before section 14, which removed it because every tier hue sits on a role hue), the tier at 4.5% as the fill, no chip. It carries no meaning, so it never reads as a role or state (section 14, "Parts with no role") |
| State | active cyan, error rose, ok emerald, dim at half opacity: the state wins over the role (fill, stroke and chip); active and error strokes are 2.2 px. Ok and error also carry a shape: a ✓ or ✕ in the card colour on a 6.5 px disc of the state colour at the node's top-right corner (kept inside the drawing), because emerald and rose are close under deuteranopia |
| Container | the role colour as a faint tint (4 to 5%) and a dashed 1.5 px border; its tag on a chip before the name. A container inside another container has no fill, only the dashed role border and chip, so nested tints (TEST, ENV, AGT) do not stack into one wash |
| Badge (top right) | amber text, as before ("the amber badges" in E-SOC-1) |
| Tag chip | JetBrains Mono 9 px at 600 on the role's soft fill laid over the node's fill, radius 3; the tag text in the role's text colour |
| Edges | data indigo, solid, filled head; control dotted with an open head, amber where either end is a testbench node (get_next_item, start, grab) and the strong neutral (foreground at 75%) elsewhere, so a decoder's selects between design blocks never read as testbench traffic; causal (call order) the strong neutral (foreground at 75%), dashed, open head; structural the secondary neutral, plain, 1.5 px. Active cyan, error rose, dim faint, whatever the style. Each arrowhead takes its line's colour |
| Edge label | a chip on a solid card surface, with the edge colour's soft fill and a hairline in the edge colour, the label in the edge's text colour |
| Numbered step | a label that starts "N. " (a node label or an edge label) shows its number on a filled pill badge, as in sequence diagrams: the strong neutral (foreground at 80%) with the digits in the page colour on a node, the edge's text colour with the digits in the card colour on an edge label. The text stays exactly as written: the digits are drawn over the badge and the "." is transparent, so widths and the layout tests do not change. The badge is placed from the 0.6 em mono advance (6.9 px for 11.5 px node labels, 6 px for 10 px edge labels) |
| Ports | the UVM symbols in the strong neutral on the card surface; an error port rose, an active port cyan; the imp ● stays solid |
| Selection and focus | one neutral ring: 2 px in the foreground colour, 4 px outside the node, with a 2 px card-coloured gap inside it, so it can never be taken for the active cyan or any state colour; no stroke colour change. Forced colours: the ring takes `Highlight` and the gap `Canvas` |
| Legend | the kit's own key, so every colour that a role sets, and every term in a shown legend, can be looked up, and no term mislabels: each term that appears in the figure, with its swatch drawn beside it: the role swatch (its shape and colour), the port symbol, or a line sample with the edge's dash, colour and arrowhead (control shows the amber sample, the neutral one, or both, as the figure draws it). Order: roles, ports, lines. The role terms are plain words true of every part they cover: "design" and "testbench" (not "design (DUT)": a `dut` node already carries its DUT tag, and a role-coloured bus block is not the DUT), listed when any part is drawn in that role, whether from its kind or from a `role`; "interface" and "register model" for the tagged kinds. A part whose side was overridden counts under the role it is drawn in only. A part drawn in a state (active, error, ok, dim) adds no role term, since the state's look replaces its role colour. A term that does not appear is never listed; nodes with no role add no term. Where no full legend shows (`legend={false}`, or an architecture figure with no lines or ports) and in every `<SequenceDiagram>`, the kit still draws the role terms alone (`roleKeyEntries`) whenever a part takes its colour from a `role` (a generic part with a role, or a side-overridable kind moved to the other side), so every role colour drawn can be looked up; `legend={false}` hides the lines and ports, and the role terms too unless a part takes its colour from a role. A figure with no full legend whose role colours all come from tagged kinds draws no such key: its tags name each part's kind, and the colours' meanings are those of the visual language. The ASCII line glyphs ("── data flow →") gave way to the drawn swatches, so the terms are now plain words ("data flow") |

### Timing diagrams (`CycleWaveform`, `StepWaveform`)

- A one-bit trace is slate where low and cyan where high, with the cyan soft fill under the high level; each edge takes the new level's colour. 2 px. The high fill is left out where a cyan (attempt) band or the `StepWaveform` cursor already tints the column, so the two cyans never stack into what reads as a second band.
- A clock is the secondary neutral at 80%, 1.5 px, with no fill, so data stands out. `StepWaveform` treats a row named `clk`, `clock` or ending in `_clk` as a clock.
- A bus is an indigo outline with the indigo soft fill, the crossing where the value changes, and the value in the indigo text colour (mono, weight 500).
- X stays the rose hatch (rose stripes on the rose soft fill); Z stays the amber dash.
- Markers keep their glyphs and tones in the text colours (pass emerald ✓, fail rose ✕, vacuous slate ○, pending and drive amber, sample violet ▼, info sky ●). Highlight bands keep their hues, as the soft fills with a hairline in the same colour: attempt cyan, fail rose, pass emerald, info sky. The cursor is the cyan stroke.
- Signal names sit in a label column on a faint panel (foreground at 3.5%, radius 6), with hairline rules between rows, like a waveform viewer. The names keep their positions.

### Sequence diagrams (`SequenceDiagram`)

- Participant headers take their role like architecture nodes (soft fill, stroke, tag chip, corner radius up to 12) on a solid card surface; lifelines are the role colour at half strength, dashed, 1.5 px (the hairline for no role).
- A numbered message shows its number on a filled pill badge (the strong neutral; cyan or rose for an active or error message) with the digits in the page colour. The "N. " stays in the text, so the text reads as before: the digits are drawn over the badge and the ". " is transparent. The badge is placed from the 0.6 em mono advance the layout already measures.
- Arrows keep their tones (neutral, active cyan, error rose), each with a matching arrowhead.
- Notes move off amber, which means testbench and Z: a neutral raised surface (`--muted`) on the card, a hairline, and a 3 px leading edge in the lesson's tier colour. A note with `tone: "error"` is rose and `tone: "active"` cyan, so "the red notes" in captions (I-UVM-3B, A-UVM-4B, I-SV-3A) now are red; before, every note was drawn amber.
- The kit draws no activation bars, so there is nothing to fill.

### Hand-drawn SVG figures

The lessons' own SVG figures give colours as literal attributes. Without editing a lesson, `globals.css` maps each literal to the figure token of the same hue, scoped to `[data-lesson-article] svg` (CSS beats presentation attributes): strokes and filled marks take the stroke value, text takes the text value, and sky takes `--info`. Translucent `rgba()` tints (78 distinct values, 348 figure uses) are left as they are: a tint composites over either mode and carries no contrast duty. 144 of the 313 figures carry at least one remapped literal; the other 92 use Tailwind colour classes or translucent tints, which already adapt.

**Not covered: monochrome figures.** Some hand-drawn figures draw only in `currentColor` (no literal, no colour class). CSS cannot tell what such a line means, so they stay black and white until a lesson pass marks their parts with `data-fig` (see "Assigning roles in lessons" below for the roles and the rules). The list of figures still to mark is not kept here, because it goes out of date as lessons change: run `python3 docs/curriculum-quality/workflows/figure-scan.py --work-only` and work from its output. On 2026-11-15 it found 81 monochrome figures in 34 lessons.

| Literal | Was | Now | Figures | Uses |
|---|---|---|---|---|
| `stroke="rgb(6,182,212)"` | cyan-500 | `hsl(var(--fig-cyan))` | 86 | 251 |
| `stroke="rgb(245,158,11)"` | amber-500 | `hsl(var(--fig-amber))` | 54 | 104 |
| `stroke="rgb(244,63,94)"` | rose-500 | `hsl(var(--fig-rose))` | 43 | 105 |
| `stroke="rgb(139,92,246)"` | violet-500 | `hsl(var(--fig-violet))` | 36 | 67 |
| `stroke="rgb(16,185,129)"` | emerald-500 | `hsl(var(--fig-emerald))` | 27 | 41 |
| `stroke="rgb(99,102,241)"` | indigo-500 | `hsl(var(--fig-indigo))` | 25 | 66 |
| `stroke="rgb(8,145,178)"` | cyan-600 | `hsl(var(--fig-cyan))` | 25 | 194 |
| `stroke="rgb(100,116,139)"` | slate-500 | `hsl(var(--fig-slate))` | 14 | 45 |
| `stroke="rgb(225,29,72)"` | rose-600 | `hsl(var(--fig-rose))` | 12 | 66 |
| `fill="rgb(8,145,178)" on shapes` | cyan-600 | `hsl(var(--fig-cyan))` | 11 | 11 |
| `stroke="rgb(14,165,233)"` | sky-500 | `hsl(var(--info))` | 8 | 8 |
| `stroke="rgb(217,119,6)"` | amber-600 | `hsl(var(--fig-amber))` | 6 | 16 |
| `stroke="rgb(5,150,105)"` | emerald-600 | `hsl(var(--fig-emerald))` | 5 | 8 |
| `fill="rgb(6,182,212)" on shapes` | cyan-500 | `hsl(var(--fig-cyan))` | 5 | 9 |
| `fill="rgb(225,29,72)" on shapes` | rose-600 | `hsl(var(--fig-rose))` | 4 | 4 |
| `stroke="rgb(168,85,247)"` | purple-500 | `hsl(var(--fig-violet))` | 3 | 6 |
| `fill="rgb(225,29,72)" on text` | rose-600 | `hsl(var(--fig-rose-text))` | 3 | 7 |
| `fill="rgb(5,150,105)" on shapes` | emerald-600 | `hsl(var(--fig-emerald))` | 2 | 2 |
| `fill="rgb(5,150,105)" on text` | emerald-600 | `hsl(var(--fig-emerald-text))` | 2 | 6 |
| `fill="rgb(245,158,11)" on shapes` | amber-500 | `hsl(var(--fig-amber))` | 2 | 2 |
| `fill="rgb(16,185,129)" on text` | emerald-500 | `hsl(var(--fig-emerald-text))` | 2 | 2 |
| `fill="rgb(139,92,246)" on shapes` | violet-500 | `hsl(var(--fig-violet))` | 2 | 4 |
| `stroke="rgb(148,163,184)"` | slate-400 | `hsl(var(--fig-slate))` | 2 | 2 |
| `fill="rgb(245,158,11)" on text` | amber-500 | `hsl(var(--fig-amber-text))` | 2 | 2 |
| `stroke="rgba(244,63,94,0.6)"` | rose-500 at 0.6 | `hsl(var(--fig-rose) / 0.6)` | 1 | 1 |
| `fill="rgb(244,63,94)" on text` | rose-500 | `hsl(var(--fig-rose-text))` | 1 | 1 |
| `fill="rgb(244,63,94)" on shapes` | rose-500 | `hsl(var(--fig-rose))` | 1 | 1 |
| `fill="rgb(100,116,139)" on shapes` | slate-500 | `hsl(var(--fig-slate))` | 1 | 1 |
| `fill="rgb(139,92,246)" on text` | violet-500 | `hsl(var(--fig-violet-text))` | 1 | 3 |
| `fill="rgb(14,165,233)" on text` | sky-500 | `hsl(var(--info))` | 1 | 1 |
| `fill="rgb(220,38,38)" on shapes` | red-600 | `hsl(var(--fig-rose))` | 1 | 2 |
| `stroke="rgb(220,38,38)"` | red-600 | `hsl(var(--fig-rose))` | 1 | 3 |
| `fill="rgb(220,38,38)" on text` | red-600 | `hsl(var(--fig-rose-text))` | 1 | 4 |

### Print and forced colours

- **Print.** Tailwind's dark variant applies on screen only (`darkMode: ["variant", "@media screen { … }"]`), so a `dark:` class no longer prints its pale dark-mode colour on white paper; print takes the light values of every token, the figure tokens included (section 7).
- **Forced colours.** Inside the kit and lesson figures, lines and outlines take `CanvasText`, soft fills become `Canvas` so labels stay readable, marks that are solid by meaning (the imp ●, filled arrowheads; class `fig-solid`) stay solid, text takes `CanvasText`, highlight bands become a dashed `Highlight` outline and the selection ring takes `Highlight`. Hatches, dashes, glyphs and tags still carry every meaning.

### Colour-blind safety

Neighbouring meanings that are close under colour-vision differences are told apart by something else, as before: rose and emerald (deuteranopia) by ✕ and ✓ and by the hatch; slate and cyan (protanopia) by the low and high level and the fill under high; cyan and emerald, teal and cyan (tritanopia) by the tag, the band's position and the glyph; violet and indigo by square corners and the `DUT` tag against radius 8 and the `IF` tag. Control (dotted) and causal (dashed) differ by dash, and by colour too where control is amber. Ok and error states differ by the ✓ and ✕ corner marks as well as emerald and rose.

### Assigning roles in lessons

A lesson pass may colour a figure that the kit or the CSS leaves neutral, without changing a word or a coordinate. Two means exist, both text-free:

- **Kit figures:** `role` on a node (leaf or container) of an `<ArchitectureDiagram>` or a participant of a `<SequenceDiagram>`: `"design"` or `"testbench"` only. A node of kind `generic` (or no kind) with a role takes that role's fill, stroke, corner shape and lifeline colour. It gets no tag chip, and its text and geometry are unchanged (unit tests compare the layout and every text position with and without roles). The legend lists the role's term ("design" or "testbench"), so the colour can be looked up (see the Legend row above). The role is said in words in the accessible description and in a selectable node's name ("Decoder (design side)", "arbiter, design side"). On a node whose kind has a tag, a role must agree with the kind, or the kit shows a data error, except on a side-overridable kind (below); any other value is a data error too (the lesson smoke test and `scripts/check-mdx.mjs` catch it). `interface` and `register` are not allowed as a text-free role: their corner radius is the same as a neutral box, so without their IF or REG tag they would differ by colour alone. Use the tagged kinds for them.
- **Side-overridable kinds (kit):** lessons use two tagged kinds on both sides, so on these a role may set the side. The part keeps its tag and all its text and geometry, and takes the fill, stroke and corner shape of the role; the side is said in words in the description ("FIFO write-data FIFO (design side; …)"), since the tag alone reads as the kind's default. The one list is `SIDE_OVERRIDABLE_KINDS` in `src/components/visual-system/figure-colours.ts`; the layout's data errors and `scripts/check-mdx.mjs` read it, and `figure-guard.py` and `figure-scan.py` mirror it (a unit test keeps them equal). Every other tagged kind keeps its side, and a role that disagrees with it stays a data error. An audit on 2026-11-15 of all 1,796 tagged parts in the 112 lessons found these two kinds, and no other, used on the other side from their default.
  - `fifo`: a mailbox, a `uvm_tlm_fifo`, an analysis FIFO or a queue in bench code is testbench and needs no role. An RTL FIFO, buffer or queue inside a design block (a bridge's write buffer, an interconnect buffer, an asynchronous FIFO's memory, a slave's FIFO data port) takes `role: "design"`.
  - `reg`: a register-model register, block or map (`uvm_reg`, `uvm_reg_block`, the mirror) is the register model and needs no role. A hardware register in the design (a retention register, a control register drawn as RTL) takes `role: "design"`; it keeps its REG chip and draws violet with square corners.
  - A role that names the kind's default side (`role: "testbench"` on a `fifo` or a `reg`) changes nothing and is not needed. The decision procedure below still applies: the lesson's words must place the part in a design block.
- **Hand-drawn SVG:** `data-fig="<role>"` on a shape, a `<g>`, a `<marker>` or a text. The role colour becomes the element's `color`, so every `currentColor` stroke and fill on it (or inside a marked `<g>` or `<marker>`) follows; a shape that draws a stroke also takes the role stroke directly; text takes the role's text colour (and so does `currentColor` text inside a marked `<g>`). No stroke is added where none was drawn, and a shape's own `fillOpacity` stays, so a marked bar is as light as it was before. Two modifiers go after the role: `tint` and `solid` (see "Role only, tint or solid" below). A `data-fig` holds one role at most, and it goes on a shape, a text, a `<g>`, a `<marker>` or a `<use>`; on the `<svg>` root, a `<title>`, a `<desc>` or `<defs>` it draws nothing, so the guard rejects it there.

| `role` (kit) / `data-fig` (SVG) | Colour | Non-colour cue that must already be in the figure |
|---|---|---|
| `design` / `design` | violet | kit: square corners (radius 3), and the role in words in the description; SVG: the part's label names a design block (RTL, DUT) |
| `testbench` / `testbench` | amber | kit: pill corners (radius 14) and words; SVG: the label names bench code (TB, UVM component, sequence) |
| — (tagged kind `interface` only) / `interface` | indigo | kit: the IF tag; SVG: the label names a bus, an interface bundle or a multi-bit value |
| — (tagged kind `reg` only) / `register` for a model, `expected` for a predicted value | teal | kit: the REG tag with radius 8 corners (a REG part with role `design` is square and violet); SVG: the label says mirror, model, reference or expected |
| — / `bit-low`, `bit-high`, `active` | slate, cyan | the low and high level of the trace; `active` only where the text says the part is current or selected |
| — / `mismatch` | rose | an X, ✕, hatch or the word error or mismatch (use `x` only for an X value on a trace) |
| — / `z` | amber | a Z or a dashed level |
| — / `match` | emerald | a ✓ or the word match, pass or ok |

**One token per meaning.** In new markup use `interface` (not `bus` or `data`), `register` or `expected` as the table says, `mismatch` (not `error`) and `match` (not `ok`). The synonyms stay valid only so old markup keeps working.

**Decision procedure.** Work through these in order for each part; the first that applies decides.

1. The part is a concept rather than a component (a phase, a queue slot, a time span, an axis, a counter), or its label says it is not a block: neutral. (B-AHB-1's "HREADY inputs" box stays neutral for that reason.)
2. The lesson's own words place the part on one side: give it that role, and quote the sentence in the pass log. A domain default is not enough. A master, slave, decoder, multiplexor or bridge is `design` only when the lesson says it is RTL or part of the system being built ("An AHB system with one master needs two pieces of glue logic", B-AHB-1); it is `testbench` when the lesson calls it a VIP, agent, BFM or model in the bench. Drivers, monitors, scoreboards, sequences and anything labelled TB are `testbench`.
3. Otherwise: neutral.

**Sets and ownership charts.** In a chart or set that splits something by owner (CPU time, bugs, lines of code), mark only the parts whose own label names a side ("Testbench (TB)", "DUT"). Leave parts whose label names something else ("UVM library", "Kernel and I/O") neutral even if they belong to a side by a wider definition: the chart's point is the split its labels make, and a colour must not widen it. Never colour one part of a set when that would suggest the others differ and they do not.

**Labels and shapes.** When a shape is marked, mark its label with the same role. A label may be marked without its shape: do that when marking the shape would break a contrast floor or erase a non-colour ladder (fill opacities, dash patterns) that tells the parts apart and that no label replaces. A role alone on a filled mark keeps the mark's `fillOpacity`, so a light bar stays light (an amber bar at 60% opacity measured 2.4:1 against the light page); use `solid` for such a mark, under the rule below, or leave the shape neutral.

**Role only, tint or solid.** A marked shape takes one of three treatments.

- **Role only** (`data-fig="<role>"`): its `currentColor` strokes and fills take the role colour, each at its own opacity; use it for lines, outlines, arrows and text. A fill in another colour (or `none`) stays as drawn.
- **Tint** (`data-fig="<role> tint"`): a box that holds text and stands for a component (a block, a node, a participant header). The soft fill keeps the text on it readable. Never on a bar, a line, a band or a value. `tint` alone is the neutral tier tint for a component box with no role. A tint fills only a closed box (a `rect`, `circle`, `ellipse` or `polygon`); on a `<g>` it fills nothing. Tint never goes on a dashed or hollow mark whose emptiness is a cue, on an open path or polyline (it would fill the area under the line), or inside a `<marker>` (it would turn an open control arrowhead into a filled data one). The guard rejects `tint` on any tag but those five, on a dashed shape and inside a `<marker>`, and the CSS applies it only to `:is(rect, circle, ellipse, polygon)` with no dash and outside a marker.
- **Solid** (`data-fig="<role> solid"`): a shape filled in `currentColor` (`fill="currentColor"`) with no text on it and no dash (a bar, a dot, a cell with no text on it whose label sits beside it, a swatch). An empty cell (`fillOpacity` or `opacity` 0) is never solid: filling it would make an empty cell read as a filled one. It fills with the role's stroke colour at full opacity, overriding the shape's `fillOpacity`, so it holds 3:1 on the page, the card and the glass frame in both modes and in print; forced colours draw it in `CanvasText`. `solid` without a role does nothing, and the guard rejects it, as it rejects `solid` with `tint`, `solid` on text, a `<g>` or a `<marker>`, and `solid` on a shape that is not filled in `currentColor` (an outline with `fill="none"`, an open line, a shape with no `fill`) or that has a `strokeDasharray`: filling those would change what the figure draws and hide a dash ladder. It also rejects `solid` on a shape whose `fillOpacity` or `opacity` is 0, and on a `rect`, `circle` or `ellipse` with plain-number geometry when a `<text>` or `<tspan>` in the same svg has its x,y anchor inside the shape's box (transforms are not followed, so a reviewer still checks a shape inside a transformed `<g>`). The CSS also applies `solid` only to `[fill="currentColor"]` without a dash and without a zero `fill-opacity` or `opacity`, as a second defence. Never put text on a solid fill: move the text beside the mark, or use `tint`.

**What replaces the opacity ladder.** Bars told apart by fill opacity or dash carry that difference without colour. A mark may go solid only when it has its own text label beside it (the label that names its part, such as "Testbench (TB)" beside its bar); that label is then the non-colour cue, and it takes the same role. A mark with no label of its own keeps its ladder and stays neutral. In a set, the parts that stay neutral keep their ladder too, so the set still reads in forced colours and in greyscale.

**Containers.** A container (an `env`, a `SoC`, a subsystem box) takes a role only when the lesson places the whole of it on one side (an `env` is testbench; a `SoC` that the lesson calls the design is design). A container that holds both sides, or whose contents the lesson does not place, stays neutral even when some of its children are marked.

**When a part stays neutral.** Whenever the procedure above does not give a role. A figure is never coloured for decoration: if no part's meaning is certain, the figure stays as it is.

**Captions.** A caption or sentence that names a colour must stay true: before marking, read the caption and the paragraph around the figure. `figure-scan.py` prints a WARNING when a figure's caption (hand-drawn `figcaption`, kit `caption` or `<Caption>`) or the paragraph just before or after it names a colour. Never give a part a colour that a caption names for something else, and never mark a figure so that "the shaded box" or "the grey line" stops describing what is drawn. If a caption would have to change, leave the figure neutral; captions are lesson text.

**Arrowheads.** A `<marker>` in `<defs>` inherits from where it is defined, not from the line that uses it, so a `currentColor` arrowhead stays neutral when its line is marked. The rule for the lesson pass: when every line that uses a marker has the same role, mark the marker (or its path) with that role; this works in every browser. A marker shared by lines of different roles stays unmarked, and so neutral. Where the browser supports `context-stroke`, `globals.css` lets an unmarked `currentColor` marker in a figure that has any `data-fig` follow the stroke of the line that uses it; elsewhere it stays neutral, which reads correctly because the line carries the meaning. Checked on 2026-11-15: Chrome 145 supports it; WebKit 26 (Safari) does not; Firefox not checked. Never duplicate a marker per role in a pass: that adds markup the guard rejects.

**Pilot.** On 2026-11-15 the pass was tried on two lessons. B-AHB-1: the ten blocks of its two generic system diagrams took `role: "design"` (the lesson places them in the system it builds; see step 2); the "HREADY inputs" box stayed neutral. E-PERF-1: in the attribution chart, the "Testbench (TB)" label took `testbench` and the "DUT" label `design`; "UVM library" and "Kernel and I/O" stayed neutral (see "Sets and ownership charts"). Its bars first stayed grey, because a role alone kept their opacity ladder and the amber bar fell below 3:1 on the light page; the chart still looked bland. With `solid`, the Testbench bar takes `testbench solid` and the DUT bar `design solid` (each has its own label beside it); the UVM library bar keeps its 40% fill and the kernel bar its dashed outline, both neutral. Open item, outside this pass: the neutral UVM library bar (`currentColor` at 40%, older than the pass) measures 2.39:1 on the light page and 2.41:1 in print, under the 3:1 floor for graphics; raising its `fillOpacity` to about 0.5 changes no geometry and belongs to the neutral-contrast follow-up.

**Forced colours and print.** Marked parts draw in `CanvasText` and `Canvas` like every other figure part; print takes the light values. The non-colour cues above carry the meaning in both.

**Tools.** `docs/curriculum-quality/workflows/figure-scan.py [--tiers T3_Advanced,T4_Expert] [--json OUT] [--work-only] [files]` lists every figure in each lesson with its line range and what a pass could do (generic nodes with no role, participants with neither kind nor role, monochrome SVG, and for a monochrome SVG with shapes filled in `currentColor`, a note that a mark with its own label may take `solid`), counts as solid candidates only marks that are filled, not empty (fill opacity above 0) and have no text anchored on them, and says "no solid candidates" when there are none, warns when a caption (a kit caption written as JSX or a template string included, timing captions too) or neighbouring paragraph names a colour or uses an appearance word a colour pass can make false (shaded, darker, highlighted, hollow, greyed, black, white, faded, tinted, filled, open dot, solid, outline, outlined, thick, thin, bold, dim, dimmed, faint, heavy, empty, blank, dark, light, pale, bright, opaque; in a kit caption "solid" does not warn, because kit roles never change a line's style), warns the same way for an SVG's own `aria-label`, `<title>`, `<desc>` and `<text>`, reports how many `currentColor` shapes a partly marked SVG still leaves unmarked, lists each node or participant of a side-overridable kind with the side it draws now ("check the side: fifo "write buffer" draws as testbench"), so a pass reads the lesson and gives an RTL buffer or a hardware register `role: "design"`, and says "nothing to do" where there is nothing. `--selftest` checks those warnings. `docs/curriculum-quality/workflows/figure-guard.py --base <ref> <lesson.mdx>...` passes only if the file, with every allowed `role` (a top-level key of a kit node or participant object, one per object) and every allowed `data-fig` (a top-level attribute of an opening tag within an `<svg>`) removed, is byte-identical to the base. Tags are found by a scanner that skips quoted strings, `{…}` expressions (and the JSX inside them) and inline code, so a `<` inside a string never starts a tag and words inside a string are never read as an attribute. Code fences, and inline code that holds a `<`, are never treated as figures. It fails on any other change, on a value outside the lists, on two roles in one `data-fig`, two `data-fig` attributes on one tag or two `role` keys in one object, on a `data-fig` on the `<svg>` root, `<title>`, `<desc>` or `<defs>`, on `tint` on anything but a closed box or a `<g>`, inside a `<marker>` or on a dashed shape, on `solid` without a role, with `tint`, on anything but a shape filled in `currentColor`, on a dashed shape, on an empty shape (opacity 0) or on a shape with text anchored inside it, on a role that disagrees with a tagged kind (any allowed role passes on a side-overridable kind, `fifo` or `reg`), on a `data-fig` outside an `<svg>`, on a tag that never closes or runs past its `</svg>`, and on a `role` outside a figure's nodes or participants. It prints a note for each role or `data-fig` that the base had and the file drops or changes, so a reviewer sees meaning changes; with `--strict` those notes fail. `--selftest` proves each case. In a lesson pass, run `figure-guard.py --base <ref> --strict` on every lesson the pass touches; run it without `--strict` only to accept a deliberate removal or swap, and say why in review.

### Modern, not noisy

Soft tinted fills under stronger strokes; one radius scale (tags 3, square design 3, other nodes 8, testbench 14, containers up to 16); 1.5 px or more for every stroke that carries meaning; no new animation. Section 14 replaces the rest of this rule as first written ("no glow, no decorative gradient, no shadow under shapes"): it says exactly which gradients, shadows and glows a figure takes, and forbids the others.

## 14. Figure art direction

Owner request on 2026-11-15, after section 13 was live: "where can i see the colors. ? i still see black and white ... they seems to have been added with no intentionality to it and are generic. i need to see the intentionality, colors , themses, 3d elements, glassy panel themes wherever possible." A uniform tint was not enough. This section adds to section 13 and changes none of its meanings, words or geometry. One sentence holds the rule: **a figure is an instrument panel: quiet glass around it, lit objects inside it, one focal part.**

The direction comes from the product (the method of the `unslop` skill), not from a trend:

- **Product.** A course that teaches engineers to verify chips with SystemVerilog and UVM.
- **Character.** Exact, lit from within, layered.
- **World.** The verification lab: waveform viewers, logic analysers, the glass of test equipment, a die under a microscope.
- **Moments.** The figures. The page chrome and the prose stay quiet (sections 1 to 12); the richness goes into the figure.
- **Signature.** The lit trace: a line that carries data glows like a trace on a screen, and the title strip opens with a small lit indicator in the tier colour.

### The six rules

1. **Intent.** A figure makes one point, and one part carries it: the focal part. It takes its hue at full strength, a heavier outline (2.5 px), a deeper shadow and a glow; every other part rests at 40% of its hue, so a figure of seven testbench parts is not a wall of amber. The focal part is named, never guessed: in the kit it is the part the figure names with `focus="<node id>"`, taken from the caption; else a part in a state (active, error, ok) or the selected part; else no part, and the data lines lead. (The first version picked "the part where the most data lines arrive". A review of 157 figures found that rule right on 14 of its 27 picks: it finds hubs, not the part the caption is about.) A focal part keeps its own colour and never takes a state colour. **A hue inside a drawing always means a role, a state or the ramp.** Structure with no protected meaning is neutral; the tier colour belongs to the panel (its field, title strip and indicator) and to a hand-drawn focal mark that carries its own label.
2. **Glass panel.** Every figure sits in a panel: the liquid glass of section 12, a hairline, the sheen at the top edge, its own tier field behind the drawing (the tier's field colour from the top left, its neighbour from the bottom right), a title strip where the figure has a title, and a legend strip of chips. No backdrop blur: the panel paints its own field, so the three-layer limit of section 11 holds whatever a lesson holds. A drawing fills its panel: a hand-drawn figure is composed to the lesson column, and a timing figure's panel is as wide as its screen or its title, whichever is wider. No empty glass beside a drawing.
3. **Depth.** Parts are objects, not outlines: a gradient in their own hue, lighter at the top; a 1 px lit rim just inside the top edge; a soft shadow under them. Containers and waveform screens sit lower (a well). The focal, active, error or selected part sits higher (shadow offset 7 instead of 3). A line that carries data is a lit trace: a band in its colour under the line (7 px in architecture diagrams, 6 px in sequence and timing diagrams) with flat ends, painted under the parts so it stops at a part's edge; the line and its arrowhead keep the widths section 13 measures. Structural lines are the secondary neutral.
4. **Colour on purpose.** The protected meanings stay. A gradient stays inside one hue. An ordered scale (cost, time, severity, stage) uses the ramp below and nothing else, and selection never changes a ramp mark's strength: the selected bar is marked by a cursor, a pointer and a bold label, not by dimming the others, which would make the selected stage look like the largest. Every colour has a legend chip or a direct label.
5. **3D only where the subject has layers or space** (mask layers, a layered testbench, memory, a stack): an isometric drawing in SVG. Never as decoration.
6. **One setting: rich.** Every figure is drawn lit, at full strength, and every floor is held at that strength. There is no quieter variant and no switch.

### Tokens

In all four theme blocks of `globals.css` (dark, light, the no-JavaScript light copy, print). Each is used as written: nothing scales it.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--fig-<hue>-body` | slate `215 24% 22%`, cyan `190 78% 16%`, rose `348 60% 21%`, amber `36 55% 19%`, violet `258 56% 30%`, indigo `234 54% 28%`, teal `172 70% 14%`, emerald `158 62% 15%` | slate `215 16% 47%`, cyan `188 86% 53%`, rose `350 89% 75%`, amber `38 92% 50%`, violet `258 90% 66%`, indigo `239 84% 67%`, teal `173 80% 69%`, emerald `160 84% 59%` | the hue an object is filled with: deep in dark mode and pale in light mode, so the label, sublabel, tag and outline keep their floors on it. Dark amber is held back (it was `32 78% 22%`, which read as brown) |
| `--fig-obj-top` / `--fig-obj-bottom` | `0.88` / `0.34` | `0.1` / `0.23` | the alpha of the body hue over the card at the top and bottom of an object at full strength; the top is the lighter end in both modes. A part at rest takes 40% of these (`fig-grad-rest`). Light cannot go deeper: at `0.24` a tag on its chip falls under 4.5:1 |
| `--fig-quiet-top` / `--fig-quiet-bottom` | `0.1` / `0.03` | `0.04` / `0.08` | a part with no role: the primary colour over the card at these alphas (neutral glass, no hue) |
| `--fig-obj-highlight` | `0 0% 100% / 0.3` | `0 0% 100% / 0.95` | the lit rim |
| `--fig-obj-shadow` | `224 50% 2% / 0.62` | `222 40% 28% / 0.32` | the shadow under an object (one blurred pass per figure) |
| `--fig-well` | `224 50% 2% / 0.12` | `220 30% 40% / 0.014` | containers and waveform screens |
| `--fig-stage` | `0.26` | `0.05` | the tier field inside a panel, at its strongest stop; never above the page field of section 11. Tiers 2 and 3 take 70% of it (`--fig-stage-tier`): blue and violet read heavier than teal and amber at the same alpha |
| `--fig-glow` | `0.5` | `0.45` | the glow of the focal or state part (one blurred pass per figure) |
| `--fig-trace` | `0.24` | `0.16` | the band under a data line |
| `--fig-level-fill` / `--fig-trace-flat` | `0.2` / `0.14` | `0.08` / `0.04` | a high one-bit level: the cyan fill that deepens toward the level, and the band on the level. Set so the level keeps 3:1 against the two together |
| `--fig-face-top` / `-left` / `-right` | `0.34` / `0.2` / `0.1` | `0.46` / `0.3` / `0.16` | the three faces of an isometric plate |
| `--fig-ramp-1` to `-5`, `--fig-ramp-text` | `312 30% 54%`, `314 44% 60%`, `316 62% 67%`, `318 80% 73%`, `320 96% 80%`; text `318 90% 84%` | `312 34% 52%`, `314 46% 46%`, `316 58% 40%`, `318 72% 34%`, `320 84% 27%`; text `318 76% 30%` | the ordered ramp |
| `--fig-ramp-1-body` to `-5-body` | `312 26% 23%`, `314 36% 25%`, `316 46% 28%`, `318 54% 30%`, `320 66% 33%` | `312 40% 62%`, `314 55% 58%`, `316 68% 54%`, `318 80% 50%`, `320 90% 46%` | the ramp as an object fill, for an ordered part that carries text (a stage plate): used like the `-body` hues, with the step's own ramp colour as its outline. The fills of neighbouring steps are too close to tell apart, so such a part also carries a solid mark in its full ramp step (the cap on a stage plate) |

Tailwind: `text-fig-<hue>-body`, `fill-fig-ramp-1` to `-5`, `stroke-fig-ramp-N`, `fill-fig-ramp-text`, `text-fig-ramp-N-body`. `fig-generic` (the outline of a kit part with no role, and of the wells, leader lines and neutral plates of the hand-drawn figures of F1A) is the secondary neutral, with no tier share. (A hand-drawn box marked `data-fig="tint"` alone keeps the 20% share section 13 gave it, as on the live site; no kit figure draws it.) Section 13 gave it 20% of the tier colour and the first version of this section 46%; every tier hue sits on a role hue (tier 1 teal on expected and register, tier 2 blue beside interface, tier 3 violet on design, tier 4 amber on testbench), so in a tier 4 lesson a formal tool with no role was drawn in the colour of the testbench.

**The ramp is fuchsia** (hues 312 to 320), the one hue family no protected meaning uses, so a cost or severity scale never reads as design, testbench or a signal level. More is further from the page: lighter in dark mode, darker in light mode, each step at least 1.15:1 from the one before and 3:1 on every figure surface. At most five steps. A ramp mark always has its value or label beside it, keeps its full strength whatever is selected, and is never used for categories. The top steps sit about 30 degrees from the error rose, and no figure has shown both yet: **a ramp mark and an error or X mark never share a figure unless both are labelled**, and their separation is to be tested before the ramp is used outside F1A. One exception to "never for categories", used in F1A: in a lesson whose subject is the ordered quantity itself, one ramp step may mark the parts that incur it (the mask layers a fix has to remake are what the fix costs, so they are drawn in `ramp-4`), as long as a texture and a label carry the category and the other categories are neutral. The step marks the masks a fix remakes now, so a case that remakes none shows none, and the count of lit layers is what is read: 0, 2, then 4 in the mask stacks; 0, 2, 4, 0 in the four decisions, where bug 4 (the firmware workaround, the costliest row of the table above it) changes no mask now and so carries no fuchsia. The step says which masks are bought, not which case costs most; a figure that uses it this way says so in its title or caption ("Which masks change"). That gives the lesson one colour story: fuchsia is what it costs. The same step is the "post-silicon lab" stage in the strip and the ×1,000 bar in the chart; the hatch and the chip "new mask" keep it from being read as that stage.

### One setting

The site has one setting: the lit one, which this section describes. The owner decided on 2026-11-15 that figures are drawn rich only. A second, calm setting (the glass frame with flat parts, chosen with `data-fig-style`) was built and then removed with every rule and variable that served only it (`--fig-level`, `--fig-glow-level`, `--fig-field`, `--fig-panel-drop`); each of those was replaced by its full-strength value, so nothing on screen changed. There is no switch, and every floor is tested at the strength that is drawn.

### Classes

Panel (HTML): `fig-panel` (with `glass-liquid`), `fig-titlebar`, `fig-stage`, `fig-legend`, `fig-chip`, `fig-caption`. Drawing (SVG): `fig-fx` (every decorative element: dropped in forced colours), `fig-fx-blur` (the two blurred groups: also dropped in print), `fig-stop-top`, `fig-stop-bottom`, `fig-grad-rest` (a part at rest: 40%), `fig-grad-quiet` (a part with no role: neutral), `fig-stop-level`, `fig-stop-none`, `fig-stop-shade` (a solid mark with no text on it, such as a bar, shaded toward its base with the object shadow, so its top is the lighter end in both modes), `fig-rim-top`, `fig-rim-end`, `fig-shadow`, `fig-well`, `fig-glow`, `fig-glow-soft` (where more than one part is lit), `fig-trace`, `fig-trace-flat`, `fig-rail`, `fig-ramp-mark` (a solid mark in a ramp step: a name only, with no rule of its own, so the mark is drawn at its full ramp step), `fig-selected` (with `fig-solid`: the selected one of a row of solid marks takes the system's selection colour in forced colours), and for isometric faces `fig-face-top`, `fig-face-left`, `fig-face-right`. The kit draws them from `src/components/visual-system/figure-depth.tsx` (`FigureDepthDefs`, `ObjectBody` with its `level`, `ObjectRim`, `ObjectShadow`, `ObjectGlow`, `FigureTitleBar`).

### The kit, as built

Every kit figure changes without an edit to its lesson. One optional key was added: `focus`.

- **Panel and title strip.** The MDX kit passes `showTitle`; the strip shows the figure's `title` (already its accessible name) at 14 px after a lit indicator in the tier colour, on the tier field at the field's own alpha. The strip is `aria-hidden`, because the drawing announces the same title; it carries `data-fig-title`, so a text comparison can leave it out. Visualizers, which sit under their own heading, do not show it. The stage keeps the 8 px the frame had before, so a figure embedded in an interactive keeps its width; under a title strip it has 12 px above and below, and under 480 px 4 px at the sides. The caption of every kind of kit figure sits below the panel at the lesson's caption size (a timing figure used to carry its own at 12 px inside the panel).
- **Architecture diagrams.** A part is an opaque card base, the body gradient in its role's hue at rest or at full strength (a state's hue wins), the soft fill and outline of section 13, and the rim. Containers get a well. Data lines and lines in a state get the trace band, under the parts. The legend is a strip of chips. The sublabel and the port labels are the primary colour at 80% (they were the secondary colour), so they hold 4.5:1 on a lit part.
- **The focal part: `focus="<node id>"`** on `<ArchitectureDiagram>`. Text-free: it changes paint only. It must name a node of the figure that is not a container; the layout's data checks show a problem on the page otherwise, `scripts/check-mdx.mjs` reports it, and `figure-guard.py` removes it before its comparison (so a pass that sets `focus` still proves that no word or position changed). Take it from the caption; leave it out when the caption is about a flow or about several equal parts. Set so far: F1A triage tree `s5` ("whatever the fix, step 5, escape analysis, follows"), F2E self-checking loop `compare` ("meeting at a !== compare"), I-UVM-1A component tree `drv` ("drv's seq_item_port is at depth 5"), B-AHB-1 single-master system `mux` (the HREADY loop closes at the multiplexor). The other lessons have none yet and so show no focal part unless a state marks one; the teaching review lists the right part for 21 more figures.
- **Parts with no role** are neutral glass: the primary colour over the card at `--fig-quiet-top` and `-bottom`, with the secondary neutral as outline. No tier colour.
- **Sequence diagrams.** Participant headers are objects; each lifeline stands on a 10 px rail in its role's hue (at 8%); the band of a call is lit in the caller's role hue, while its line and head stay as they are, and a return (dashed) and an async send (open head) stay plain, so the three still differ at a glance.
- **Timing diagrams.** The traces sit on a screen (a well); the panel hugs it. The fill under a high level deepens toward the level, and the level is a lit trace; a bus is an object in the indigo body hue with a lit top edge. Both are left out where a cyan band or the cursor already tints the column, as section 13 requires.

Known and not fixed here, because they are layout and predate this section: in the self-checking loop the REF tag runs under step badge 2; in the component tree the ENV label is crossed by the AGT container's border, "depth 4" meets "seq_item_export", and the TEST container is empty at the top.

### Hand-drawn figures

The same parts, written by hand: wrap the SVG in `glass-liquid fig-panel` with a `fig-titlebar` (only the figure's existing title) and a `fig-stage`; give a marked box (`data-fig="<role> tint"`) a gradient from its own `<linearGradient class="text-fig-<hue>-body">` with `fig-stop-top` and `fig-stop-bottom` stops; put the one focal mark in a `fig-glow` group; draw ordered marks in `fill-fig-ramp-N`. Every added element is `fig-fx` or carries no text. The rules of section 13 ("Assigning roles in lessons") still decide which part takes which role.

**Compose to the column, and again for a phone.** A drawing that fills the 800 px lesson column cannot keep its text at 11 px on a 390 px phone, and one that fits the phone leaves a third of the panel empty on a desktop. So a hand-drawn figure of this kind is drawn twice from the same words: one SVG with `className="hidden h-auto w-full sm:block"` and one with `className="block h-auto w-full sm:hidden"`. Each has its own `<title>` and `<desc>` (the same words; the phone copy's ids end in `-s`) and its own ids in `<defs>`. Only one is ever rendered or announced. A key goes in a `fig-legend` strip of chips under the stage, once, not inside either drawing.

**Isometric drawings.** Axes at 30 degrees: one unit along x is (0.866, 0.5), along y (−0.866, 0.5), up (0, −1). Each layer is a plate with three faces in its role's colour (`currentColor`): `fig-face-top`, `fig-face-left`, `fig-face-right`, each with the role's stroke. Light comes from the top left in every figure. Layers stack upward with a gap that lets the layer below show; where the side faces carry a texture that must be read (a hatch), the plates may be thicker than the gap (F1A: plates 7 and 13 units thick, 4 apart). The lit layers lift clear of the quiet ones (F1A: 5 units more) and take the soft glow. Labels sit beside the stack on leader lines, never on a face. Where the caption calls the drawing a cross-section, draw a cut block and make the cut face the reading face: wide, under a shallow top (F1A: 52 wide, 14 deep), with anything inside a layer (a cell, a via) drawn on it, skewed to the face. A plate that does not exist yet is a dashed wireframe (dash 4 3) of its outer edges and one top edge, no fill and no shadow. A hatch line is drawn at full strength in its plate's colour, like the outline: at 0.9 it was 2.98:1 on the top face in light mode, and at 1 it is 3.28:1 there (4.55:1 on the cut face; 3.90:1 and 5.37:1 in dark mode). Draw each plate in place, not with `<use>`: in Chromium a rule that reaches into a figure through its ancestors (`[data-lesson-article] svg …`, the forced-colour rules among them) does not reach a `<use>` copy.

### The first lesson, drawn by hand (F1A)

Three visuals of the lesson were redesigned on 2026-11-15 as the worked example of this section, and revised the same day after three reviews (design, teaching, robustness). Words, numbers, `<title>`, `<desc>`, captions and aria attributes are unchanged; a script compares the text of each composition with the lesson at `cb80965f`. The `viewBox` was free to change, and did.

Two more were drawn the same day, because the lesson says of each that it repeats one of the three: the recap "draws the same strip" as the first figure, and the four decisions are drawn "in the encoding of the respin figure". Left as bare outlines they contradicted the figures they name.

**The last four** (verification lifecycle, shift left, career ladder, coverage of an incomplete plan) were drawn the same day, after the owner looked at the lesson and named them as the ones that "still look basic". They are the last four bullets below. No hand-drawn figure of the lesson is a bare outline now. Each has the panel and title strip, a column composition 552 wide and a phone composition 332 wide, and the words of the original in the original order (97 checks over the seven figures and the recap).

- **One colour story for the lesson: fuchsia is what it costs.** The ramp climbs across the five stages in the strip, lights the mask layers a fix has to remake, and colours the bars of the cost chart. Teal (the tier) is the panel and the one focal line; cyan stays "selected"; everything else is neutral.
- **The strip ("Where a bug can be found").** Five stage plates climb `ramp-1` to `ramp-5`: a body in the step's `-body` hue, the ramp outline, rim and shadow, and a solid cap in the full ramp step, because the body fills alone are too close to tell apart. The focal part is the tape-out line: dashed, in the tier colour, glowing, from a flag down through the arrow, so it visibly cuts the growth. Two recessed trays, one each side of the line, hold the plates and, in secondary text, what a fix means there. The arrow is one thin line in five ramp steps, one per stage; it states no curve (the first version was a wedge that swelled seven times, a shape the lesson does not claim). In forced colours it is solid.
- **The mask stacks ("Which mask layers change").** Three cut blocks side by side on one ground line (stacked on a phone), one well per case holding its stack, its layer names, its heading and its text. New masks are hatched plates in `ramp-4`, lifted, with a soft glow; reused layers are solid neutral plates; layers with no mask yet are dashed wireframes. The count of lit layers (0, 2, 4) is the point. In (b) the spare cell is a neutral cell on the cut face of the base (it was placed before tape-out), and the via that wires it in is in the colour of a new mask, ending in a pad on the new metal layer. The key is a legend strip of chips.
- **The recap strip ("The cost ladder with the three fix routes after tape-out").** The strip again, with its numbers: the same five plates in the same ramp steps, in the same two trays, cut by the same lit tape-out line under the same flag, and spaced like the strip: a plate sits 6 units from its tray on every side, and the line has a gutter of 12, three times the gap between plates. Here every plate stands on one line and each is one step taller than the last (one step per ×10, as the description says: "five steps rise"), with its number on one row across the five. What this figure adds is under the strip. The line runs on down, and three signs in the tier colour hang on it and point right: the three routes after tape-out, each with its condition in secondary text under it. They share the line's glow, so the focal mark is the line with its routes. To the left of the line there is one quiet neutral sign that points nowhere: before tape-out a fix is one thing. It sits in the recap card, which is already liquid glass, so it has no panel or title strip of its own. One composition 300 units wide serves every width, but only where the picture is at least 315 px wide. The card's own grid (two cells side by side from 280 px each) gave it 279 px at a 1280 viewport and 255 px at 640, which put its text at 9.77 and 8.93 px. So the drawing carries `data-recap-picture="wide"`, and `VisualRecap` then sets the two cells side by side only when each gets 360 px (`VISUAL_RECAP_GRID_CLASS`); below that the card stacks and the picture is centred at its full 360 px. Measured across viewports 360 to 1920: stacked up to 768, at 1024 to 1040 and at 1280 to 1360, where the picture is 360 px from a 434 viewport up (text 12.6 px) and 316 px at 390 (11.06 px); side by side everywhere else, where it is 320 to 360 px (11.2 to 12.6 px). Never under 11 px from 390 up (10.54 px at 375, under the phone width the floor names). No other lesson's card changes. Whether every recap card should take the 360 px minimum is the owner's decision: it would restack all of them at 1280.
- **The four decisions ("Which masks change for each of the four decisions").** The cut blocks of the mask stacks, to the unit, one per decision, each centred in its own well over its heading and two lines: bug 1 four dashed wireframes and no shadow, bug 2 two hatched lit layers lifted over two solid ones, bug 3 four hatched, bug 4 four solid. The count of lit layers (0, 2, 4, 0) is the point again, and the last block says at a glance that shipped silicon does not change. Four in a row in the column, two rows of two on a phone. No legend strip: the caption is the key, and a strip would add words the figure never had.
- **The cost chart (`InteractiveCostOfBugGraph`).** Each stage keeps one ramp step, at full strength, in both views and whatever is selected. A bar is a solid mark with a light shade toward its base and a lit rim; the selected stage sits in a cyan cursor column (as in a waveform viewer) with a glow under its bar, a pointer and a bold label. One faint rule per order of magnitude runs from the bar that reaches it to the right edge. The chart is top-aligned in its card and the readout card has one height, so nothing moves as the learner steps through the stages. The readout names the stage beside a swatch in its ramp step. The frame takes `fig-panel`, so the interactive has the tier field before the learner answers. Left as it was: the amber prediction card inside the frame and its "Predict" chip (4.3 to 4.4:1 in light mode, as before this work) belong to the shared prediction component.
- **The lifecycle ("The verification lifecycle and who owns each step").** The idea is two loops, so the two loops are the only colour. Seven neutral glass plates stand in a column, as the description says; in the column composition each plate is one line, the step on the left and its owner on the right of one spine, and the arrows between plates run on that spine (two-line plates on a phone). Owners are categories and stay text: no hue and no ramp. A tray holds the five numbered steps, which are verification before tape-out; Tape-out and Post-silicon validation sit under it, flatter (no shadow or rim). The short loop is a solid line in the tier colour on a trace band: it leaves Regression, turns once in a ring and comes back, inside the tray. The long loop is the focal part: dashed (the caption says so), 2.5 wide, glowing, from a dot on Post-silicon validation round the outside of the tray and back into the Verification plan. Both loops carry their own labels, which is what lets them take the tier colour.
- **Shift left ("Shift left: the same activities, moved earlier in the schedule").** Two lanes (trays) on one time axis, cut by the tape-out line of the strip: the same flag, dash and width, with its halo at half strength so the bugs lead. Activities are neutral plates placed in time. Each ✕ is rose, the protected colour of an error, bold at 14.5 units with a soft halo; the ✕ marks are the focal marks. The halo is half strength because a rose cross on a full rose halo measured 4.1:1 in light mode (5.2:1 now). The movement is drawn: two slanted neutral arrows on trace bands cross the gutter, each from under a late activity to above the place it runs in the lower lane, and the one from "software" crosses the tape-out line. The empty left half of the upper lane is the point of that lane and is left empty. The axis is neutral, not the ramp: a ramp mark and a rose mark do not share a figure.
- **The career ladder ("The DV career ladder: four rungs and what each one owns").** The subject has levels, so it is isometric: a step ladder, two neutral rails and four rungs, each rung one run further back and one rise higher than the last. It is still a ladder with four rungs, as the description says. The rungs are ordered, so they take `ramp-1` to `ramp-4` from the bottom: the top face of a rung is a solid mark in its full ramp step (the cap rule above) and its sides are faces in the same step. No rung glows, because no rung is the focal part; height and the ramp carry "more". Painted far rail, rungs from the top down, near rail. In the column the labels stand on the left, right-aligned, each on a leader at the height of its rung, and the ladder climbs to the top right; on a phone the ladder is steep and narrow and each label starts beside its rung, because the longest line (236 units) leaves 80 units for the drawing.
- **Coverage ("100% coverage of an incomplete plan").** The focal part is the gap. The outer box is a tray with its label inside it and a full-strength border, because the description names that box (a tray border at the usual 0.55 measures 2.5:1 in light mode, in every figure of this lesson). The plan is an object in the emerald body hue at full strength with a solid emerald cap and an emerald outline: full, shaded as the description says, and in the colour of a match; its two result lines are emerald text. Beside it, the same height, is what the plan never listed: a dashed rose outline 2.5 wide with no fill, no shadow and a soft glow, holding the two rose ✕ marks. Rose is X and error, which is what an unasked question is. Side by side the two read as one bar, full and then empty.
- **Measured for the last four** (`contrast4.cjs`, from pixels, dark and light, 1440 and 390): every text at 4.5:1 or more (worst 5.16:1, a ✕ in light mode) and every mark at 3:1 or more (worst 4.12:1, the emerald cap in light mode). The one exception was the border of a tray, drawn at 0.55 as in the strip and the mask stacks: 3.24:1 in dark mode and 2.48:1 in light mode. It was then raised for the whole lesson in one change: every tray (`fig-well stroke-fig-generic`) of every hand-drawn figure and the recap is drawn at full strength, the secondary neutral itself, and measures 7.94 to 8.11:1 in dark mode and 6.75 to 6.92:1 in light mode (`contrast4.cjs`, 1440 and 390). The leader lines and spine ticks drawn at 0.55 are `fig-fx` decoration and stay. Text is 14.88 px or more in the column and 11.01 px or more at 390. Forced colours and print were looked at for each.

- **The recap's secondary lines.** The condition under each route sign and the two lines under the "before" sign were `fill-muted-foreground`. Measured from pixels, the three under the signs fell to 3.71 to 3.87:1 in light mode at 1440 (4.29 to 4.45:1 at 390), where the line's glow lies under them. All five are now the primary colour at 0.8, as in the coverage figure ("what sign-off can see"): 5.35:1 or more in light mode. Words and positions unchanged.
- **The two kit figures.** The sequence diagram ("One bug, two loops") gives the two participants the lesson places on a side their role: the DV engineer `testbench` (its sublabel is "testbench, regressions"), the design engineer `design` ("the RTL"); the DV lead and the post-silicon lab stay neutral. The kit then lights their headers, rails and call bands in amber and violet and adds the role key (two chips) under the drawing; the error calls stay rose. The triage tree keeps `focus="s5"`.

**The five interactives of F1A**, as built (taken from the code). Each frame is a figure panel with the tier field, every part is drawn from the figure tokens, and each has one focal part:

- **`InteractiveCostOfBugGraph`** (the cost chart): above.
- **`ShiftLeftTimeline`.** The lanes are recessed trays on one time axis, each capped with its step of the fuchsia ramp (the lane after tape-out spans the lab and field steps); the tape-out line is the dashed tier line of the "Shift left" figure. A placed token is a lit card in its protected colour (emerald caught, amber moved, rose escaped), with the glyph and cost on its top line and the name below; the token of the current step is the focal part (full strength, raised, glowing) and the others rest at 40%. A token that moved or escaped leaves a dashed empty slot in the lane of its earliest catcher. Waiting tokens are neutral glass pills.
- **`BoundaryProbe`.** The number line's lanes are one-bit traces over the temperature axis: low (slate) up to the threshold, a rising edge, high (cyan) after it, on an SVG layer behind the lanes' own HTML segments, in per cent so it lines up at every width. In light mode the lanes take their body hue whole (at 40% they read as white bars) and the rising edge is drawn in the cyan ink. The focal part is the disagreement band, on the RTL lane only: a filled, glowing rose segment from the Spec edge to the RTL edge, never narrower than `BAND_MIN_PX`. In the bit close-up a 1 carries the high level along its top edge and a 0 the low level along its bottom edge; only the cells of the disagreement band glow and rise (a Highlight outline in forced colours). The test values and verdicts stay in the marker row under the lanes.
- **`FixPathDecisionLab`.** The cross-section is the cut block of the respin and four-decisions figures, to the unit, drawn 1.3 times larger in a well of its own: hatched `ramp-4` plates for new masks (lifted, soft glow: the focal part), solid neutral plates for reused layers, dashed wireframes for layers with no mask yet, each plate drawn in place (no `<use>`); the layer key is a strip of chips with swatches drawn like the plates. The triage path is a lit cyan trace: a rail joins the steps the path reaches, from step 2 to step 5, and bends out of the node column round a step it skips, which keeps a neutral dashed rail and a hollow dashed node, so colour never says the path passes a step it skips.
- **`HallOfShameCarousel`** (predict mode). Each slide is a lit plate on the panel's field; the impact, the lesson and the timing are neutral glass at rest; the focal part is the gap (the question the plan never asked), drawn as the coverage figure draws it: a dashed rose outline 2 px wide on a lit rose body, raised and glowing; on the summary slide each card's gap rests as a dashed rose rule. The progress capsules sit in a well. The two card pictures (FDIV, Spectre and Meltdown) were files with literal colours, blurred glossy blobs (one pink beside the fuchsia ramp), one dark artwork in both themes, and text at about 7.6 px that `object-cover` cropped. They are now drawn inline (`IncidentPicture`): a neutral glass plate with a small drawing in a well beside the picture's name and its words as HTML text (12 px or more, wrapping, never cropped). FDIV: the quotient table as 5 by 4 neutral cells, one entry lifted in rose with a ✕ (the entries that should have held +2 held 0). Spectre and Meltdown: the cache as an isometric stack of four lines in the plates of the mask stacks, one lifted in rose: the trace a speculative access leaves. Each has one focal mark, rose for error. They stay decorative and hidden from assistive technology, as the file pictures were (`alt=""`); the card's title and story carry the incident. The plate is at least 160 px tall, the height of the old picture box; where the Spectre words wrap (1024, 768 and under 640) it is 199 px (219 at 360). The `image` field remains for cards given through `items`.
- **`DesignGapChart`** (in "Push Further"). What can be built climbs faster than what can be checked; the widening gap between the two curves is the focal part, the only glowing full-strength mark, measured by a rose dimension bracket at its widest point. The curves keep their roles (violet design, amber testbench) as lit traces on a recessed screen; the time axis is neutral, because a ramp and a rose mark do not share a figure. One drawing serves every width: its text is set larger in drawing units under `sm`, so it stays at 11 px or more at 390.

**Open for F1A: the kit figures at phone width.** At 390 the sequence diagram scrolls sideways inside its frame (488 px of drawing in 356) with its smallest text at 7.47 px ("testbench, regressions"), and the triage tree overflows its frame by 12 px (368 in 356) with its sublabels at 8.55 px. Neither can be fixed from the lesson's data: the kit's text is set under 11 units (participant sublabels 9, node sublabels 9.5) and the kit never draws below a scale of 0.9 (`MIN_RENDER_SCALE`), so 11 px at 390 needs a phone composition in the kit itself. Tried and rejected for the tree: `cellWidth` 76 and `gapX` 44 fit the frame (348 units) but put four labels outside their nodes; narrower gaps hide edge labels (the kit's layout check). This blocks the release of F1A under the 11 px floor, and the fix (a phone composition for kit architecture and sequence figures, or a site-wide scale floor that keeps kit text at 11 px and scrolls) changes every kit figure on a phone, so it is the owner's decision.

### Floors and fallbacks

`tests/app/theme-contrast.test.ts` ("figure art direction") checks, in both modes and at full strength: every figure stroke at 3:1 and every figure text at 4.5:1 on the stage (each tier's field at `--fig-stage` over the frame); on an object at both ends of its gradient, the label, the sublabel, a port label, the tag on its chip and a badge at 4.5:1 and the outline at 3:1; a bus value on its cell over every surface and the well; a container's tag, name and border three wells deep; a part with no role, and that its body has no hue and its outline is the secondary neutral; a high one-bit level at 3:1 against its fill and band together; the title and indicator on the title strip; legend chips; the ramp; and a solid ramp mark at 3:1 against every figure surface, every stage and a well on each. `tests/components/DiagramKit.test.tsx` checks that a figure shows a focal part only when it names one or a state marks it.

- **Forced colours.** Everything `fig-fx` and the panel field are not drawn; the strip, chips and isometric faces take system colours; solid marks (`fig-solid`) fill with the text colour and the selected one with the selection colour. Section 13's rules then draw the figure.
- **Print.** The blurred shadows and glows and the panel field are not drawn; gradients, rims and traces print with the light values.
- **Reduced transparency.** The panel field is not drawn (the panel is already solid there).
- **Reduced motion.** Nothing here moves.
- **Phone width.** The title wraps; a kit architecture or sequence drawing scrolls inside the stage as before, and the focus ring of that scroll region is an outline drawn above the drawing. A hand-drawn figure shows its phone composition, with text at 11 px.
- **Heights of interactives.** A kit figure embedded in an interactive keeps its 8 px stage, but its legend is now a strip of chips, which is taller. The placeholder heights of the interactives that embed kit figures must be measured again before release (`scripts/measure-lazy-interactive-heights.cjs`, after a rebase onto checkpoint 30).

### Forbidden

Backdrop blur inside a figure. A gradient that runs from one hue to another. A glow on anything but the focal part, a part in a state, or a data trace. Any tier colour on a part with no role or on a structural line. A focal part chosen by a rule instead of by the figure. Dimming a ramp mark to show selection. Gradient text, or depth on text. Any animation. The ramp for something that is not ordered, or a ramp mark with no label. An isometric drawing where the subject has no layers or space. Words in a title strip that are not the figure's own title. Glass or a gradient under lesson prose or code.
