# Task for Codex: redesign the visuals of the Tier 1 lessons, one lesson at a time

You are taking over one workstream of this repository for a long, uninterrupted run. Work until your usage window
is spent. Another engineer (Claude) reviews everything you produce afterwards and has very little budget for it, so
your work must prove itself: every lesson you finish must pass one gate command, and you must leave before and after
images and a short report for each.

Read `AGENTS.md` first (project rules), then this file to the end before you touch anything.

## 1. What this is about

The site teaches SystemVerilog and UVM. Its owner wants every visual on it designed on purpose. In the owner's words:

- "i need to see the intentionality, colors, themses, 3d elements, glassy panel themes wherever possible."
- "i want the same intentionality for every visual element. spend time to design it and review it."
- "for rest of them do not miss these kind for all the other lessons."

The look is decided and already live. Lesson 1 is finished and is your reference implementation:

- The rules: `docs/planning/site-design-refresh-2026-11-10/DESIGN.md`, section 14 "Figure art direction" (read all
  of it: the six rules, the tokens, the classes, "Hand-drawn figures", "The first lesson, drawn by hand (F1A)",
  "Floors and fallbacks", "Forbidden"), and section 13 for the figure tokens.
- The protected colour meanings: `docs/visual-learning/visual-language.md`.
- The plan and what "done" means for a lesson: `docs/planning/site-design-refresh-2026-11-10/FIGURES-PLAN.md`
  ("No visual left behind" and "The weekly routine").
- The reference lesson: `content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx` and the components of
  its six interactives (`InteractiveCostOfBugGraph`, `DesignGapChart`, `FixPathDecisionLab`, `HallOfShameCarousel`,
  `ShiftLeftTimeline`, `BoundaryProbe`). Open the live page and look at it before you draw anything:
  `https://sv-uvm-guide.rakesh-n99.workers.dev/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index`
- The scripts that drew and checked lesson 1: `docs/planning/site-design-refresh-2026-11-10/reference-scripts/`
  (generators, a word proof, pixel contrast and text-size measurement, screenshots). They are examples tied to
  lesson 1, with placeholder paths; reuse their methods, do not run them as they are.
- If the `unslop` skill is installed for you, use it for every design decision.

In one paragraph: a figure is an instrument panel. It sits in a glass panel with a title strip. Its parts are lit
objects with depth (a gradient in their own hue, a rim, a shadow). Strength follows hierarchy, and exactly one part
is the focal part: the part that carries the figure's one idea. Ordered scales (cost, time, severity, stage) use the
fuchsia ramp. A subject with real layers or levels is drawn in space (isometric). Protected colours keep their
meaning everywhere: slate = 0, cyan = 1 and active or selected, rose = X, error and mismatch, amber = Z and
testbench, violet = design, indigo = multi-bit, teal = expected, emerald = match.

## 2. Ground rules (breaking one of these fails the review)

1. Work on a new branch `codex/figures-t1`, cut from `curriculum-quality-program`. Never commit to or push
   `main` or `curriculum-quality-program`. You may push your own branch. No force pushes, no rebases of shared
   branches, no `git stash` left behind.
2. Never edit `TASKS.md`, anything under `docs/curriculum-quality/data/`, `.env*`, or CI configuration. Do not add
   dependencies. Do not run `npm ci` or delete `node_modules`.
3. **No words change.** Every label, number, caption, title, description, aria attribute, quiz key, feedback string
   and sentence of prose stays exactly as it is. You change how things are drawn, never what they say. If you
   believe a sentence is wrong, write it in your report; do not fix it.
4. **No behaviour changes.** Interactives keep every control, state, result, keyboard path and model. Files under
   `src/lib/` that hold an interactive's model or data must stay byte-identical.
5. **Do not change the shared look.** Do not edit the figure tokens or shared figure rules in
   `src/app/globals.css`, `tailwind.config.ts`, or the diagram kit (`src/components/visual-system/**`,
   `src/components/mdx/DiagramKit.tsx`). Use the existing tokens and classes. If something is truly missing, build
   it inside the component or figure from existing tokens and list it in your report under "Kit requests".
6. Figure tokens and existing classes only. No literal colours (`#hex`, `rgb()`, Tailwind palette colours such as
   `text-cyan-400`) in anything you draw.
7. Both themes, always. Text at least 4.5:1 and marks at least 3:1 against what is behind them, measured from
   rendered pixels. Text at least 11 px at a 390 px wide viewport in every hand-drawn figure and interactive
   visual you redesign (give a figure a second, phone composition when the column one cannot hold 11 px, as
   lesson 1 does). Forced colours, print and reduced motion must still work.
8. One lesson per commit, and only when that lesson passes its gate (section 5). Never commit a half-done lesson:
   if you cannot finish one, restore its files and say so in the log.
9. A lesson is done only when **every** visual in it is in the new look: every hand-drawn `<svg>` (also inside
   recap cards, callouts, tables and `<details>`), every kit diagram, every interactive's visual, every other
   picture. Zero left behind.

## 3. Setup

```bash
git checkout curriculum-quality-program && git pull --ff-only
git checkout -b codex/figures-t1
npm run dev        # the site on http://localhost:3000; keep it running in the background
```

Use standalone Node scripts with Playwright for all browser work (`node script.cjs`; Playwright is in
`node_modules`). Do not use the Playwright test runner for this task. The theme is set by `next-themes`:
`localStorage.setItem('theme', 'dark' | 'light')` before load. The first visit to a page compiles it and can take a
minute.

Keep a running log in `docs/planning/site-design-refresh-2026-11-10/CODEX-RUN-LOG.md` and update it after every
task and every lesson (what you finished, the gate result, what is open). Write it as you go, so that if your run
is cut off the log is still true.

## 4. Task 0: build the gate (do this first; it is the premise everything else rests on)

Write `scripts/figure-gates.cjs`: one command that proves a lesson is done.

```bash
node scripts/figure-gates.cjs <lesson.mdx> --base <git ref of the lesson before its redesign> [--url http://localhost:3000]
```

It prints one PASS or FAIL line per gate with the numbers behind it, writes the same as JSON to
`docs/planning/site-design-refresh-2026-11-10/reports/<lesson-slug>.json`, and exits non-zero if any gate fails.
The gates:

| Gate | What it checks |
|---|---|
| G1 inventory | Lists every visual in the lesson from the source and from the rendered page (open every `<details>`): hand-drawn `<svg>` figures, kit diagrams, interactives, other pictures. Each is marked "new look" or "old". PASS only if none is old. Decide "new look" by evidence in the DOM (the figure panel and stage classes, figure tokens in use, no literal colours), not by a hand-kept list. |
| G2 words | For every figure: the set and order of its text strings, its `<title>`, `<desc>`, `<figcaption>`, caption props and aria attributes are identical to the base ref. A figure drawn twice (column and phone) must carry the same strings in each. The lesson's prose outside figures is byte-identical to the base, once the keys this work may add are removed (`focus`, `role`, the placeholder height props). |
| G3 interactives unchanged in substance | For every interactive embedded in the lesson: its model and data files under `src/lib` are byte-identical to the base; its visible text in the default state (the root's `innerText`, whitespace-normalised) equals a capture taken at the base ref. Provide `--capture-base` to record that capture before you start a lesson. |
| G4 render | `node scripts/check-mdx.mjs --render <lesson>` reports 0 errors. |
| G5 contrast | In dark and in light, at 1440 and at 390 wide: every text in every redesigned visual is at least 4.5:1 and every mark at least 3:1 against the pixels behind it (sample rendered pixels; see `reference-scripts/contrast4.cjs`). |
| G6 text size | At 390 wide, no text in a hand-drawn figure or a redesigned interactive visual renders under 11 px. Kit diagrams are exempt (a known limit of the kit on phones). |
| G7 no literal colours | The lesson's figure markup and the changed component files contain no `#hex`, `rgb(`, `hsl(` with literal numbers, or Tailwind palette colour classes. |
| G8 heights | `node scripts/measure-lazy-interactive-heights.cjs --lessons <every lesson that embeds an interactive you changed> --bands desktop,mid,phone` has every embed within 4 px of its reserved height. |
| G9 tests | `npx tsc --noEmit` is clean; `npx vitest --run` passes for `tests/app/theme-contrast.test.ts`, `tests/components/DiagramKit.test.tsx`, `tests/lib/diagram-layout.test.ts`, `tests/components/lazy-mdx-heights.test.ts` and every test file that mentions the lesson or a component you changed; `npx eslint` is clean on changed files. |
| G10 no page errors | Loading the lesson and scrolling it top to bottom in both themes logs no console error and no figure scrolls the page sideways at 390 or 1440. |

Add unit tests for the gate's pure parts (string extraction, the literal-colour scan) under `tests/scripts/`.

**Acceptance for Task 0 (verify it yourself and paste the output into the log):**

1. `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx --base cb80965f`
   passes every gate. Lesson 1 is finished and live, so a failure here is a fault in your gate, with two known
   exceptions you must report rather than hide: the cost chart's axis labels are under 11 px, and G3's base capture
   cannot be taken for lesson 1 (skip G3 for it with an explicit `--skip G3` flag that prints SKIPPED).
2. On an unfinished lesson (`.../F1B_The_Verification_Mindset/index.mdx --base HEAD`) G1 fails and names each old
   visual.
3. Prove the gate bites: on a scratch copy of lesson 1 change one label, add one literal colour, and shrink one
   text; G2, G7 and G6 must each fail. Record the three outputs.

Commit Task 0 on its own: "Figures: a gate command that proves a lesson's visuals are done".

## 5. Tasks 1 to N: the lessons, in this order

Do them one at a time, in order, each to completion. Counts are from the figure scan (hand-drawn svg / kit
diagrams / distinct interactives):

| # | Lesson file under `content/curriculum/T1_Foundational/` | svg | kit | interactives |
|---|---|---|---|---|
| 1 | `F1B_The_Verification_Mindset/index.mdx` | 3 | 5 | 7 |
| 2 | `F1C_Why_SystemVerilog/index.mdx` | 1 | 7 | 5 |
| 3 | `F2A_Core_Data_Types/index.mdx` | 9 | 8 | 14 |
| 4 | `F2A_Core_Data_Types/structs-unions-enums.mdx` | 7 | 4 | 2 |
| 5 | `F2A_Core_Data_Types/operators-and-expressions.mdx` | 5 | 3 | 5 |
| 6 | `F2B_Dynamic_Structures/index.mdx` | 15 | 4 | 7 |
| 7 | `F2C_Procedural_Code_and_Flow_Control/index.mdx` | 4 | 6 | 5 |
| 8 | `F2C_Procedural_Code_and_Flow_Control/flow-control.mdx` | 2 | 5 | 5 |

If you finish all eight, continue with `F2D`, `F2E`, `F3A`, `F3B`, `F3C`, `F4A`, `F4B`, `F4C` in that order.

### The steps for each lesson

1. **Capture the base.** Run the gate with `--capture-base`, and take "before" screenshots of every visual in dark
   and light at 1440 (crop to the visual).
2. **List every visual** (G1's list) and, for each, write one sentence: the one idea it must make, taken from its
   caption and the prose around it. Put this in the lesson's report before you draw.
3. **Design each visual around that idea.**
   - *Hand-drawn figure:* redraw it with the figure tokens and the constructions lesson 1 established (plates,
     trays, the ramp, lit lines, isometric stacks). Keep its viewBox aspect unless a phone composition is needed.
     Wrap it in the same glass panel and title strip as lesson 1's figures. Choose the focal part and say why.
   - *Kit diagram:* it already has the look. Set `focus="<node id>"` when the caption is about one part, and
     `role: "design"` or `role: "testbench"` on generic parts only when the lesson's own words place the part on
     that side (quote the sentence in the report). Run
     `python3 docs/curriculum-quality/workflows/figure-guard.py --base <ref> --strict <lesson>` on a copy that has
     only the kit edits if you need to check them in isolation.
   - *Interactive's visual:* restyle the chart, diagram, timeline or stage with the tokens: a stage with depth, the
     parts that carry the idea as lit objects, the focal part as the current answer, step or selection, the ramp
     for ordered scales, protected colours for states with their existing non-colour cues. The ordinary controls
     keep the site's UI style. An interactive is shared by several lessons: redesign it once, and re-measure every
     lesson that embeds it (find them with `grep -rl "<Name" content/curriculum`).
4. **Heights.** If an interactive's rendered height changed, update its entry in
   `src/components/mdx/lazy-mdx-interactives.ts` and the pinned values in
   `tests/components/lazy-mdx-heights.test.ts` from the measuring tool's output (see the file's comments).
5. **Review your own work as a different person would.** After the lesson passes the gate, do a separate pass with
   these three lenses and write the findings and what you changed into the report:
   - *Design:* does each visual make its one idea in two seconds; is there one focal part; do parts read as lit
     objects or as grey boxes with an accent; is anything muddy, crowded, floating or generic; is light mode as
     strong as dark; do the lesson's visuals read as one family with lesson 1?
   - *What it teaches:* is every sentence of the caption, description and nearby prose still true of the drawing;
     does the drawing imply anything the lesson does not say (sizes implying ratios, an order, a count); are the
     protected colours used only for their meanings?
   - *Robustness:* 1440, 1280, 768 and 390 wide; forced colours; print; reduced motion; keyboard and focus rings.
6. **Evidence for the reviewer.** In `test-results/design-previews/codex/<lesson-slug>/` (not committed) save
   `sheet-dark.png` and `sheet-light.png`: one image each, a grid with every visual of the lesson before (left)
   and after (right), labelled with the visual's title. In
   `docs/planning/site-design-refresh-2026-11-10/reports/<lesson-slug>.md` (committed) write: the list of visuals
   with each one's idea, focal part, and which colours and why; the gate's final output; every test expectation
   you changed and why; your review findings; "Kit requests"; anything not done.
7. **Gate, then commit.** Run the gate; all PASS. Commit the lesson: "Figures: <lesson> in the new look", with the
   gate summary in the message body. Update the run log. Start the next lesson.

### Design constructions you should reuse (all are in lesson 1's source)

- Stage plates with a ramp cap for an ordered sequence; trays that group plates; a lit dashed line for a boundary.
- Isometric stacks and ladders for layers and levels; hatched and lit for "changed", solid for "kept", dashed
  wireframe for "absent".
- Two lanes on one axis for before and after; rose ✕ marks for errors; an emerald block for what passes.
- A cursor column in cyan for the selected item of a chart; all other bars at full ramp strength.
- A recessed well for what is outside the main group.

Do not invent a new colour meaning. If a visual needs a category colour that the protected meanings and the ramp do
not cover, keep those parts neutral glass and distinguish them by label, shape or position.

## 6. Using your window well

- Start Task 0 immediately; it is small beside the lessons and everything depends on it.
- Never wait idle on a long measurement: start it in the background and continue with the next visual.
- Commit after every lesson, so a cut-off loses at most the lesson in progress.
- If a gate cannot pass for a reason outside your rules (a kit limitation, a wrong sentence in the lesson), do not
  weaken the gate. Record the exact failure in the report under "Blocked", restore that visual to its original,
  mark the lesson "not done" in the log, and move to the next lesson.
- Do not start a lesson you cannot finish. If your remaining budget is clearly too small for the next lesson, stop
  and finish the log instead.

## 7. Your final message

End with a report the owner can paste to the reviewer:

1. The branch name and the list of commits (`git log --oneline curriculum-quality-program..HEAD`).
2. A table: lesson, number of visuals, gate result (the final line of each gate), report path, sheet paths.
3. Every test expectation you changed, every "Kit request", everything blocked or not done.
4. The exact commands the reviewer should run to verify: for each finished lesson,
   `node scripts/figure-gates.cjs <lesson> --base <ref>`.
