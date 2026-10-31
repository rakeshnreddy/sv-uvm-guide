# Jev integration: where a System One model would truly help this project

Status: proposal (2026-10-28, revised 2026-10-31 against TypeSafe's own docs and the `typesafe-ai` skill). Nothing
here is built. It is recorded separately from `TASKS.md`, which stays the backlog authority; promote items there
only when the owner decides to do them.

## 1. What Jev is (and is not)

Jev is TypeSafe AI's System One model. It is **non-generative**. You send it a *state* (text, images or
application data) plus one or more *typed questions*, and it returns structured answers with calibrated
probabilities, never prose.

| Question type | Returns | Example in this project |
|---|---|---|
| **Noul** | the probability (0–1) that a statement is true | "Does `answer` say that `\|=>` checks on the edge after the antecedent?" |
| **Choice** | one option from a set you name, with a probability per option and a confidence | "Which misconception does `prediction` show: `nba_lands_later`, `x_is_false`, ...?" |
| **Score** | a position on ordered levels you describe, with a probability per level | "Where does `answer` sit on the rubric levels Weak / Partial / Strong?" |
| **Box** | a bounding box in an image | Not needed here; the site has no image-input flows. |

**Facts from the live docs** (docs.typesafe.ai, read 2026-10-31):
- **Model:** Jev 1.14 (`jev-1.14.0`) is current and generally available since 14 October 2026; `jev-latest`
  points to it. The models page mentions no waitlist or early-access gate.
- **Price:** $0.042 per million input tokens; output is free.
- **Limits:** 64k tokens per request (state plus all questions) and 32k per question (state plus that question).
  There is no limit on the number of questions per request; questions in one request run in parallel and are
  answered independently. Rate limits are per organisation, in tokens and requests per second, shown in the
  developer console.
- **Latency:** not stated on the models page. The "70–500 ms" figure in secondary coverage is unverified.
- **Accuracy:** the docs publish no overall benchmark. The "about 68 %" figure comes from secondary coverage of a
  vendor benchmark with LLM-derived labels; treat it as unverified. The cookbooks give small-sample results
  (see §2), which is the better guide.
- **SDKs:** Python `typesafe-sdk`, JavaScript, Vercel AI SDK and Gateway, OpenRouter. The question types have
  changed between minor versions, so pin the SDK and wrap it behind an adapter.

**Known weak spots that matter here** (from the jaggedness page for jev-1.13):
- **Numeric representations.** Weak on hex, binary and low-level values, and it cannot judge numeric closeness.
  This project is full of them: bit widths, `4'b10x1`, wrap values, cycle counts. **Rule: compare values in
  code, and give Jev a named bucket** such as `top_bit_lost` or `off_by_one`, never the raw values to compare.
- **Counting.** Count in code; ask one yes/no per item and sum.
- **Literal reading.** It misses negations and scoping words. Write rubric points as positive, concrete
  statements.
- **Choice option order.** It leans toward the first option; reorder and check consistency.
- **Adversarial content.** State is not treated as hostile. Learner-typed answers are untrusted input, so criteria
  must be explicit and edge cases tested.
- **Large state with irrelevant detail.** Send the relevant lesson section, never the whole lesson.
- **Compound questions.** Split every "and", "or" and multi-step judgment into its own question.

### Design rules from the skill

These shape every use case below.

1. **Judgments from Jev, decisions in code.** Write each decision as a truth table. Jev supplies the inputs ("Is
   this an evidenced defect?"); code holds the logic that maps them to an action. A question such as "What should
   happen next?" is at the wrong layer.
2. **One judgment per question**, phrased so that a true answer means yes, with the null case asked separately: pair
   every Choice with a Noul such as "Does any option fit?" rather than a "none of the above" option.
3. **Descriptive option names.** Option names reach the model; question ids do not. Use `wrong_citation`, not
   `option_1`. Describe each Score level as a situation that stands on its own.
4. **Thresholds.** 0.7 and 0.3 are the starting points for a Noul; the band between is "not settled" and gets its
   own row in the truth table. Confidence measures how peaked a distribution is, not how likely the answer is
   right, so it is rarely the gate.
5. **Bundle questions that share state**, and ask speculatively: questions are cheap and the state is read once.
6. **An API failure is an error, never an answer.** A timeout must not read as "no".
7. **Keep all question wording in one module**, and log the exact payload sent.

### Fit test used to rank the use cases

A use case scores high when all five hold:
1. **Enumerable answers.** The answers can be listed in advance: a rubric level, a misconception id, a lesson
   section or an error class.
2. **Volume or latency matters.** The volume is large or the latency budget is under a second.
3. **Errors are recoverable.** A wrong answer is cheap or recoverable: formative feedback, a ranking, or a
   pre-filter before a stronger check.
4. **Authored output.** What the learner sees is authored text chosen by the answer, never model-written text.
5. **Measurable before launch.** The project already has labelled data, or can build it cheaply.

## 2. Ranked use cases

Each entry gives: the problem today, the judgments Jev makes, the decision code makes, where it plugs in, the
value, the guardrails, and how to evaluate it. The cookbook named in each entry is the first-party pattern it
follows.

### Tier A: highest value

#### A1. Check every § citation in the curriculum against the standards' text
*Cookbook: citation check.*
- **Problem today.** The lessons, flashcards and interview bank cite IEEE 1800-2023, IEEE 1800.2-2020 and the AMBA
  specs by clause, hundreds of times. The project's standing rule is that every normative claim is verified
  against the primary source. Today that is done by expensive LLM critics, one finding at a time, and a wrong or
  drifted cite can survive for weeks.
- **Judgments.** For each cite: code extracts the claim sentence and the cited clause's text from the local source
  files (`t1_lrm_clean.txt`, `uvm_lrm.txt`, the AMBA texts). Jev answers one Choice, "How does `clause` relate to
  `claim`?", with options `supports`, `contradicts`, `says_nothing`.
- **Decision in code.** `contradicts` or `says_nothing` with a clear margin goes to a report, or to one LLM critic.
  A clause that cannot be found is a broken cite, with no model call. A `supports` with a weak margin goes to the
  same review list.
- **Plugs in.** A script under `scripts/`, run per release and nightly, producing a report next to the compile
  check. The sources stay private; only the clause text and the claim are sent.
- **Value.** It turns the most expensive class of finding into a cheap, repeatable sweep that runs on every
  content change. The cookbook caught all four planted failures on its sample, with the accurate cites verified at
  0.93 or above.
- **Guardrails.** It is a screen. No edit happens on its say-so; flagged cites go to a critic or a human.
- **Evaluation.** Positives: the wrong cites fixed in the 6b sweep (for example the old 1800.2 §3/§9.4 cites, and
  Verilator's non-existent "13.2.2"). Negatives: a random sample of verified cites. Go only if recall on the known
  positives is at least 0.8 and the review list stays small.

#### A2. Cut the cost of the curriculum-quality workflows (triage before verification)
*Cookbook: extraction cascade (verify and escalate).*
- **Problem today.** The weekly usage limit has been the binding constraint.
  - The 6b closure sweep produced 359 raw findings in round 1 and 426 in round 2.
  - Every S1/S2 finding then went to 3 independent LLM skeptics: 159 and 195 verdicts.
  - The skeptics confirmed 91 % of findings in round 1 but 57 % in round 2. In round 2, over 40 % of the most
    expensive stage went on refuting findings that were not real.
- **Judgments.** For each finding, with the state holding the finding, its evidence and the cited lesson lines,
  a set of Nouls each framed so that true means "something is wrong with the finding":
  - "Is the claim a style preference rather than a defect?"
  - "Does the cited lesson text fail to contain what the finding says it contains?"
  - "Is the proposed fix already present in the lesson?"
  - plus a Score of severity on levels described as situations (S1: teaches a wrong model; S2: materially
    misleading; S3: imprecise; S4: polish).
- **Decision in code.** Routing, never dropping:
  - any "wrong with the finding" Noul above 0.7, and no S1 signal: 1 skeptic instead of 3;
  - a clear S1 or S2 with no flags: 2 skeptics;
  - anything in the 0.3–0.7 band: the full 3.
- **Plugs in.** A pre-verify stage in `phase6-closure-sweep.js`, `visual-components.js` and
  `visual-enrichment.js`, called through a small Node script, because workflow scripts have no network access.
- **Value.** Fewer expensive agent calls per round, most of all in late rounds. The cascade cookbook's frontier sat
  above every single model on quality per cost, which is the shape this project needs.
- **Guardrails.** S1 claims always get at least 2 skeptics. Track Jev-versus-skeptic disagreement per round and
  stop routing if it drifts.
- **Evaluation (ready now).** The S1/S2 findings from rounds 1–2 form a labelled set: about 118 findings with 354
  skeptic verdicts, in the session journal of run `wf_010d0167-550`. Export them into
  `docs/curriculum-quality/data/` before that session's files are cleaned up. Go only if precision of "wrong
  with the finding" is at least 0.9 at the routing threshold and S1 recall is at least 0.98.

#### A3. Cross-artifact contradiction screening
*Cookbook: citation check, applied artifact to artifact.*
- **Problem today.** The site has many separate artifacts that must agree: 112 lessons, 113 flashcard files, 172
  interview answers with rubrics and common mistakes, quizzes, and ScenarioSorter decks with hundreds of feedback
  strings. The serious bugs found this week were contradictions *between* artifacts: an interview answer against
  F1B on coverage, a rubric against four lessons on X checks, deck feedback against F1C.
- **Judgments.** Code builds candidate pairs from shared § numbers and keywords. For each pair Jev answers the
  same three-way Choice as A1 (`supports`, `contradicts`, `says_nothing`), with the lesson passage as the source
  and the flashcard, rubric or feedback line as the claim.
- **Decision in code.** `contradicts` pairs go to a report and one LLM critic. Nothing is edited automatically.
- **Value.** It catches regressions every time a lesson changes, at a cost that lets thousands of pairs run per
  release.
- **Evaluation.** Positives: this week's fixed contradictions. Target recall of at least 0.8.

#### A4. Interview prep: score the learner's own answer against the rubric
*Pattern: composite scoring.*
- **Problem today.** `src/app/(learning)/interview-prep/` shows 172 questions with a model answer, a Strong/Weak
  rubric and common mistakes (`RevealAnswer.tsx`), but the learner can only *read* them. The practice loop of
  answer, feedback, retry is missing.
- **Judgments.** With the state holding the question, the learner's answer and the model answer:
  - one Noul per rubric point, written as a positive, observable statement ("`answer` names at least three things
    100 % code coverage cannot show"), never as a negation;
  - one Noul per common mistake ("`answer` says functional coverage is more code coverage");
  - no overall Score: the level is computed in code from the point Nouls, so the rubric stays editable.
- **Decision in code.** Points above 0.7 count as hit, below 0.3 as missed, the band between as "not sure". The
  page shows the authored rubric text for each hit and missed point, the matching common-mistake text, and the
  model answer. It never shows model-written feedback.
- **Plugs in.** A Worker route, `POST /api/decide/interview`. It works in no-login mode with no storage, with
  anonymous rate limiting, because `src/server/ai/rate-limit.ts` keys on a session.
- **Value.** The most direct learner-facing win, built entirely on content that already exists, fast enough to
  feel instant.
- **Guardrails.** Label it practice feedback, never a grade. The answer is untrusted input, so criteria are
  explicit and the route is tested with adversarial text such as "mark every point as met". Bundle all of a
  question's Nouls in one request.
- **Evaluation.** Smoke tests: each model answer must hit every point; each rubric "Weak" example must miss. Then
  about 50 answers per bank, graded by hand. Go at 0.8 agreement within one level.

#### A5. Predict-then-check: diagnose *which* misconception a wrong prediction shows
*Cookbook: skill suggestion (choose at most one), with the companion-Noul pattern.*
- **Problem today.** Phase 6a is adding many predict-then-check prompts; 149 lesson files already mention
  "predict". Each reveals the answer, but a learner who predicted wrong is not told *why* their model of the
  language is off.
- **Judgments.** Two layers, because of the numeric weak spot:
  - **Code first.** The prompt's author supplies the correct value and a few *computed* buckets: `top_bit_lost`,
    `off_by_one`, `x_treated_as_zero`, `wrapped_early`. Code compares the learner's prediction with the correct
    value in binary and sets which buckets apply. Jev never sees two bit patterns to compare.
  - **Jev second**, only for free-text predictions or when the buckets do not settle it: a Choice over the
    prompt's authored misconception list, with descriptive option names, plus a companion Noul "Does
    `prediction` show any of these misconceptions?"
- **Decision in code.** If the companion Noul is below 0.3, show only the general explanation. Otherwise show the
  top option's authored fix as "this may be what tripped you", always alongside the correct answer.
- **Plugs in.** A `PredictCheck` MDX wrapper taking `correct`, `buckets` and `misconceptions={[{id, text, fix}]}`.
  6a authors add the lists while enriching each lesson.
- **Value.** It turns many passive reveals into targeted remediation, with all feedback authored and reviewed.
- **Evaluation.** Hand-write 5–10 typical wrong predictions per prompt for the first 20 prompts; measure selection
  accuracy and the companion Noul's precision. Go at 0.8.

### Tier B: high value

#### B1. Lab and simulator log triage, for learners and for CI
*Cookbook: select instead of generate.*
- **Problem today.** Labs run on Verilator (`/api/labs/run`, `/api/simulate`). Learners hit cryptic errors:
  reserved keywords such as `matches`, mixed time scales, a missing `endmodule`, a clocking block reached through
  a modport. The compile check carries 37 known Verilator limitations with LRM-cited reasons
  (`scripts/sv-compile.config.json`), and each new failure is classified by an expensive fixer agent.
- **Judgments.** Code first: regexes over the log extract the error lines, the construct named and the line's
  source text, and shortlist the candidate classes from a curated taxonomy of 20–40, each mapped to a lesson
  section and an authored fix note. Jev then answers a Choice among the shortlisted classes, plus the Nouls "Is
  this a Verilator limitation rather than a bug in the code?" and "Does any class fit?"
- **Decision in code.** For learners, a "Why did this fail?" panel showing the authored note and lesson link, or
  a generic note when nothing fits. For CI, a suggested `kind` for new compile-check failures before the
  compile-fix workflow runs.
- **Guardrails.** Hex and binary values in the log are normalised by code before the state is built.
- **Evaluation.** The 37 known failures and the about 60 fixed this month are labelled. Go at 0.85 top-1.

#### B2. Search: rerank the existing lexical results
*Cookbook: re-ranking.*
- **Problem today.** `src/components/search/search-engine.ts` is lexical over `src/generated/search-index.json`.
  Natural-language questions such as "why doesn't my always_comb run at time 0" match poorly.
- **Judgments.** For each of the top 20 lexical candidates, one Noul: "Does `section` answer `query`?" The
  cookbook asks one candidate per request for clarity; here they should be bundled, since the query is shared
  state.
- **Decision in code.** Sort by the Noul, highest first. If the top Noul is below 0.3, show the outline and route
  suggestions instead of weak matches. On timeout, show the plain lexical order and say nothing; this is a
  degraded mode, not a "no".
- **Value.** The cookbook's legal-passage sample moved top-1 from 5 % to 18 % and top-10 from 38 % to 62 % on 40
  queries. The gain here is unknown until measured.
- **Evaluation.** 100 real queries with their correct section. Go only if top-1 beats lexical ranking by a clear
  margin within a 300 ms budget.

#### B3. Feynman feedback: make the score deterministic and cheap
*Pattern: composite scoring.*
- **Problem today.** `/api/ai/feynman-feedback` asks Gemini for a 0–100 score, prose feedback and missing
  concepts (`feynmanResultSchema` in `src/server/ai/index.ts`). It needs a login and a slow LLM call.
- **Judgments.** One Noul per required concept from a per-lesson concept list (the objectives and recap cards
  already name them), plus a Score of clarity on levels described as situations.
- **Decision in code.** The score and the missing-concept list come from the Nouls; authored per-concept hints
  replace the prose. Gemini stays only as an optional "explain more" step.
- **Value.** Faster, cheaper, consistent, and possible in no-login mode with anonymous limits.

#### B4. Placement and "what should I do next"
- **Problem today.** `PlacementQuiz`, `AdaptiveTestEngine` and the dashboard choose routes and next lessons.
  Free-text self-descriptions ("I know Verilog, new to UVM, interviewing in a month") are hard to map with rules.
- **Judgments, not decisions.** Nouls over the self-description: "has written Verilog or SystemVerilog RTL",
  "has used UVM", "has an interview within two months", "wants AMBA depth". The route and next lesson are chosen
  by the existing rules in code from those inputs plus the browser-stored quiz history.
- **Value.** Moderate: rules already cover most cases, and Jev earns its place only on the free-text inputs. The
  decision must never block navigation.

#### B5. AI tutor front door, for when `aiTutor` is turned back on
*Patterns: intent routing, LLM guardrails, classifying RAG passages.*
- **Problem today.** The tutor (`/api/ai/chat`, Gemini, feature flag `aiTutor: false`) is off. When it returns,
  every question will cost an LLM call, including off-topic ones and ones the curriculum already answers.
- **Judgments.** "Is `question` about SystemVerilog, UVM or AMBA?"; "Does `question` ask for a solution to a lab
  or assessment?"; for each candidate lesson section from a lexical lookup, "Does `section` answer `question`?"
- **Decision in code.** Off-topic: an authored refusal. A section answers it above 0.7: link and quote the
  section, no LLM. Otherwise: call Gemini, grounded on the best sections. This keeps the "what should happen
  next" decision in code, as the skill asks.
- **Value.** Cost control and better grounding.

### Tier C: lower value, or better done another way

| Use case | Judgments | Why it is lower |
|---|---|---|
| C1. Quiz and flashcard item QA | Per distractor, "could a careful reader defend this as correct?" | Useful as a pre-filter for critics, but A3 catches the worst problems (wrong keys). |
| C2. Prerequisite and route graph check | "Does `earlier_section` teach `concept`?" | Nav bugs are rare now, and the curriculum generator already validates links. |
| C3. Learner feedback triage | Nouls per type (bug, content error, request) and a severity Score | There is no feedback channel yet. Worth it once one exists. |
| C4. Topic and difficulty tagging | Choice of topic; Score of difficulty | Low impact, and a one-off LLM pass would do. |

### Not recommended

| Use | Why not |
|---|---|
| Writing lessons, explanations, hints or code | Jev does not generate text; the jaggedness page says chaining choices to generate is slow and poor. |
| Deciding whether a normative SV/UVM/AMBA claim is true | This needs clause-level reading and reasoning. Jev may *screen* cites and claims (A1, A3) but never *decides* them. |
| Comparing bit patterns, widths, hex or timing values | A listed weak spot. Code does this exactly; Jev gets a named bucket. |
| `CompetencyCertification` or any high-stakes grade | Confidently wrong answers are unacceptable where the result is final. |
| Deciding whether SystemVerilog code is correct | Verilator, the compile check and the simulator are deterministic and exact. |

## 3. Architecture sketch
- **Seam.** A provider-agnostic decision interface, `src/server/decide/` (for example
  `decide({ state, questions })`), with a Jev adapter on the pinned SDK, beside `src/server/ai` (the LLM tutor).
- **One questions module.** All question wording, option names, level descriptions and thresholds live in
  `src/server/decide/questions.ts`, so they can be audited and edited in one place.
- **Runtime.** Next.js route handlers on Cloudflare Workers.
  - The API key is a Worker secret, never sent to the client.
  - Validate inputs with zod, as the existing routes do.
  - A 300–500 ms timeout; a timeout surfaces as an error or a labelled degraded mode, never as a "no".
  - Keep state under the 32k-per-question limit by sending the relevant section, not the lesson.
- **No-login mode.** Anonymous rate limits by IP or Turnstile; nothing stored server-side; the privacy policy
  updated, since learner text is sent to TypeSafe.
- **Cost and latency.** Cache identical (state, questions) hashes in KV; bundle a page's questions in one request.
- **Feature flags.** One per use case in `src/tools/featureFlags.ts`, so each can launch and roll back alone.
- **Workflow use (A1, A2, A3, B1 for CI).** A Node script calls Jev in batches; agents call the script.
- **Observability.** Log each request payload and its probabilities, without learner text, to tune thresholds.
- **Robustness checks before launch.** Reorder Choice options and confirm the answer holds; test negations and
  adversarial text; hold out cases not used while tuning.

## 4. Evaluation before any launch
| Use case | Labelled data | Metric and threshold to go live |
|---|---|---|
| A1 | Wrong cites fixed in 6b, plus a sample of verified cites | Recall ≥ 0.8 on known wrong cites; a review list a person can clear |
| A2 | About 118 S1/S2 sweep findings with 354 skeptic verdicts (export from run `wf_010d0167-550`) | Precision of "wrong with the finding" ≥ 0.9; S1 recall ≥ 0.98 at the routing threshold |
| A3 | Contradictions fixed this week, plus agreeing pairs | Recall ≥ 0.8 |
| A4 | Model answers (must hit every point), rubric Weak examples, then about 50 graded answers per bank | Agreement with human grades ≥ 0.8 within one level |
| A5 | 5–10 hand-written wrong predictions per prompt, for 20 prompts | Selection accuracy ≥ 0.8; companion Noul precision ≥ 0.8 |
| B1 | 37 known failures with `kind`, plus this month's fixed failures | Top-1 accuracy ≥ 0.85 |
| B2 | 100 queries with their correct section | Top-1 better than lexical alone by a clear margin, within 300 ms |

## 5. Risks
- **Vendor maturity.** SDK minor versions have changed the question types. Mitigate with the adapter seam, pinned
  versions and contract tests.
- **Accuracy.** No published overall benchmark; the cookbooks report small samples. Mitigate by screening and
  routing rather than deciding, showing authored output, and evaluating offline on this project's own labelled data
  first.
- **Numeric weak spot.** The project's content is dense with binary and hex. Mitigate by design: code compares,
  Jev judges buckets.
- **Privacy.** Learner answers go to a third party. Mitigate with disclosure, no server-side storage and minimal
  context.
- **Budget for testing.** The skill asks that live test requests be run only with the owner's permission, a
  budget, a `TYPESAFE_API_KEY` and disclosure of what data is sent.

## 6. Suggested rollout
1. **Phase 0, about a day.** Create a TypeSafe account and key; the owner sets a test budget. Build the
   `src/server/decide` adapter and `questions.ts`. Write an offline eval harness and run it on A2 and B1, the
   labelled data that already exists.
2. **Phase 1, internal only.** A1 as a release-time citation report, then A2 routing in the curriculum
   workflows, then A3. No learner exposure; this measurably stretches the weekly budget.
3. **Phase 2, learners, behind flags.** A4 interview scoring, then A5 alongside 6a, as authors add bucket and
   misconception lists.
4. **Phase 3.** B1 lab triage, B2 search reranking, B3 Feynman scoring, B4/B5 with the tutor.

## Sources
First-party (read 2026-10-31):
- [Documentation index](https://docs.typesafe.ai/llms.txt)
- [Models: versions, limits, pricing](https://docs.typesafe.ai/go/models.md)
- [Question primitives](https://docs.typesafe.ai/go/primitives.md)
- [Known model weak spots, jev-1.13](https://docs.typesafe.ai/go/jaggedness.md)
- [Cookbook: citation check](https://docs.typesafe.ai/cookbooks/citation_check.md)
- [Cookbook: extraction cascade](https://docs.typesafe.ai/cookbooks/sde_cascade.md)
- [Cookbook: re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md)
- The `typesafe-ai` agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai -g`), installed on
  2026-10-31; it is the source of the design rules in §1.

Secondary (used only for the latency and benchmark figures, both marked unverified above):
- [What is Jev and how to use it? (nexos.ai)](https://nexos.ai/blog/what-is-jev/)
- [What is Jev, the System One model (Maxim)](https://www.getmaxim.ai/articles/what-is-jev-system-one-model/)
- [Jev for Python engineers (Vercel)](https://vercel.com/blog/jev-for-python-engineers)
