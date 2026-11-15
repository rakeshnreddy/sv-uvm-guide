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
| No role (`generic` with no `role`) | a neutral tint of the lesson's tier: the tier colour mixed 20% into the secondary colour as the stroke, the tier at 4.5% as the fill, no chip. It carries no meaning, so it stays near-neutral and never reads as a role or state |
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

Soft tinted fills under stronger strokes; one radius scale (tags 3, square design 3, other nodes 8, testbench 14, containers up to 16); 1.5 px or more for every stroke that carries meaning; no glow, no decorative gradient, no shadow under shapes and no new animation.
