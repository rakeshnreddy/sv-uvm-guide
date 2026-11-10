# Design contract: the verification bench

This is the single source for every design decision in the refresh. Builders implement from it and reviewers check against it. If something here conflicts with a finding's suggested fix, this document wins. Owner decisions taken on 2026-11-10: the bench direction, IBM Plex Sans, two modes (Light, Dark, System), the name "SV/UVM Hub", MIT licence wording, and "Start lesson 1 / Continue" as the landing primary action.

## 1. What the site should feel like

- **Product.** A free, long-form SystemVerilog, UVM and AMBA verification course for engineers from their first testbench to staff-level interviews, with progress kept in the learner's own browser.
- **Character.** Exact, patient, quietly technical.
- **World.** A verification engineer's bench during a regression run: a waveform viewer with named signals, the simulator log, the standard open beside it.
- **Moments.** The interactives and diagrams carry the rich colour. Everything around them is quiet.
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

Each status role also gets a `-subtle` background: the role colour at 12% opacity over the surface.

Rules:

1. Headings and body text use `text-foreground`. A heading is never set in the accent or a status colour.
2. The accent marks what is clickable or current. One filled accent button per view; every other button is the secondary style (raised surface, hairline border, primary text).
3. A current or selected item is a raised surface with a 2 px accent marker on its leading edge and primary text. This is the same in the outline, the menus, the table of contents and tabs.
4. No hue gradients, gradient text, glass panels, colour washes, glows or coloured shadows anywhere in the chrome. Dark mode has no shadows; depth comes from the surface steps and hairlines. Light mode may use `0 1px 2px rgb(16 24 40 / 0.05)`.
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
| `h1` | 32/40, 28/36 on phones | 600 | -0.015em | page title, one per page |
| `h2` | 24/32 | 600 | -0.01em | section |
| `h3` | 19/28 | 600 | 0 | subsection |
| `h4` | 16/24 | 600 | 0 | minor heading |
| `lead` | 18/28 | 400 | 0 | one-paragraph page intro, secondary colour |
| `body` | 17/29, 16/27 on phones | 400 | 0 | lesson prose, at most 68 characters per line |
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
- Borders are 1 px hairlines in `--border`.
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
- `next-themes` runs with `enableSystem`, default `system`, and falls back to dark when the device states no preference. Old stored values (`default-dark`, `ocean-light` and the other eight) keep working: they map to the matching mode through the provider's value map, and learner-data backups that contain an old id import cleanly.
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
