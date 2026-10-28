# Jev integration: where a System One model would truly help this project

Status: proposal (2026-10-28). Nothing here is built. It is recorded separately from `TASKS.md`, which stays the backlog
authority; promote items there only when the owner decides to do them.

## 1. What Jev is (and is not)

Jev is TypeSafe AI's first "System One" model, named after the fast, intuitive mode of thinking in Kahneman's
model. It is **non-generative**. You send it a *state* (any text or JSON context) plus one or more *typed
questions*, and it returns structured answers only, never prose.

| Question type | Returns | Example in this project |
|---|---|---|
| **Noul** | yes or no, with a probability | "Does this learner answer mention that `|=>` checks on the next edge?" |
| **Choice** | one option from a list you supply | "Which known misconception does this prediction show: A, B, C or none?" |
| **Score** | a position on an ordered scale you define | "Place this answer on Weak / Partial / Strong under this rubric." |

**Reported properties** (vendor and secondary sources, not yet verified against typesafe.ai):
- **Speed:** about 70–500 ms per call.
- **Price:** very low input cost, quoted as $0.042 per million tokens; output is free.
- **Access:** model `jev-latest` through the TypeSafe API and SDKs (Python `typesafe-sdk`, JS), the Vercel AI SDK and
  Gateway, and OpenRouter.
- **Availability:** early access, with a waitlist.

**Caveats that shape every design below:**
- **It can be confidently wrong.** The schema guarantees a valid *shape*, not a correct *answer*. On TypeSafe's
  own benchmark it scores about 68 %, roughly level with some frontier models and below the best. The benchmark's
  "correct" labels came from averaging two LLMs, not from human ground truth.
- **The SDKs are young.** Minor releases have already changed the question types, so pin versions and wrap the
  model behind an adapter.
- **The figures are contested.** Pricing and speed claims differ between sources; check the official pricing and
  terms before you commit.

**What Jev is for in practice:** high-volume or latency-sensitive decisions where **you can enumerate the answer
space**, and where a wrong answer is **cheap or caught**. The answer should *select* authored content or a next
step, never *write* it. Anything that needs explanation, citations, code or multi-step reasoning stays with the
frontier LLMs (the curriculum workflows, the Gemini tutor) and the deterministic tools (Verilator, tsc, tests).

### Fit test used to rank the use cases

A use case scores high when all five hold:
1. **Enumerable answers.** The answers can be listed in advance: a rubric level, a misconception id, a lesson
   section or an error class.
2. **Volume or latency matters.** The volume is large (thousands of items or every learner interaction) or the
   latency budget is under a second.
3. **Errors are recoverable.** A wrong answer is cheap or recoverable: it is formative feedback, a ranking, or a
   pre-filter before a stronger check.
4. **Authored output.** What the learner sees is authored text chosen by the answer, never model-written text.
5. **Measurable before launch.** The project already has labelled data, or can build it cheaply.

## 2. Ranked use cases

Each entry gives: the problem today, the Jev questions, where it plugs in, the value, the risks and guardrails,
and how to evaluate it.

### Tier A: highest value

#### A1. Cut the cost of the curriculum-quality workflows (finding triage before verification)
- **Problem today.** The weekly usage limit has been the binding constraint all week.
  - The 6b closure sweep produced 359 raw findings in round 1 and 426 in round 2.
  - Every S1/S2 finding then went to 3 independent LLM skeptics: 159 and 195 verdicts.
  - The skeptics confirmed 91 % of findings in round 1 but only 57 % in round 2. In round 2, over 40 % of the most
    expensive stage went on refuting findings that were not real.
  - The components and enrichment workflows have the same shape: critic, then verify, then fix.
- **Jev questions** (state: the finding text, its evidence, the cited lesson lines and, where relevant, the cited
  LRM clause text):
  - Noul "Is this an evidenced, specific defect rather than a style preference?"
  - Score severity on S1–S4.
  - Choice of category: wrong fact, wrong citation, contradiction, unclear wording, layout/a11y.
- **How it plugs in.** A pre-verify stage in `phase6-closure-sweep.js`, `visual-components.js` and
  `visual-enrichment.js`. It is called from a small Node script or an agent tool, because workflow scripts have no
  network access.
  - **Never drop a finding on Jev's word.** Use it to route.
  - A high-confidence "not a defect" gets 1 skeptic instead of 3.
  - A high-confidence "real S1/S2" gets 2 skeptics.
  - Anything uncertain keeps the full 3.
- **Value.** Fewer expensive agent calls per round. Savings are largest in late rounds, where most findings are
  refuted. The workflow journals hold every finding and its verdict, so the saving can be measured exactly before
  any change.
- **Risks and guardrails.**
  - A false "not a defect" could let a real S1 through with weaker scrutiny. The rule "S1 claims always get at least
    2 skeptics" bounds that risk.
  - Track Jev-vs-skeptic disagreement per round.
- **Evaluation (ready now).** The S1/S2 findings from rounds 1–2 form a labelled set: about 118 findings with 354
  skeptic verdicts, in the session journal of run `wf_010d0167-550`. Export them into
  `docs/curriculum-quality/data/` before that session's files are cleaned up. Measure:
  - precision of "not a defect" against skeptic refutation;
  - recall of real S1/S2.
  - Go only if precision is at least 0.9 at the threshold you would use.

#### A2. Cross-artifact contradiction screening at scale
- **Problem today.** The site now has a lot of separate content that has to stay consistent:
  - 112 lessons;
  - 113 flashcard files;
  - 172 interview questions with model answers, rubrics and common mistakes;
  - quizzes;
  - ScenarioSorter decks with hundreds of feedback strings.
  - The serious bugs found this week were *contradictions between artifacts*:
    - the coverage answer in the interview bank contradicted F1B;
    - the X-check rubric contradicted four lessons;
    - deck feedback contradicted F1C.
  - Only expensive LLM critics found them, one at a time.
- **Jev questions.**
  - Noul "Do statement A and statement B agree?", over candidate pairs.
  - Choice "Which of these lesson passages does this flashcard or answer depend on?" to build the pairs.
- **How it plugs in.** A nightly or per-release script:
  1. Extract claims: sentences carrying a § cite, rubric lines, flashcard backs and deck feedback.
  2. Build candidate pairs cheaply from shared keywords and § numbers.
  3. Ask Jev about every pair.
  4. Escalate only the "disagree" pairs to one LLM critic, or file them in a report.
  - Thousands of pairs cost very little at the reported price.
- **Value.** It turns the most expensive class of finding into a cheap, repeatable sweep. It also catches
  regressions every time a lesson changes.
- **Risks and guardrails.** It is a screen, not a judge. Every flagged pair goes to an LLM or a human before any
  edit, and false positives cost only review time.
- **Evaluation.** Positives: the contradictions fixed this week. Negatives: random agreeing pairs. Target recall of
  at least 0.8 on the known positives.

#### A3. Interview prep: score the learner's own answer against the rubric
- **Problem today.** `src/app/(learning)/interview-prep/` shows 172 questions. Each has a model answer, a
  Strong/Weak rubric and common mistakes (`RevealAnswer.tsx`), but the learner can only *read* them. Nothing
  checks *their* answer, so the most valuable practice loop (answer, get feedback, retry) is missing.
- **Jev questions** (state: the question, the learner's typed answer, the rubric and the model answer):
  - Score Weak / Partial / Strong.
  - One Noul per rubric point, for example "names at least three blind spots of code coverage".
  - Choice of the closest entry from `common_mistakes`, or none.
- **How it plugs in.** A small Worker route, `POST /api/decide/interview`.
  - The page shows *authored* feedback: the rubric points the answer hit and missed, the matching common-mistake
    text, and the model answer.
  - It works in no-login mode, with no storage. Add anonymous rate limiting, because the current
    `src/server/ai/rate-limit.ts` keys on a session.
- **Value.** It is the most direct learner-facing win, built entirely on content that already exists, and it runs
  fast enough to feel instant.
- **Risks and guardrails.**
  - Label it "practice feedback", never a grade, and always show the model answer.
  - Hide any per-point probability between 0.4 and 0.6, or show it as "not sure".
- **Evaluation.**
  - Smoke tests: each model answer must score Strong, and each rubric "Weak" example must score Weak.
  - Then about 50 answers per bank, graded by hand or from interview-practice volunteers.

#### A4. Predict-then-check: diagnose *which* misconception a wrong prediction shows
- **Problem today.** Phase 6a is adding many predict-then-check prompts: 149 lesson files already mention "predict",
  and F1B and F2C gained more. Today each prompt only reveals the answer. A learner who predicted wrong is not told
  *why* their model of the language is off.
- **Jev questions.** Choice over a short, authored list of misconceptions for that prompt. For example:
  - "NBA updates at a later time";
  - "x makes `if` take the then-branch";
  - "`inside` treats x on the left as a wildcard".
  - Use "none of these" as the fallback.
  - The state is the prompt, the learner's prediction and the correct answer.
- **How it plugs in.** A small `PredictCheck` MDX wrapper that takes `misconceptions={[{id, text, fix}]}`. 6a authors
  add the lists while enriching each lesson. It uses the same Worker route pattern as A3.
- **Value.** It turns many passive reveals into targeted remediation. The feedback stays authored and reviewed, so
  accuracy risk sits only in the *selection*.
- **Risks and guardrails.** A wrong selection shows a wrong remedy. Always show the correct answer and the general
  explanation, and offer the targeted note as "this might be what tripped you".
- **Evaluation.** Hand-write 5–10 typical wrong predictions per prompt for the first 20 prompts, then measure
  selection accuracy.

### Tier B: high value

#### B1. Lab and simulator log triage, for learners and for CI
- **Problem today.** Labs run on Verilator (`/api/labs/run`, `/api/simulate`).
  - Learners hit cryptic errors: reserved keywords such as `matches`, mixed time scales, a missing `endmodule`, a
    clocking block reached through a modport.
  - The compile check carries 37 known Verilator limitations with LRM-cited reasons
    (`scripts/sv-compile.config.json`).
  - Each new failure is classified by an expensive fixer agent.
- **Jev questions.**
  - Choice over a curated error taxonomy (about 20–40 classes, each mapped to a lesson section and a fix note), with
    the state being the log, the snippet and the lab id.
  - Noul "Is this a Verilator limitation rather than a code bug?"
- **How it plugs in.**
  - **Learners:** a "Why did this fail?" button on the lab page that shows the authored fix note and lesson link.
  - **CI:** a first-pass `kind` suggestion for new compile-check failures before the compile-fix workflow runs.
- **Value.** Learners get unblocked in seconds without an LLM, and CI triage gets cheaper.
- **Evaluation.** The 37 known failures and the about 60 failures fixed this month are labelled examples; measure
  accuracy.

#### B2. Search: intent routing and reranking of the existing index
- **Problem today.** `src/components/search/search-engine.ts` is lexical, over `src/generated/search-index.json`.
  Natural-language questions such as "why doesn't my always_comb run at time 0" match poorly, or match the wrong
  section.
- **Jev questions.**
  - Choice among the top 10–20 lexical candidates: which section answers the query?
  - Noul "Does any candidate answer it?" If not, show the browse, outline and route suggestions instead.
  - Choice of intent: concept, debugging, interview or lab.
- **How it plugs in.** Rerank in a Worker route after the client's lexical pass. Fall back to plain lexical order
  on timeout; set a 300 ms budget.
- **Value.** It makes "find the relevant information", the core of Jev's pitch, real for learners. Every deep link
  lands on the right heading anchor.
- **Evaluation.** Build 100 real queries with their correct section, taken from search logs if any exist, or
  hand-written. Measure top-1 accuracy against lexical ranking alone.

#### B3. Feynman feedback: make the score deterministic and cheap
- **Problem today.** `/api/ai/feynman-feedback` asks Gemini for a 0–100 score, prose feedback and missing concepts
  (`feynmanResultSchema` in `src/server/ai/index.ts`). It needs a login and a slow LLM call.
- **Jev questions.**
  - Score the explanation on a 5-level clarity and completeness rubric.
  - One Noul per required concept, from a per-lesson concept list (the lessons' objectives and recap cards already
    name them).
- **How it plugs in.** Jev produces the score and the missing-concepts list, and authored per-concept hints replace
  the prose. Keep Gemini only as an optional "explain more" step.
- **Value.** Faster, cheaper and more consistent, and it could run in no-login mode with anonymous rate limits.

#### B4. Placement and "what should I do next"
- **Problem today.** `PlacementQuiz`, `AdaptiveTestEngine` and the dashboard choose routes and next lessons. Free-text
  self-descriptions ("I know Verilog, new to UVM, interviewing in a month") are hard to map with rules.
- **Jev questions.**
  - Choice of route: junior, intermediate or expert.
  - Score readiness per module from the browser-stored quiz history.
  - Choice of the next lesson among the route's candidates.
- **How it plugs in.** On the client, through a Worker route, with only the minimum context sent. The decision must
  never block navigation.
- **Value.** It is moderate, because deterministic rules cover most cases. Jev earns its place on the free-text
  inputs.

#### B5. AI tutor front door, for when `aiTutor` is turned back on
- **Problem today.** The tutor (`/api/ai/chat`, Gemini, feature flag `aiTutor: false`) is off. When it returns, every
  question will cost an LLM call, including off-topic ones and ones the curriculum already answers word for word.
- **Jev questions.**
  - Noul "Is this in scope?"
  - Choice of route: answer from a curated lesson section (link plus quote), call the LLM, or politely refuse.
  - Choice of the lesson section to ground the LLM call.
- **Value.** Cost control and better grounding. It is the classic "System One in front of System Two" pattern Jev is
  designed for.

### Tier C: lower value, or better done another way

| Use case | Jev questions | Why it is lower |
|---|---|---|
| C1. Quiz and flashcard item QA | Score distractor plausibility; Noul "only one defensible answer?" | Useful as a pre-filter for critics, but A2 catches the worst problems (wrong keys). |
| C2. Prerequisite and route graph check | Choice "which earlier lesson teaches this concept?" | Nav bugs are rare now, and the curriculum generator already validates links. |
| C3. Learner feedback triage | Choice of type (bug, content error, feature); Score severity | There is no feedback channel yet. Worth it once one exists. |
| C4. Topic and difficulty tagging | Choice of topic; Score difficulty | Nice for filters, but low impact, and a one-off LLM pass would do. |

### Not recommended

| Use | Why not |
|---|---|
| Writing lessons, explanations, hints or code | Jev does not generate text. |
| Verifying normative SV/UVM/AMBA claims | This needs clause-level reading, citations and reasoning. Keep LLM critics and the source texts; Jev may *route* these checks (A1, A2) but must never *decide* them. |
| `CompetencyCertification` or any high-stakes grade | About 68 % accuracy, and confidently wrong answers are unacceptable where the result is final. |
| Deciding whether SystemVerilog code is correct | Verilator, the compile check and the simulator are deterministic and exact. |

## 3. Architecture sketch
- **Seam.** A provider-agnostic decision interface, `src/server/decide/` (for example
  `decide({ state, questions })`), with a Jev adapter on the pinned SDK. It sits beside `src/server/ai` (the LLM
  tutor) and does not replace it.
- **Runtime.** Next.js route handlers on Cloudflare Workers.
  - The API key is a Worker secret, never sent to the client.
  - Validate inputs with zod, as the existing routes do.
  - Set a 300–500 ms timeout, with a deterministic fallback for every feature.
- **No-login mode.**
  - Use anonymous rate limits, by IP or Turnstile, because the current limiter keys on a session.
  - Keep nothing server-side.
  - Update the privacy policy, since learner text is sent to TypeSafe.
- **Cost and latency.** Cache identical (question, input) hashes in KV, which suits A3, B2 and C-tier batch jobs.
- **Feature flags.** Add one per use case in `src/tools/featureFlags.ts`, so each can launch and roll back alone.
- **Workflow use (A1, A2, B1 for CI).** A Node script or an agent tool calls Jev in batches. Workflow scripts cannot
  make network calls, so agents call the script.
- **Observability.** Log each decision's probabilities and outcome, without learner text, to tune thresholds.

## 4. Evaluation before any launch
| Use case | Labelled data | Metric and threshold to go live |
|---|---|---|
| A1 | About 118 S1/S2 sweep findings with 354 skeptic verdicts (export from run `wf_010d0167-550`) | Precision of "not a defect" ≥ 0.9; S1 recall ≥ 0.98 at the routing threshold |
| A2 | Contradictions fixed this week, plus agreeing pairs | Recall ≥ 0.8; flagged pairs a reviewer can manage |
| A3 | Model answers (should score Strong), rubric Weak examples, then about 50 graded answers per bank | Agreement with human grades ≥ 0.8 within one level |
| A4 | 5–10 hand-written wrong predictions per prompt, for 20 prompts | Selection accuracy ≥ 0.8; "none" when unsure |
| B1 | 37 known failures with `kind`, plus this month's fixed failures | Top-1 accuracy ≥ 0.85 |
| B2 | 100 queries with their correct section | Top-1 better than lexical ranking alone by a clear margin |

## 5. Risks
- **Vendor maturity.** Early access, a waitlist, and SDK minor versions that break question types. Mitigate with
  the adapter seam, pinned versions and contract tests.
- **Accuracy.** About 68 % on the vendor's own benchmark, with LLM-derived labels. Mitigate by routing and screening
  rather than deciding, showing authored output, and evaluating offline on this project's own labelled data first.
- **Privacy.** Learner answers go to a third party. Mitigate with disclosure, no server-side storage and minimal
  context.
- **Cost claims.** These vary by source; verify the official pricing before any volume use. Even at ten times the
  quoted price, A1–A4 stay cheap compared with LLM calls.

## 6. Suggested rollout
1. **Phase 0, about a day.**
   - Get API access.
   - Build the `src/server/decide` adapter.
   - Write an offline eval harness, and run it on A1 and B1, the labelled data that already exists.
2. **Phase 1, internal only.** A1 routing in the curriculum workflows, and A2 as a release-time report. No learner
   exposure; this measurably stretches the weekly budget.
3. **Phase 2, learners, behind flags.** A3 interview scoring, then A4 alongside 6a, as authors add misconception
   lists.
4. **Phase 3.** B1 lab triage, B2 search reranking, B3 Feynman scoring, B4/B5 with the tutor.

## Sources
- [What is Jev and how to use it? (nexos.ai)](https://nexos.ai/blog/what-is-jev/)
- [What Is Jev? TypeSafe's System One AI Model Explained](https://digitalstrategy-ai.com/2026/09/18/jev-system-one-model)
- [What is Jev, the System One model (Maxim)](https://www.getmaxim.ai/articles/what-is-jev-system-one-model/)
- [Meet Jev: the AI model that doesn't write (Towards AI)](https://pub.towardsai.net/meet-jev-the-ai-model-that-doesnt-write-and-why-data-engineers-should-care-f3ebfa2aab55)
- [Jev for Python engineers (Vercel)](https://vercel.com/blog/jev-for-python-engineers)
- [What Is Jev? How to test it with Apidog](https://apidog.com/blog/what-is-jev/)
- [System One models: Jev (DataCamp)](https://www.datacamp.com/vi/blog/system-one-models-jev)
- [Jev AI model (freeapihub)](https://freeapihub.com/blog/jev-ai-model)

These are secondary sources. Check pricing, limits, availability and terms against TypeSafe's own documentation
(typesafe.ai) before you rely on them.
