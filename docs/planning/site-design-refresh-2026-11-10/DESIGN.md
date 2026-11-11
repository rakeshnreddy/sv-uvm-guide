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
| `--subtle-foreground` (new) | `220 8% 56%` | `220 8% 43%` | meta and captions only; at least 4.5:1 on every surface it sits on |
| `--primary`, `--ring` | `197 85% 59%` | `200 88% 33%` | the one accent: primary action fill, links, current-item marker, focus |
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
| 1 Foundations | `172 66% 50%` | `172 80% 24%` | teal |
| 2 Intermediate | `222 100% 74%` | `222 75% 42%` | blue |
| 3 Advanced | `260 100% 79%` | `262 60% 46%` | violet |
| 4 Expert | `36 90% 63%` | `30 92% 32%` | amber |

- A builder may move lightness by up to 4 points so that each colour, used as text, holds 4.5:1 on the page, on the card surface and on its own subtle fill. A unit test enforces it.
- The tier of a module code comes from the curriculum data (one shared lookup), never from the code's prefix. Milestone ids (M0 to M8) and codes with no tier stay neutral.
- Where it shows: every signal tag (tier-coloured text, subtle fill, tinted border); tier headings on the curriculum page and in the course outline (a small step mark in the tier colour); a 2 px top edge on cards that belong to one tier (the tier colour fading to transparent); on a lesson page the header's tags and the first 48 px of each layer band's rule; progress traces.
- Tier colour always travels with the tier's name or the module code, so it is never the only cue. The sky accent keeps its meaning: clickable or current. Headings and body text stay neutral.

### Colour field

A static, decorative layer behind the top of a page (`aria-hidden`, no pointer events, no animation, no JavaScript): three or four soft radial gradients in the tier colours, masked so it has fully faded by the end of its height.

- Strength: 0.34 to 0.55 alpha per gradient in dark mode, 0.14 to 0.24 in light mode.
- Variants: `all` (landing, curriculum, practice, dashboard, reference and info pages: all four tier colours in fixed positions) and `tier` (lesson pages, labs and anything that belongs to one tier: that tier's colour leads and its neighbours are faint).
- Height: up to 820 px on hub pages. On lesson pages it covers the header only and has fully faded before the first paragraph of the article.
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

- **Real glass (with backdrop blur)** is for layers that float above content: the header bar, menus and popovers (Practice, Reference, theme, Jump to, search results), dialogs and sheets (search, shortcuts help, the lesson contents sheet, the phone menu and the outline drawer), the sticky "On this page" bar, and cards that overlap a colour field at the top of a hub page.
- **Quiet glass (no blur)** is for cards further down hub pages: the translucent fill, the hairline and the top highlight, with no backdrop filter.
- **Never glass:** lesson running text, code blocks and editors, tables, quiz and exercise controls, form fields, the docked outline and the "On this page" panel. No glass on glass: a glass card never sits inside a glass panel.
- At most three blurred layers are visible at once (header, one menu or dialog, one sticky bar). No `will-change`. The field and the glass must not cause layout shift.
- Fallbacks: without `backdrop-filter` support, with `prefers-reduced-transparency: reduce` and in forced colours, glass becomes the solid card surface with its hairline.
- The header stays 64 px tall (56 px for the public header on phones) and keeps its alignment with the page columns; the glass bar is a rounded background layer (radius 16) inside that height, not a layout wrapper. Content scrolling under it is what shows the glass.
- Text on glass holds 4.5:1 against the worst case (the glass fill over the strongest field colour); the unit test checks it.

### Gradient accents

Allowed: the reading progress line (tier colour into the accent), progress traces, the 2 px top edge of tier cards, and a vertical sheen on the one primary button (the accent 6% lighter at the top, 6% darker at the bottom, with an inset highlight). Not allowed: gradient text, gradient borders around whole cards, animated gradients.

### Light mode

The same structure, paler: field alphas from the light column, white glass at 62% with the softer shadow, tier colours from the light column. Both modes are checked at every release.
