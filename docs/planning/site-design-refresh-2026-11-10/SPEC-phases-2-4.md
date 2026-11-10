# Build specification for phases 2 to 4

This extends `DESIGN.md` (the contract) with the concrete shapes for navigation, page structure and the landing page. It is written by the lead so that builders in different packages produce one design. `DESIGN.md` wins on any rule of colour, type, shape or motion.

## Phase 2: navigation

### One source for names and links

`src/lib/site-links.ts` exports `SITE_NAME = "SV/UVM Hub"` and one navigation config. The navbar, phone menu, public header, footer, breadcrumbs and page titles read it. No component types a destination's label or href by hand.

- Title template: `%s | SV/UVM Hub`. Default title: `SV/UVM Hub: SystemVerilog, UVM and AMBA verification`.
- A destination has one label everywhere. The page's H1 may be longer but starts with that label.

### Top navigation (learning area)

| Item | Kind | Children |
|---|---|---|
| Curriculum | link to `/curriculum` | |
| Practice | disclosure | Practice hub, Labs, Exercises, Interactive models, Waveform Studio |
| Interview prep | link | |
| Reference | disclosure | Knowledge hub, Resources, Projects, Learning strategies, History |
| Dashboard | link to `/dashboard` | (Review, Notebook, Self-assessment and Settings stay in its own tab strip) |

- "Start here" is removed from the bar. The route chooser is on `/curriculum` and the landing page.
- All five items show from 1024 px. Below 768 px they are in the phone menu, with each disclosure's children listed under a group label.
- Current state: Curriculum on `/curriculum/**`; Practice on `/practice/**`, `/exercises/**` and `/visualizations/**`; Reference on its five routes; Dashboard on `/dashboard/**`, `/settings` and `/assessment`. The current item follows the contract's rule for current items (primary text, weight 500, 2 px accent underline).
- Disclosures follow the WAI-ARIA disclosure pattern the existing "More" menu uses: a button with `aria-expanded`, a panel of links, Escape closes and returns focus, focus leaving the panel closes it.

### Header layout

- One row, 64 px tall, hairline below. Left: outline toggle (lesson pages) and the wordmark. Then the search field (grows, at most 420 px). Then the navigation. Right: the theme control.
- The header lines up with the page: when the course outline is docked, the header's left slot is as wide as the outline, so the wordmark sits over the outline and the search field starts at the main column's left edge. On pages without the outline, the header content uses the same container and gutters as the page below it.

### Public header (landing page, privacy, terms)

Skip link, wordmark, three plain links (Curriculum, Practice, Interview prep), a search button that opens the search dialog, the theme control, and one accent button: "Start learning", which becomes "Continue" once the browser holds a lesson position (a small client island with its width reserved). Below 768 px: wordmark, search button, menu button; the menu lists the same links and the theme choices.

### Course outline

- Docked: the outline only, with no repeated site links. Its tier heading links to that tier's section of `/curriculum`.
- Phone drawer: the outline plus one "Curriculum overview" link at the top.
- Module codes render as signal tags (contract section 8).

### Breadcrumbs

One component taking `{ label, href? }[]`, rendered as a plain text row with chevrons inside `nav[aria-label="Breadcrumb"]`, no card. The last crumb is the current page (`aria-current="page"`, primary text). Below 640 px it shows one back link to the parent. It is used on every page below the top level: lessons, labs, visualizations, exercises, dashboard sub-pages, expert index.

### URLs

- `/curriculum/<Tier>` answers with a temporary (307) redirect to that tier's section of `/curriculum`.
- `/exercises`, `/labs`, `/practice/lab`, `/practice/visualizations` and `/visualizations` redirect to the matching section of `/practice`. Item URLs do not change.
- `/community/test-page` is deleted.

### Search

The index covers lessons and their sections (as today) plus labs, exercises, interactive models and tools, interview question banks and the reference pages. Each result shows its kind as a small label. Lessons rank first for equal matches. Placeholder: "Search lessons, labs and practice".

### Footer

Four link groups and one closing line.

- Learn: Curriculum, Tier 1 to Tier 4, Find your level, Expert index
- Practice: Practice hub, Labs, Exercises, Interactive models, Interview prep
- Your learning: Dashboard, Review, Notebook, Self-assessment, Settings
- Reference: Knowledge hub, Resources, Projects, Learning strategies, History
- Closing line: the site name, "MIT licensed", Source on GitHub, Privacy Policy, Terms of Service.

### Practice pager

Every practice tool page ends with "Back to Practice: <section>" and previous and next within the same kind, styled like the lesson pager.

### Worker cost of the home page

The home page misses OpenNext's cache interception because its path normalises to an empty string, so every view loads the full server (see `worker-1102-report.md`, option 2). Fix it so `/` is served from the prerendered cache like every other page, and prove it with a local production build: the response for `/` carries `x-opennext-cache: HIT`.

## Phase 3: page structure

### Primitives (in `src/components/layout/` and `src/components/ui/`)

- **PageShell** `width="reading" | "content" | "wide"`: 768, 1152 or 1280 px, centred, page gutters from the contract. Inside the learning layout it adds no second container.
- **PageHeader**: a `<header>` with optional breadcrumbs, an eyebrow (signal tags or a label), the title in `text-h1`, a lead paragraph (at most 65 characters per line, secondary colour), a meta row, actions on the right, and an optional tab strip. A hairline closes it. No card, no background.
- **Section**: a heading in `text-h2` with an optional one-line description; 48 px between sections.
- **Card** variants: `surface` (card background, hairline), `interactive` (surface plus hover: raised background and a stronger border), `inset` (raised background, no border), `callout` (2 px role-coloured leading border and the role's subtle fill).
- **Badge** variants: `code` (the signal tag), `status` (a 6 px dot plus a label), `level` (Core, Elective, Expert as quiet outlined text), `count` (mono, tabular), `filter` (a toggle chip).
- **Prose**: lesson and article text. Text children are capped at 68 characters; figures, tables, code and interactives use the full column.
- **SignalTag**: contract section 8.

### Lesson page

- Header, unboxed: breadcrumbs; signal tags for tier and module; the title; the lead; a meta row (reading time, "Lesson k of n", "Builds toward" with milestone tags); "Before you start" as one inline row when there are no prerequisites and a short list when there are. A hairline below.
- Article: no card. The four layer headings (H2) each start a band: a hairline above, 56 px of space, 28/36 at weight 500. Section headings (H3) are 19/28 at 600. A reader scanning the page can tell a layer from a section at a glance.
- Table of contents: follows the reader (the active entry scrolls into view inside the panel), layer groups collapse, the group holding the active entry is open, Expert entries carry a quiet tag.
- Reading progress: a 2 px accent line along the bottom edge of the header from 1280 px; below that, one 44 px sticky bar under the header showing "On this page: <current section>" that opens the contents as a sheet and carries the same progress line.
- Code blocks: highlighted at build time, on the code surface, with a language label, a copy button, and for listings over 40 lines a 28 rem window with "Show all N lines".
- Interactives: each sits in an error boundary that shows "This interactive failed to load" with a retry, and loads into a placeholder of the right height carrying its title.
- End of lesson: a "Next" block. The next lesson is the one accent action. Beside it, quieter: the lab for this module if there is one, and "Review flashcards" when the module has a deck.

### Progress trace

`ProgressTrace` draws progress through a tier as a signal: one segment per module, low for not started, half height with a dashed top for opened, high for done; a thin accent cursor marks the module the learner is in. Each segment is a link to its module with a text label for assistive technology, and the legend gives the three states in words. It appears full size on the dashboard and as a one-line miniature in each tier heading of the curriculum index.

### Other pages

- The shared info-page template is rebuilt on PageShell, PageHeader and Prose.
- Practice hub: labs as compact rows grouped by tier (signal tag, title, one-line outcome, state), not tall cards with empty space.
- Interview prep: a level filter (Junior to Senior staff) kept in the browser, jump links per bank, questions collapsed until opened, and the page's data loaded so the prerendered payload is small (it is 8.1 MB today).
- Curriculum index: the route cards become one compact strip; the module list starts within the first screen and a half; the milestone ladder becomes one line of milestone tags.
- Dashboard: "Continue" first, then reviews due, then the progress traces, then the rest.

## Phase 4: landing page

Section order, top to bottom:

1. **Public header** (phase 2).
2. **Hero**, an asymmetric split on the plain page background, no eyebrow pill.
   - Left: the headline in `text-display`, "SystemVerilog and UVM, one clock edge at a time". Below it one factual paragraph built from data: "A free course in SystemVerilog, UVM and AMBA verification: <lessons> lessons in <tiers> tiers, with interactive models you step through, <labs> guided labs and interview prep. No sign-up. Your progress stays in this browser." Then two actions: the accent button "Start lesson 1" (it becomes "Continue: <lesson>" for a returning learner; width reserved) and the secondary "Find your level" with a quiet note, "10 questions, about 6 minutes".
   - Right, at least half the width from 1024 px: one real frame of the scheduler model, server-rendered and static: the region ladder with one region marked as executing, a short code trace with its current line, and a small waveform, all generated from the same model data the live interactive uses. Caption: "One time slot, region by region" with a link, "Open the live model", to the lesson that holds it. On phones the frame comes after the actions and is simplified (ladder and code only).
3. **Proof strip**: four facts in one row, numbers in the mono face with tabular figures, all from data: lessons and tiers, interactive models, guided labs, and the standards the lessons cite.
4. **Returning learner strip**, shown only when the browser holds progress: "Pick up where you left off" with the continue card, reviews due, and a miniature progress trace for the current tier.
5. **See it run**: one live interactive, mounted only when it scrolls into view, with a link to its lesson.
6. **Routes**: the three routes as a compact strip: name, who it is for, lesson count, one action each, and "Compare the routes" linking to `/curriculum`.
7. **What you can practise**: four cards with real static thumbnails drawn from the components themselves and link text that names the destination.
8. **Footer** (phase 2).

Rules for the page: one content width; every section visible in the server HTML; no animation library; the only accent fill above the fold is the hero's primary action.

Metadata: a description built from the same counts; a social image and an app icon. The mark is one clock pulse (a low line, a rising edge, a high line, a falling edge) drawn as a 2.5 px accent stroke on the dark page colour in a rounded square.
