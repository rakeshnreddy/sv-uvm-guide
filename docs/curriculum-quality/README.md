# Curriculum quality program (2026-10-03)

**Goal.** The best site for learning SystemVerilog and UVM, serving everyone from a junior engineer to an absolute expert. Every lesson achieves its intent: a learner who finishes it can explain, predict, write, debug and transfer what it teaches, and nothing on the page is wrong or missing. Each lesson gets one of four verdicts (rewrite, major update, minor update, or no change), and the program does whatever that verdict requires.

## Quality requirements (non-negotiable)

These apply to every agent in every phase.

1. **Accurate.** Every normative statement, code block, quiz key, flashcard and diagram is correct against the primary sources. Unverifiable claims are labelled or removed.
2. **Complete.** Each lesson covers every must-cover item on its spine card. Each core concept passes the [concept completeness checklist](#concept-completeness-checklist): definition, purpose, mechanism, syntax and variants, worked example, picture, pitfalls, debugging, real-testbench use, related concepts.
3. **Junior to expert.** Every lesson has a clear core path a junior can follow, practitioner depth for daily work, and an expert layer (standard corner cases, tool-dependent behaviour labelled as such, methodology trade-offs, scale and performance, staff-level interview depth). See the [depth ladder](#depth-ladder).
4. **Easy to understand, expanded upon.** Context before mechanics. Define every term before using it. Concepts are built in small steps with worked examples. Nothing is skipped as "obvious".
5. **Visual.** Every core concept has an accurate picture that a learner uses, not just looks at: a model-backed visualizer or animation, a diagram, a timing waveform, a sequence diagram or a traced example. See [Visuals](#visuals-visualizers-animations-diagrams-pictures).
6. **Easy, logical navigation.** A learner always knows where they are, what comes next, what they need first, and where to go deeper or to practise. Order follows prerequisites; links are correct; nothing is a dead end. See [Navigation](#navigation-and-information-architecture).
7. **Closure through repeated checking.** Accuracy and completeness are re-checked at every phase: analyst then verifier, author then three reviewers in a loop until clean, then curriculum-wide sweeps until a round finds nothing new.

## How it runs

One managing agent, the *lead*, runs a swarm of subagents in phases and owns every decision that crosses lessons.

| Phase | Who | Output |
|---|---|---|
| 0. Spine | 1 curriculum-architect agent | [`curriculum-spine.md`](curriculum-spine.md): an intent card per module (objectives, must-cover, depth ladder, out of scope, prerequisites, milestone fed), learning paths, and curriculum-wide gaps |
| 1. Analyze | 1 analyst per lesson group (29 groups), plus 1 for the interview banks and 1 for navigation and information architecture | `analysis/<group>.md`: rubric scores, issues with evidence and sources, verdict, target outline, depth, completeness and visual gaps, assets needed |
| 2. Verify | 1 independent verifier per group | `analysis/<group>.verify.md`: each S1/S2 claim confirmed or refuted against the primary source, plus issues and completeness gaps the analyst missed |
| 3. Plan | 1 synthesis agent, then the lead | [`plan.md`](plan.md): verdict table, waves, cross-cutting standards, visual and navigation workstreams, acceptance criteria per group |
| 3b. Foundations | lead and builder agents | The MDX diagram kit (block, waveform and sequence diagrams lesson authors can write as data), new visualizers the plan approves, and navigation changes |
| 4. Implement | 1 author per group, then 3 reviewers (accuracy; completeness and depth; visuals and navigation), then fix rounds until no S1/S2 remain and every must-cover item is met (at most 3 rounds, then escalate to the lead) | Lesson changes; review notes in `reviews/<group>.md` |
| 5. Integrate | lead | Registries, generated data, full validation, commits and pushes per wave |
| 6. Closure | lead and critic agents | Curriculum-wide completeness critic and accuracy sweep repeated until two rounds find nothing new; junior and expert path walk-throughs; build, 390 px, contrast and e2e sweeps |

Agents in phases 1–4 only edit files their group owns (see [Ownership](#ownership-rules-for-agents)). The lead integrates shared files.

---

## Sources of truth

Verify every normative claim against a primary source. Write "unverified" rather than inventing a clause number.

| Topic | Source | Where |
|---|---|---|
| SystemVerilog language | IEEE 1800-2023 | Extracted text, one huge line: `/private/tmp/claude-502/-Users-Rakesh-Projects-sv-uvm-guide/6113778b-4d4d-4d58-846e-6705366b1234/scratchpad/audit/t1_lrm_clean.txt`. Search with Python: `t=open(p,encoding='latin-1').read(); i=t.find('16.14.2 '); print(t[i:i+3000])` |
| UVM | IEEE 1800.2-2020 and the uvm-core 2020.3.1 reference implementation | `github.com/accellera-official/uvm-core` (WebFetch the `.svh` source when unsure) |
| AXI, ACE | Arm IHI0022E | `.../scratchpad/audit/axi.txt` |
| AHB | Arm IHI0033B.b | `.../scratchpad/audit/ahb5.txt` |
| APB, CHI, PSS, UPF, other | Arm IHI0024, Arm IHI0050, Accellera PSS 2.x/3.0, IEEE 1801 | Web (Arm developer, Accellera); cite the section only if verified |

Prior evidence, which may already be fixed, so re-check the current file:

| Area | Appendix |
|---|---|
| T1 | [`docs/audit/2026-10-03-learning-outcomes/appendices/A-t1-foundational.md`](../audit/2026-10-03-learning-outcomes/appendices/A-t1-foundational.md) |
| T2 SV | [`B-t2-systemverilog.md`](../audit/2026-10-03-learning-outcomes/appendices/B-t2-systemverilog.md) |
| T2 UVM | [`C-t2-uvm.md`](../audit/2026-10-03-learning-outcomes/appendices/C-t2-uvm.md) |
| T3 UVM and T4 | [`D-t3-uvm-and-t4-expert.md`](../audit/2026-10-03-learning-outcomes/appendices/D-t3-uvm-and-t4-expert.md) |
| AMBA | [`E-t3-amba.md`](../audit/2026-10-03-learning-outcomes/appendices/E-t3-amba.md) |
| Labs | [`H-labs-and-tb-progression.md`](../audit/2026-10-03-learning-outcomes/appendices/H-labs-and-tb-progression.md) |

Milestone ladder M0–M8: [`tb-mastery-progression.md`](../audit/2026-10-03-learning-outcomes/tb-mastery-progression.md).

Visuals were rebuilt on tested models in the previous program ([`docs/visual-learning/`](../visual-learning/)). Judge how a lesson *uses* its visuals; do not rewrite visual components.

---

## The target lesson

The H2 order is mandatory (PROJECT_GUIDE §5). Sub-lesson pages use the same order.

1. **Frontmatter:** `title`, `description` (one sentence on what the learner can do afterwards), `flashcards`; `order` where the module uses it.
2. **`## Quick Take`:** **What it is**, **Why it matters**, **The Analogy** (with where it breaks), then **You will be able to:** 3–5 measurable objectives using verbs such as *explain, predict, write, debug, choose*. Every objective must be exercised later on the page. End with **Before you start:** the prerequisite lessons, linked.
3. **`## Build Your Mental Model`:** the concepts in progressive layers (context before mechanics), core first, then practitioner depth. Each core concept passes the completeness checklist below and gets a picture: a visual, a diagram, a waveform or a traced example. Pitfalls and misconceptions are named explicitly.
4. **`## Make It Work`:** a complete worked example that compiles under IEEE 1800-2023 and UVM 1800.2. State the expected output or log. Follow it with a step-by-step how-to and a **Checklist before moving on**.
5. **`## Push Further`:** the expert layer. Each item is an `### Expert: <topic>` subsection: standard corner cases, tool-dependent behaviour, methodology trade-offs, scale and performance, and staff-level interview questions.
6. **`## Practice & Reinforce`:**
   - a retrieval quiz of at least 4 questions mapped to the objectives, with distractors built from real misconceptions and an explanation per question;
   - flashcards that match the page;
   - at least one hands-on element: kata, exercise, lab link or debug challenge.
7. **`## References & Next Topics`:** primary sources with verified clause or section numbers, prerequisites, related lessons, and the correct next lesson (matching the generated navigation).

**Code in lessons.**
- Complete, compilable units, or explicitly marked `// snippet`.
- IEEE 1800-2023 legal, and UVM APIs that exist in uvm-core 2020.3.1. No invented methods, macros or plusargs.
- 2-space indent; `logic` for 4-state; `always_ff` with `<=`, `always_comb` with `=`.
- UVM objects are created with `::type_id::create` and registered with the `uvm_*_utils` macros. `import uvm_pkg::*;` and `` `include "uvm_macros.svh" `` appear where a full file is shown.
- Comments explain *why*.

**Tone.** Short paragraphs (3–4 sentences), bold the first use of key terms, define jargon before using it, and use no marketing filler. State unverifiable vendor or industry figures as such, or drop them.

### Depth ladder

Each lesson serves three readers on one page, in this order:

| Layer | Reader | Where it lives | What it must contain |
|---|---|---|---|
| **Core** | Junior: new to the topic | Quick Take, Build Your Mental Model | The idea in plain words, the picture, the minimal correct example, the one or two mistakes everyone makes |
| **Practitioner** | Working verification engineer | Build Your Mental Model (deeper subsections), Make It Work | All forms and options, a complete worked example, debugging (symptom → cause → fix), use in real testbenches and UVM environments, best practice |
| **Expert** | Senior and staff engineers, interview candidates at that level | Push Further, each expert item as `### Expert: <topic>` | Standard corner cases with verified clause numbers, tool-dependent behaviour (labelled as such), methodology and architecture trade-offs, scale and performance, how the concept interacts with others, staff-level interview questions |

The core path must read cleanly on its own. Expert material must not block a junior reader, but it must be there.

### Concept completeness checklist

For every core concept a lesson teaches, cover each item, or state why it does not apply:

1. **Definition:** precise, with the standard's terms.
2. **Purpose:** the problem it solves, and what goes wrong without it.
3. **Mechanism:** how it works, with semantics per the standard (cite the clause).
4. **Syntax and variants:** every form, default and option the learner will meet.
5. **Worked example:** compilable, with expected output or waveform.
6. **Picture:** a visualizer, diagram, waveform, sequence diagram or traced example.
7. **Pitfalls and misconceptions:** each with why it is wrong.
8. **Debugging:** symptoms, cause and fix, and what the simulator log shows.
9. **Real testbench use:** where it appears in a UVM or SV environment, best practice, and when not to use it.
10. **Connections:** related concepts (linked), prerequisites, and the interview angle.

## Visuals: visualizers, animations, diagrams, pictures

Every core concept needs a picture the learner can use. Choose the strongest honest form:

| Need | Use | Notes |
|---|---|---|
| Behaviour over time or rules a learner should experiment with | An existing model-backed visualizer (see the registry `src/components/mdx/lazy-mdx-interactives.ts` and `docs/visual-learning/concept-visual-map.md`) | Introduce it, ask the learner to predict, then debrief what it showed. Use its props to pick the right scenario. |
| A concept no existing visualizer covers | Request a new one in your report (concept, rules, scenarios, what the learner predicts) | The lead decides and builds it on a tested model in phase 3b. |
| Structure: hierarchy, topology, connections, data flow | `<ArchitectureDiagram>` from the MDX diagram kit (grid layout, UVM role tags and port symbols), or inline SVG, or an SVG under `public/visuals/<module>/` | Must match the code on the page exactly (names, ports, directions). |
| Timing: handshakes, pipelines, sampling | `<TimingDiagram>` from the kit (values[k] = value sampled at edge k), or `<ProtocolWaveform>` (WaveDrom JSON) | Every edge and value must follow the rules the lesson states. Say which edge samples. |
| Call order, phases, protocols between components | `<SequenceDiagram>` from the kit (calls, returns, async sends, notes, dividers) | Use the real method names, in the real order. |
| Code behaviour step by step | A traced example: code with a line-by-line state table, or a model-backed visualizer with CodeTrace | Show the values after each step. |

The kit's syntax and copy-ready examples are in [`docs/visual-learning/visual-language.md` §9](../visual-learning/visual-language.md#9-mdx-diagram-kit-static-diagrams-written-as-data).

**Rules for pictures:**
- Accurate: generated from or checked against the model or standard, never "approximately right".
- Accessible: `role="img"` with an `aria-label` or `<title>`; a text equivalent nearby for anything complex; not colour-only (shape or label as well).
- Theme-safe: use `currentColor` and theme tokens, never hard-coded white or black text; readable at 390 px.
- Purposeful: no decorative images. Each picture answers a question the learner has at that point.

## Navigation and information architecture

- **Order follows prerequisites.** Tier → module → sub-lesson order in navigation must match the spine. A lesson never relies on a concept taught later without a link and a one-line explanation.
- **Every page orients the learner:** breadcrumb, position in the module (for sub-lessons), a "Before you start" line naming prerequisites, and a correct "Next" link in References & Next Topics that matches the generated navigation.
- **Every page offers paths:** go deeper (Push Further and related lessons), practise (quiz, flashcards, lab or exercise), review (prerequisite links).
- **Junior and expert routes:** the curriculum overview offers a start-here path for juniors and lets experienced engineers jump to the expert layers and capstones without losing context.
- **No dead ends:** every link resolves; coming-soon items are not links.

---

## Rubric

Score each dimension 0–3: 0 = missing or wrong, 1 = weak, 2 = adequate, 3 = exemplary.

| # | Dimension | What a 3 looks like |
|---|---|---|
| R1 | Intent and objectives | Explicit, measurable objectives that match the spine card, sit at the right level for the tier, and are all exercised on the page |
| R2 | Technical accuracy | Every normative claim is correct and sourced, there are no invented APIs, and code compiles by inspection and is idiomatic |
| R3 | Structure | Template H2 order and frontmatter; sub-lessons consistent with the module index |
| R4 | Explanation quality | Context before mechanics, progressive disclosure, worked examples, accurate analogies with stated limits, consistent terms; easy to follow for a junior |
| R5 | Visuals and pictures | Every core concept has an accurate, accessible picture that is introduced, used for prediction, and debriefed; nothing decorative |
| R6 | Practice and feedback | A quiz aligned to the objectives with misconception distractors, correct flashcards, and a hands-on element, with feedback on every answer |
| R7 | Transfer to real testbenches | Shows where the concept lives in a real TB or UVM environment, the bugs it causes, how to debug them, and the interview angle |
| R8 | Navigation and references | Correct prerequisite, next and cross links that match the generated navigation; primary references with verified clause numbers |
| R9 | Completeness and depth | Every must-cover item from the spine card; every core concept passes the completeness checklist; core, practitioner and expert layers all present |

**Severity.**

| Level | Meaning |
|---|---|
| **S1** | Teaches a wrong model, or code that would compile wrongly or hide bugs, or a wrong answer key |
| **S2** | A significant inaccuracy or omission that harms competency: a missing must-cover concept, a missing expert layer, a core concept with no picture, or a navigation dead end |
| **S3** | A minor inaccuracy, unclear wording, or a weak example |
| **S4** | Polish |

**Verdicts.**

| Verdict | When | What the author does |
|---|---|---|
| **rewrite** | The structure or approach is wrong, or most content is thin or inaccurate. Typically R1–R4 average ≤ 1, R9 ≤ 1, or the S1/S2 issues touch most sections. | Write a new page to the target lesson standard, keeping only what survives verification |
| **major** | Any S1, several S2s, or two or more dimensions ≤ 1 | Substantial new or rewritten sections; keep the page skeleton |
| **minor** | All dimensions ≥ 2 (including R9), only S3/S4 issues | Targeted edits |
| **ok** | Meets the target | No change, apart from links if needed |

---

## Ownership rules for agents

- **No git state changes**: never commit, add, stash, checkout, reset or merge. `git diff` and `git status` are fine.
- **No** `npm install`, builds, `next dev`/`next start`, or global installs. The disk is tight, so write no large files.
- **Edit only what your group owns**: the module folders under `content/curriculum/...`, those modules' flashcard JSON files, the labs those modules own (when your brief says so), static images under `public/visuals/<your-module>/`, plus your own report or review files.
- **Do not edit** `src/**` (components, registries, `src/lib/flashcard-decks.ts`, generated data), other groups' lessons, `TASKS.md`, `SESSION_HANDOFF.txt`, or other docs. Put needed changes under "Requests for the lead" in your report.
- **MDX safety:**
  - Wrap bare `<` and `<=` in prose in backticks.
  - Inside JSX text (for example SVG `<text>`), write literal `[x](y)` as `{"..."}` so MDX does not turn it into a link.
  - Keep quiz component formats that already render (`<Quiz questions={[...]}/>` or `<Quiz><QuizQuestion/></Quiz>`).
- **Release-test elements must stay intact** unless your brief says otherwise: B-AXI-4 quiz Q1 and its answer, the E-PSS-1 quiz question, `LabLink` and H1 title, and the E-PWR-1 title and `/practice/lab/` LabLink.

## Validation commands

- `node scripts/check-mdx.mjs <your module folders or files>` checks only your files: MDX syntax, unregistered components, frontmatter, LabLink and flashcard ids, internal links (pretty slugs resolve), duplicate H1s, and template H2 order (as warnings). **Run it after every edit; it must report 0 errors.** It is safe while other authors are editing their own files.
- `node scripts/validate-content-manifests.mjs` compiles every MDX file and checks manifests. If it reports a stale lab registry, say so; regenerating it is the lead's job.
- `npm run -s validate:flashcards`
- `npx vitest run tests/qa`: curriculum coverage, scheduling-semantics lint and quiz audits.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run <specific tests>`
