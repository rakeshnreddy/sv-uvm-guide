# Figures: every visual designed on purpose, a few lessons a week

Written 2026-11-15 at the end of the week's work. `TASKS.md` is unchanged; this file records the plan and the
proposals for the figure work only.

## What the owner asked for

In the owner's words, in order, on 2026-11-15:

1. "many graphs, visuals, block diagrams, illustrations are pretty bland with no color just black an white ... make it
   colorful, functional and aesthetic."
2. After the first colours went live: "i still see black and white in 1st lesson fixing silicon, the cost and delay of
   the same fix grow diagram and others. they seems to have been added with no intentionality to it and are generic. i
   need to see the intentionality, colors, themses, 3d elements, glassy panel themes wherever possible."
3. "i want the same intentionality for every visual element. spend time to design it and review it. also for already
   completed ones as well."
4. "let's target few lessons every week while continuing and closing rest of the tasks in parallel. as visual
   enhancemnt for later lessons can come later and not entirely a functional failure for user."

So: every visual on the site, including ones already shipped, is designed around its one idea and then reviewed
independently. The work goes lesson by lesson in the order a learner meets the lessons, a few each week, alongside the
other open tasks.

## What is live, and why it is not enough

Checkpoint 29 (`cb80965f`) put a first pass live:

- the diagram kit (architecture, timing and sequence diagrams) draws roles, values, edges and states in theme-aware
  figure tokens (`DESIGN.md` section 13);
- 539 diagram parts in the 112 lessons carry a design or testbench role;
- the legend lists every colour in use;
- literal colours in hand-drawn figures follow the theme.

It is one rule applied everywhere. No figure has a focal point, depth or a panel, and two kinds of visual got nothing:
the hand-drawn figures that draw in one colour (about 80 of 313) and the visuals inside interactives. Lesson 1 has
eight hand-drawn figures, two kit figures with no roles and six interactives, so it was still black and white.

## The art direction (preview, not released)

Branch `figures/art-direction` (commit `9160d480`, on top of `cb80965f`). The rules are `DESIGN.md` section 14 on that
branch. In short:

- A figure is an instrument panel: a glass panel with a title strip and a legend strip of chips.
- Parts are lit objects: a gradient in their own hue, a rim, a shadow. Strength follows hierarchy: only the focal,
  selected or state part is fully lit; the rest sit at 40 %.
- One focal part, and only when the figure names it (`focus="<node id>"` on a kit figure) or a state marks it. A rule
  that guessed the focal part was tried and removed: of 27 guesses, 7 pointed at the wrong part and 6 were arbitrary.
- Parts with no role are neutral glass. A tier tint was tried and removed: in Tiers 3 and 4 it read as a role.
- Ordered scales (cost, time, severity) use a fuchsia ramp, the one hue family no protected meaning uses.
- Isometric drawings where the subject has layers.
- Two settings: rich (the default) and calm (flat parts in the glass frame).

Five visuals of lesson 1 were redrawn to it, with every text string unchanged, and each was reviewed independently
(the first three through three lenses with a recheck; the last two by one reviewer, with fixes and no recheck):

- "Where a bug can be found": five stage plates on the cost ramp, divided by a lit tape-out line.
- "Which mask layers change for each kind of fix": three isometric stacks; hatched and lit for new masks, solid for
  reused, dashed wireframe for none yet.
- The chart in `InteractiveCostOfBugGraph`: ramped bars, the selected stage in a lit cursor column.
- "The cost ladder with the three fix routes after tape-out" (the recap strip): the five-stages plates with their
  numbers, and the three fix routes hanging on the tape-out line.
- "Which masks change for each of the four decisions": the mask-layer stacks, one per decision.

Before and after images (both themes) were sent to the owner on 2026-11-15; copies are in
`test-results/design-previews/figures-art/` (not committed).

### Reviewed, and what is still open

Three independent reviewers (design; what each figure teaches; robustness) found 38 items: 1 serious, 20 material, 17
small. A fixer addressed them and a fourth reviewer rechecked. Open after the recheck:

1. Six interactives that embed kit figures render 15 to 63 px taller than their reserved heights (the legend is now a
   strip of chips): FirstBugHuntGame, SelfCheckBenchLab, TimeSlotTraceVisualizer, TemporalLogicExplorer,
   SvaSequenceWaveformVisualizer, TlmConnectionBuilderVisualizer. About 30 components embed kit figures; all need
   measuring again with `scripts/measure-lazy-interactive-heights.cjs` after the branch is rebased.
2. (Closed on the branch after the review: in the calm setting ramp marks now keep 3:1, pinned by a test.)
3. The cost chart's controls still move when a stage is picked at 1280 px wide and on phones (fixed at 1440 and 1100).
4. Only four kit figures name a focal part. The teaching review counted 21 more where the right part is clear, but
   its list was not kept as data; redo that check lesson by lesson.
5. Four of lesson 1's eight hand-drawn figures are not redrawn (the verification lifecycle, shift left, the career
   ladder, 100% coverage of an incomplete plan), nor are the visuals of five of its interactives.
6. Small: kit label collisions that predate this work (a tag under a step badge, a container label crossed by a
   border); sequence diagrams still read neutral; one "Predict" badge is under 4.5:1 in light mode.

## Decisions the owner made (2026-11-15)

1. **Direction:** yes, roll it out lesson by lesson.
2. **Settings:** rich only. The calm setting is to be removed from the kit, its CSS and its tests.
3. **Cost and other ordered scales:** keep the fuchsia ramp.
4. **Title strip:** keep it on every figure.

## No visual left behind (owner, 2026-11-15)

After seeing lesson 1 with four hand-drawn figures still in the old style, the owner said: "for rest of them do not
miss these kind for all the other lessons." So a lesson is not done, and is not released in the new look, until every
visual in it is redesigned:

- every hand-drawn `<svg>` figure, including small ones inside recap cards, callouts and `<details>`;
- every diagram-kit figure (focal part named where the figure has one);
- the visual of every interactive embedded in the lesson;
- any other picture: recap pictures, tables drawn as figures, charts.

The check is mechanical, not a judgement: before a lesson's release, list every visual in it (the figure scan plus
the embeds) and mark each as redesigned or not. The count of "not" must be zero, and the reviewer confirms the list
against the rendered page, scrolling it from top to bottom in both themes. A figure that is hard to redraw is still
redrawn; it is never skipped silently. If one truly cannot be done that week, the lesson waits.

## The weekly routine

Each week, a few lessons in route order, starting with lesson 1 (`F1A_The_Cost_of_Bugs`), then `F1B`, `F1C`, `F2A` and
on through Tier 1. For each lesson:

1. **List** its visuals: `python3 docs/curriculum-quality/workflows/figure-scan.py <lesson>` for figures, and the
   embeds for interactives.
2. **State the one idea** of each visual from its caption and the prose around it.
3. **Design:**
   - a kit figure: set `focus` (and roles where the lesson's words give a side);
   - a hand-drawn figure: redraw it with the figure tokens inside the same viewBox, every text string kept;
   - an interactive's visual: restyle it with the tokens; its outer size must not change.
4. **Review independently** through the three lenses (design; what the figure teaches; robustness in both themes, on
   a phone, in forced colours and print), then fix, then recheck.
5. **Gates:** the word proof (every text string unchanged against the released commit), `scripts/check-mdx.mjs
   --render`, the kit, layout and contrast tests, `tsc`, and a height measurement for any interactive that changed.
6. **Show the owner** before and after in both themes, then release.

The first release must carry the kit's art direction and all of lesson 1 together, after items 1 to 5 above are
closed and the calm setting is removed. The owner sees lesson 1 before and after once more, then it is released.

## What it costs

Measured on 2026-11-15 (Fable workers, because of that week's usage rule): the art direction plus three visuals took
0.69M tokens to design and 1.65M to review, fix and recheck. On Opus that is roughly 1 % of a weekly limit. An
estimate, to be measured on lesson 1: a lesson with about a dozen hand-made visuals needs 3M to 4M tokens designed and
reviewed, so three or four lessons a week is about 5 % to 7 % of the weekly limit.

## What this replaces

- `figures/hand-drawn-fills` (fill options for hand-drawn figures, proved safe by a guard) is not cleared and is
  largely overtaken: figures are now redrawn, and the check that matters is the word proof, not a guard on
  attributes. `figure-guard.py` is still right for passes that only add roles or `focus`.
- The inventory of 21 interactives with bland or contradictory visuals
  (`findings/interactives-visuals-inventory-2026-11-15.json`) feeds step 3 for each lesson instead of a separate pass.
- The full review of the preview, with the right focal part for 21 kit figures, is
  `findings/figure-art-direction-review-2026-11-15.json`.
