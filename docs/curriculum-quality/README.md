# Curriculum quality program (2026-10-03)

**Goal.** Every lesson on the site achieves its intent: a learner who finishes it can explain, predict, write, debug and transfer what it teaches, and nothing on the page is wrong. Each lesson gets one of four verdicts (rewrite, major update, minor update, or no change), and the program does whatever that verdict requires.

**How it runs.** One managing agent, the *lead*, runs a swarm of subagents in phases and owns every decision that crosses lessons.

| Phase | Who | Output |
|---|---|---|
| 0. Spine | 1 curriculum-architect agent | [`curriculum-spine.md`](curriculum-spine.md): an intent card per module (objectives, must-cover, out of scope, prerequisites, milestone fed), plus curriculum-wide gaps |
| 1. Analyze | 1 analyst per lesson group | `analysis/<group>.md`: rubric scores, issues with evidence and sources, verdict, target outline, assets needed |
| 2. Verify | 1 independent verifier per group | `analysis/<group>.verify.md`: each S1/S2 claim confirmed or refuted against the primary source, plus issues the analyst missed |
| 3. Plan | 1 synthesis agent, then the lead | [`plan.md`](plan.md): verdict table, waves, cross-cutting standards, acceptance criteria per group |
| 4. Implement | 1 author per group, 2 reviewers (accuracy and pedagogy), then a fix pass | Lesson changes; review notes in `reviews/<group>.md` |
| 5. Integrate | lead | Registries, generated data, full validation, commits and pushes per wave |

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
2. **`## Quick Take`:** **What it is**, **Why it matters**, **The Analogy** (with where it breaks), then **You will be able to:** 3–5 measurable objectives using verbs such as *explain, predict, write, debug, choose*. Every objective must be exercised later on the page.
3. **`## Build Your Mental Model`:** the concepts in progressive layers (context before mechanics). Each major idea gets a picture: a visual, a diagram or a traced example. Pitfalls and misconceptions are named explicitly.
4. **`## Make It Work`:** a complete worked example that compiles under IEEE 1800-2023 and UVM 1800.2. State the expected output or log. Follow it with a step-by-step how-to and a **Checklist before moving on**.
5. **`## Push Further`:** advanced patterns, methodology, industry practice, performance, and interview angles.
6. **`## Practice & Reinforce`:**
   - a retrieval quiz of at least 4 questions mapped to the objectives, with distractors built from real misconceptions and an explanation per question;
   - flashcards that match the page;
   - at least one hands-on element: kata, exercise, lab link or debug challenge.
7. **`## References & Next Topics`:** primary sources with verified clause or section numbers, prerequisites, and the correct next lesson.

**Code in lessons.**
- Complete, compilable units, or explicitly marked `// snippet`.
- IEEE 1800-2023 legal, and UVM APIs that exist in uvm-core 2020.3.1. No invented methods, macros or plusargs.
- 2-space indent; `logic` for 4-state; `always_ff` with `<=`, `always_comb` with `=`.
- UVM objects are created with `::type_id::create` and registered with the `uvm_*_utils` macros. `import uvm_pkg::*;` and `` `include "uvm_macros.svh" `` appear where a full file is shown.
- Comments explain *why*.

**Tone.** Short paragraphs (3–4 sentences), bold the first use of key terms, define jargon before using it, and use no marketing filler. State unverifiable vendor or industry figures as such, or drop them.

---

## Rubric

Score each dimension 0–3: 0 = missing or wrong, 1 = weak, 2 = adequate, 3 = exemplary.

| # | Dimension | What a 3 looks like |
|---|---|---|
| R1 | Intent and objectives | Explicit, measurable objectives that match the spine card, sit at the right level for the tier, and are all exercised on the page |
| R2 | Technical accuracy | Every normative claim is correct and sourced, there are no invented APIs, and code compiles by inspection and is idiomatic |
| R3 | Structure | Template H2 order and frontmatter; sub-lessons consistent with the module index |
| R4 | Explanation quality | Context before mechanics, progressive disclosure, worked examples, accurate analogies with stated limits, consistent terms |
| R5 | Visual integration | Each visual is introduced, used for prediction, and debriefed where the concept is taught; nothing decorative |
| R6 | Practice and feedback | A quiz aligned to the objectives with misconception distractors, correct flashcards, and a hands-on element, with feedback on every answer |
| R7 | Transfer to real testbenches | Shows where the concept lives in a real TB or UVM environment, the bugs it causes, how to debug them, and the interview angle |
| R8 | Navigation and references | Correct prerequisite, next and cross links; primary references with verified clause numbers |

**Severity.**

| Level | Meaning |
|---|---|
| **S1** | Teaches a wrong model, or code that would compile wrongly or hide bugs, or a wrong answer key |
| **S2** | A significant inaccuracy or omission that harms competency, e.g. a missing core concept for the lesson's intent |
| **S3** | A minor inaccuracy, unclear wording, or a weak example |
| **S4** | Polish |

**Verdicts.**

| Verdict | When | What the author does |
|---|---|---|
| **rewrite** | The structure or approach is wrong, or most content is thin or inaccurate. Typically R1–R4 average ≤ 1, or the S1/S2 issues touch most sections. | Write a new page to the target lesson standard, keeping only what survives verification |
| **major** | Any S1, several S2s, or two or more dimensions ≤ 1 | Substantial new or rewritten sections; keep the page skeleton |
| **minor** | All dimensions ≥ 2, only S3/S4 issues | Targeted edits |
| **ok** | Meets the target | No change, apart from links if needed |

---

## Ownership rules for agents

- **No git state changes**: never commit, add, stash, checkout, reset or merge. `git diff` and `git status` are fine.
- **No** `npm install`, builds, `next dev`/`next start`, or global installs. The disk is tight, so write no large files.
- **Edit only what your group owns**: the module folders under `content/curriculum/...`, those modules' flashcard JSON files, and the labs those modules own (when your brief says so), plus your own report or review files.
- **Do not edit** `src/**` (components, registries, `src/lib/flashcard-decks.ts`, generated data), other groups' lessons, `TASKS.md`, `SESSION_HANDOFF.txt`, or other docs. Put needed changes under "Requests for the lead" in your report.
- **MDX safety:**
  - Wrap bare `<` and `<=` in prose in backticks.
  - Inside JSX text (for example SVG `<text>`), write literal `[x](y)` as `{"..."}` so MDX does not turn it into a link.
  - Keep quiz component formats that already render (`<Quiz questions={[...]}/>` or `<Quiz><QuizQuestion/></Quiz>`).
- **Release-test elements must stay intact** unless your brief says otherwise: B-AXI-4 quiz Q1 and its answer, the E-PSS-1 quiz question, `LabLink` and H1 title, and the E-PWR-1 title and `/practice/lab/` LabLink.

## Validation commands

- `node scripts/validate-content-manifests.mjs` compiles every MDX file and checks manifests. If it reports a stale lab registry, say so; regenerating it is the lead's job.
- `npm run -s validate:flashcards`
- `npx vitest run tests/qa`: curriculum coverage, scheduling-semantics lint and quiz audits.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run <specific tests>`
