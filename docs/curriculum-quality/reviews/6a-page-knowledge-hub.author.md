# 6a page: /knowledge-hub — author log

## What was built

- **Concept graph derived from the curriculum** (`src/lib/knowledge-graph-engine.ts`). The 15 hand-written placeholder nodes are gone. Nothing is placed by hand:
  - **Modules (69):** built from the generated curriculum data, which comes from `curriculum.manifest.json`. Each module carries its tier, lane, track and milestones, and links to its lessons.
  - **Sub-lessons (43):** one node each. The 69 overview (`index`) lessons are represented by their module node.
  - **Edges:** every manifest prerequisite becomes a `PREREQUISITE` edge. A test checks that the two sets are equal. The other edge types are `CONTAINS` (module → lesson), `TAUGHT_IN` (term → lesson) and `RELATED` (term ↔ term).
  - **Queries:** `analyzeDependencies` (study first, leads to, related terms or terms taught), `prerequisiteClosure`, `mapLanes`, `moveInMap` (map keyboard model) and `curriculumOrder`. There is also `getLinkableConcepts()`, which returns key terms only.
  - **Build:** the graph is built once at module load, so the page stays static.
- **Key terms (101)** (`src/lib/concept-terms.ts`):
  - Taken from spine §5.1 canonical terminology, using its spellings, and from the "Must cover" lists of the module intent cards.
  - Each term lists the lessons that teach it. Its tier is the tier of the earliest of those lessons. For example, UVM phasing is now Intermediate; the old graph said Advanced.
  - Descriptions are my own wording.
- **Hub UI:**
  - **Module map** (`src/components/knowledge/ModuleMap.tsx`). One tier at a time, with lanes as columns and modules in manifest order.
    - Keyboard: roving tabindex; arrow keys move up and down a lane and across lanes; Home and End jump; Enter or Space selects.
    - Each button has `aria-pressed`. Markers are text plus a glyph: "▲ first" for a direct prerequisite, "▼ next" for a dependent. Electives have a dashed border.
    - A polite live status reports the selection.
    - The details panel lists the module's tier and milestones, Study first and Leads to (these follow prerequisites across tiers), everything the module builds on, its lessons, and its key terms (which open ConceptModal).
    - At 390 px only module codes show in the buttons; titles stay available to screen readers and appear from `sm` up.
  - **Searchable list** (`ConceptList.tsx`). This is the accessible fallback.
    - Labelled search, kind and tier filters (SegmentedControl), and a live result count.
    - Each entry shows the kind, tier and "first taught in". Terms show "Taught in" lesson links; modules have a "Show on the map" button.
    - Results load 40 at a time.
  - **Old components deleted:** `KnowledgeGraphVisualizer` (d3 force graph), `LearningPathGenerator` and `ConceptDependencyAnalyzer`. Only the hub used them.
- **ConceptLink and ConceptModal now use the same graph.**
  - `KnowledgeContext` serves the graph synchronously, so a link works on its first render.
  - The modal shows the kind, tier and "first taught in". It lists the lesson links, Study first (the modules' manifest prerequisites) and related terms, which open in place.
  - Tab cycles through every control inside the modal. A link closes the modal, and focus returns to the trigger.
- **Page** keeps the `SITE_FEATURES.draftPages` gate for the integrate step and has no `dynamic` export. It now has metadata, and its comment no longer says "placeholder".

## Sources verified

- **Manifest and graph:** `content/curriculum/curriculum.manifest.json` and `src/lib/curriculum-data.tsx`. Tests check modules, order, tiers, tracks, milestones, lessons and prerequisites against the manifest.
- **Terms in lessons:** `tests/lib/knowledge-graph-engine.test.ts` reads each `taughtIn` lesson's MDX and requires the term's name or an alias to appear in it. All 101 pass.
- **Run-time phases:** "twelve phases from pre_reset through post_shutdown, §9.8.2" checked in IEEE 1800.2-2020 (`uvm_lrm.txt`, uvm_run_phase text: "runs in parallel to the run-time phases, uvm_pre_reset_phase through uvm_post_shutdown_phase (see 9.8.2)").
- **4KB rule and its reasons** checked in IHI0022E (`arm_axi.txt`): a burst must not cross a 4KB boundary; this prevents a burst crossing between two slaves and limits the address increments a slave must support.
- **Delta cycle wording** follows F3C/F3A: the §4.5 loop, zero simulated time, and the LRM does not use the word.
- **Other definitions:** clocking-block, NBA and concurrent-assertion sampling follow the lesson wording. No new clause numbers, APIs or URLs were introduced.

## Verilator

`verilator --version` reports Verilator 5.052. No SystemVerilog file was written or changed for this item, so nothing needed compiling.

## Validation

- **Vitest** (`NODE_OPTIONS='--require @prisma/client' npx vitest run …`):
  - Passed: knowledge-graph-engine (122), knowledge-hub-page (9), ConceptLinkModal (4), remark-concept-links, LessonMdxPipeline, lesson-context and mdx-render-smoke.
  - Failed: `tests/app/sitemap.test.ts` "hides every hidden page", because of `/resources` (another item's page). `/knowledge-hub` still passes it.
- **TypeScript:** `npx tsc --noEmit -p .` is clean.
- **ESLint:** `npx eslint` on all touched files is clean.
- **MDX:** no MDX was touched.
- **Browser:** no browser check at 390 px. Running a server is not allowed in this step, so the 390 px layout was checked only by reading the CSS (the grid uses `minmax(0,1fr)` columns, controls are at least 40 px tall, and only module codes show below `sm`).

## Shared-file requests

1. **`src/app/(learning)/curriculum/[...slug]/page.tsx`** (line 72) and **`tests/curriculum/mdx-render-smoke.test.tsx`** (line 173): use `getLinkableConcepts()` instead of `(await getFullKnowledgeGraph()).nodes`. This passes key terms only. It changes nothing in practice, because module and lesson names carry a code prefix that never matches prose, but it keeps the matcher small. Also update the comment there, which still calls the graph a placeholder.
2. **`src/lib/curriculum/remark-concept-links.ts`:** link only the first occurrence of each concept per lesson. Terms such as "queue", "driver" and "monitor" would otherwise be linked dozens of times in a lesson that opts in. Also update its doc comment, which still says "placeholder".
3. **`src/lib/curriculum/lesson-frontmatter.ts`** (lines 16–17): replace the "15-node placeholder with wrong tiers" comment.
4. **`src/lib/site-features.ts`** (line 29): the `draftPages` comment lists /knowledge-hub as a placeholder page.
5. **Integrate step:** unhide /knowledge-hub (remove the gate in `page.tsx` and from `HIDDEN_PAGES` in `tests/app/sitemap.test.ts`), then add it to the navigation and the sitemap. Also update `tests/app/knowledge-hub-page.test.tsx`, which pins the 404 while draft pages are off.
