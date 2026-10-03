# Visual language and motion system

**Purpose.** Every concept a learner meets should become a mental picture they can recall while writing or debugging a testbench. This document fixes the conventions so the picture means the same thing in every lesson, flashcard, exercise and capstone.

**Code.**
- Tokens and primitives: `src/components/visual-system/`.
- Reference implementation: the F3C lesson (`content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx`) and its model `src/lib/sv-scheduler-model.ts`.

---

## 1. Principles

1. **Model first, pixels second.**
   - Behavioral visuals render the output of a pure, tested model (`src/lib/*-model.ts`). Rendering never invents state.
   - Code shown beside a model is generated from the same data the model executes (`scenarioToSource`), so it cannot drift.
2. **Declare fidelity.** Every visual carries a `FidelityBadge`:
   - **Conceptual illustration** ◇: explains, executes nothing.
   - **Deterministic educational model** ◆: rule-based, tested, with stated assumptions.
   - **Actual simulator execution** ▶: produced by a real SV tool. Only lab runs qualify.

   List assumptions and limits next to the visual, and cite the clause the model implements.
3. **Predict before reveal.** Results that a learner could reason about are gated behind `PredictionPrompt`. Every option carries feedback that diagnoses the misconception behind it. A "Reveal without predicting" escape exists but is de-emphasized.
4. **Causality in six beats.** Animations show:
   - the initial state;
   - the trigger;
   - what executes;
   - why it executes (the governing rule);
   - the resulting state;
   - the practical consequence.

   Each step has a **What** sentence and a **Why** sentence (`TraceNarration`).
5. **One picture per concept, reused everywhere.** The anchor for scheduling is the *time-slot ladder*. Flashcards, quizzes, exercises and later lessons (clocking blocks, SVA sampling, UVM drivers) refer back to it by name and shape.
6. **Learner-controlled time.** No autoplay. Play/pause, step back/forward, reset, speed and scrubbing are always available. Step back restores the exact prior state, because steps are full snapshots.
7. **Progressive disclosure.** Advanced controls (`#0` toggles, extra scenarios) sit behind an explicit "Show advanced" control.
8. **Never more than one moving thing at a time.** A lesson section has at most one animated visual. Static recaps follow animations.

## 2. Encodings (tokens in `visual-language.ts`)

Each encoding pairs colour with a **non-colour cue**. Meaning must survive greyscale and screen readers.

| Meaning | Colour | Non-colour cue | Component |
|---|---|---|---|
| Logic 0 | slate | low line in waveforms; "0" text | `ValueChip`, `StepWaveform` |
| Logic 1 | cyan | high line; "1" | same |
| Unknown X | rose | **diagonal hatch** + "X" + aria "unknown (X)" | same |
| High-Z | amber | **dashed border** + "Z" | `ValueChip` |
| Multi-bit value | indigo | bus shape with value label at each change | `StepWaveform` |
| Value just changed | cyan ring | **▲** glyph + aria "just changed" | `ValueChip` |
| Design (DUT) code / component | violet | **square corners** + `DUT` tag | `CodeTrace`, diagrams |
| Testbench code / component | amber | **rounded pill** + `TB` tag | same |
| Read-only scheduler region | slate | **dashed outline** | `RegionLadder` |
| Active region set | cyan | solid rung, first loop bracket | `RegionLadder` |
| Observed | sky | solid rung inside the first loop (in neither region set, §4.4.1) | `RegionLadder` |
| Reactive region set | violet | solid rung, second loop bracket | `RegionLadder` |
| Executing now | cyan glow | **▶** marker + aria "executing now" | `RegionLadder`, `CodeTrace` (`aria-current="step"`) |
| Event origin (moved event) | amber | **↺ came from here** label | `RegionLadder` |
| Read vs write location | violet / amber | **▼ read**, **◆ write** glyphs; collision = red cell | `RegionStrip` |
| Expected | teal outline | **dashed** border + `EXP` tag | `comparisonStyles` |
| Actual | sky fill | solid border + `ACT` tag | same |
| Match / mismatch | emerald / rose | **✓ / ✕** glyphs | same |
| Scheduler choice (nondeterminism) | amber | "Scheduler choice" badge + the option list | `TraceNarration` |
| Prediction | amber | "PREDICT" chip | `PredictionPrompt` |
| Recap | cyan→violet wash | "RECAP" chip | `VisualRecap` |

**Lines** (`lineConventions`):
- **Structure / containment:** thin solid line, no arrowhead.
- **Data or transaction flow:** solid line with a filled arrowhead, labelled with the payload (e.g. `req`, `item`).
- **Execution order / causality:** dashed line with an open arrowhead, labelled with a verb (e.g. "repeat until empty", "wakes").

Never use an unlabelled arrow.

## 3. Time labelling

Two kinds of time must never be confused:
- **Simulation time** is written `t = 10 ns`.
- **Conceptual / model time** is written "step 4 of 17" or "Δ 2".

Every waveform states its x-axis in its caption. For example, the F3C waveform says that all steps occur at `t = 10 ns` and a real viewer would draw them at one instant.

## 4. Typography and layout

- **Code.**
  - JetBrains Mono with **ligatures disabled** (global rule in `globals.css`, plus `[font-variant-ligatures:none]` on visual code). `<=` must never render as `≤`.
  - Inline code renders without backticks (prose override on the lesson article).
- **Labels.** 11 px uppercase tracking for section eyebrows; 15 px for step narration; body text uses the lesson prose scale.
- **Lesson grids** are content-based, not viewport-based: `grid-cols-[repeat(auto-fit,minmax(min(100%,Npx),1fr))]`. The lesson column is narrow even on desktop, so `md:`/`lg:` breakpoints inside lessons squeeze panels. Always give grid/flex children that hold code `min-w-0`, or rely on the lesson layout's `minmax(0,1fr)`.
- **Phones.** Verify at 390 px: no horizontal page scroll; code scrolls inside its own panel.
- **Theme.** Use semantic tokens (`bg-card`, `text-foreground`, `border-border`) plus the palette above with `dark:` variants. Code panels are always dark slate for contrast.

## 5. Motion

- Instructional motion is **stepped**, not continuous. Transitions are colour and position changes of about 200–300 ms.
- Every transition class carries `motion-reduce:transition-none`. `usePrefersReducedMotion()` is available for logic-level decisions.
- Playback speed options are 0.5× / 1× / 2× (base step 1.4 s).
- Do not animate layout during playback. Highlight the active code line, rung or signal instead.

## 6. Interaction patterns

| Pattern | Primitive | Rule |
|---|---|---|
| Step through a model trace | `usePlayback` + `PlaybackControls` | Keyboard: ←/→ step, Space play/pause, Home reset (focus inside the group). The scrubber has `aria-valuetext` with the step's sentence. |
| Synchronized views | `CodeTrace` + `RegionLadder`/diagram + `ValueChip`s + `StepWaveform` + `TraceNarration` | All read the same `TraceStep`; nothing keeps its own clock |
| Predict, then reveal | `PredictionPrompt` (`resetKey` on config change) | Options are full sentences, with per-option diagnostic feedback |
| Experiment | Toggles rendered *inside* the code line (`CodeTrace.renderLineControl`) | Changing code re-runs the model and resets the prediction |
| Exhaustive check | Model explores all legal choices | Show grouped outcomes, not one run |
| Compare two executions | Side-by-side traces from the first divergent step | Cursor on the divergence |
| Debug challenge | Suspect → fix → graded by the model on two axes (deterministic, hardware-faithful) | Diagnostic feedback for every wrong suspect; three fading hints |
| Recap | `VisualRecap` | Picture, rule, minimal code, common mistake, where it appears in a real testbench; no animation |

## 7. Accessibility checklist (every visual)

- [ ] All controls are `<button>`/`<input>`; SVG controls use `role="button"`, `tabIndex=0`, Enter/Space.
- [ ] Every encoding has a non-colour cue (glyph, outline, text).
- [ ] Live narration uses `aria-live="polite"`; the current code line uses `aria-current="step"`.
- [ ] SVGs have `role="img"`/`group` and an `aria-label` describing the state, not the shape.
- [ ] Works with `prefers-reduced-motion`; nothing autoplays.
- [ ] No hover-only information.
- [ ] At 390 px: no page overflow; touch targets ≥ 40 px tall.

## 8. Recipe: adding a concept visual set

1. **Model.** `src/lib/<concept>-model.ts`: pure functions, scenario-as-data, a trace of full snapshots, an exhaustive explorer if nondeterminism matters. Write semantic tests first, citing the clause each one pins.
2. **Scenarios.** `src/lib/<concept>-scenarios.ts`: presets with titles and one-line summaries.
3. **Visuals** in `src/components/visuals/`:
   - a conceptual map (◇);
   - a synchronized trace (◆);
   - an experiment with a prediction gate (◆);
   - optionally a comparison;
   - a debugging challenge (◆).
4. **Register** the names in `lazy-mdx-interactives.ts` and loaders in `LazyMdxInteractive.tsx`.
5. **Lesson.** Follow this order, keeping the required H2 order from `PROJECT_GUIDE.md` §5:
   1. picture;
   2. animation;
   3. experiment;
   4. comparison;
   5. `<VisualRecap>`;
   6. debug challenge;
   7. checklist;
   8. retrieval quiz with no animation;
   9. guided kata;
   10. independent kata.
6. **Reinforce.** Add flashcards that name the visual anchor (for example "Picture the ladder…"). Register the deck.
7. **Validate.** Component tests that fail on wrong semantics; full suite; build; Playwright captures at 1440 and 390 px.
