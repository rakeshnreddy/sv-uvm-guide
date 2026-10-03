# Intent versus implementation matrix (2026-10-03)

**Columns:**
- **Intent:** what `PROJECT_GUIDE.md`, the trackers, or the spec say the product should do.
- **Site messaging:** what learners are told on the site.
- **Implemented (default flags):** what the code does with the five feature flags at their default `false`.
- **Learner can accomplish:** the realistic outcome.
- **Gap:** severity per [audit-report.md](audit-report.md) §1.3.

Rows marked ✅ were improved in this session; the cell describes the state *after* the change.

## 1. Learning model

| Area | Intent | Site messaging | Implemented (default flags) | Learner can accomplish | Gap |
|---|---|---|---|---|---|
| Retention loop Learn → Apply → Solidify → Collaborate | Every module supports all four (`PROJECT_GUIDE.md` §1) | "Pair every concept with labs, flashcards, and quizzes so the knowledge sticks" (homepage) | Learn: 105 MDX. Apply: 47/69 modules link no lab; 61/63 lab steps self-attested. Solidify: 31 MDX flashcard IDs unresolved; quizzes recall-only. Collaborate: community 404. | Learn and partial recall | S1: Apply and Collaborate effectively absent |
| Progressive disclosure across tiers | Complexity layered T1→T4 | Four "learning paths" with hour estimates | Navigation order is alphabetical (AHB before the AMBA intro; ACE/CHI before AXI-1). UVM code appears in F2B and I-SV-3B/5/7 before UVM is taught. The "Advanced" path card links to I-UVM-3B (a T2 module). | Must self-sequence | S2 |
| Context before mechanics | Explain "why" first | Quick Take sections | Mostly followed | Explain-level understanding | OK |
| Code-first accuracy | "Include compilable SV/UVM samples and labs" | "Write, compile, and run SystemVerilog code directly in your browser" | ✅ `InteractiveCode` now shows code (it showed `[object Object]`). Many snippets still don't compile (appendices A–E registers). The link from this card 404s. The runner is off by default and can't run UVM. | Read code; cannot run it in-app | S1 |
| Active engagement | Quizzes, flashcards, exercises, AI prompts | "Gamified Exercises… Earn points, badges, and climb the leaderboard" | 4 exercise routes work (phase sorter, agent builder, scoreboard connector, arbitration sandbox). The sandbox and phase sorter teach wrong rules (appendix G). Badges and leaderboard are gated off. | Drag-and-drop drills | S2 |
| Prediction / debugging / transfer | Implied by "confident practitioners" | — | Before this session: no prediction-first interactive anywhere. ✅ F3C now has prediction gates, model-graded debugging and two katas. | In F3C only | S1 elsewhere |
| Accessibility by default | WCAG AA, keyboard, reduced motion | — | No reduced-motion handling anywhere before this session (✅ new visual system respects it). Clickable `div`s in several interactives. 3D without text alternatives. ✅ Lesson pages no longer overflow phones. | Partially usable with keyboard / screen reader | S2 |
| Industry credibility / accuracy | "Accurate content… disciplined QA" | LRM citations throughout | Many normative errors (scheduling ✅ fixed; UVM phasing, factory, TLM, RAL, AHB/AXI open). Citations partly wrong (e.g. `$cast` cited as §6.24.3; it is §6.24.2). | Learns some wrong models | S1 |

## 2. Features

| Feature | Messaging | Implemented (default) | Learner can accomplish | Gap |
|---|---|---|---|---|
| Skill placement | "Each response updates your readiness profile… Baseline telemetry that feeds the personalized dashboard and daily streak goals" | 10-question quiz with per-answer rationale works anonymously. Result POST needs a session. The dashboard is a 404. Answer options show literal backticks. | A tier suggestion | S3: overclaim |
| Labs | "Hands-on reinforcement"; practice hub lists 29 labs | Sign-in required. 8 "coming soon" cards → 404. Steps are self-attested. Solutions unlock on self-attestation. The runner needs an operator and has no UVM. Several references are wrong (LAB-C1, P3, P5, U3, U4). | Read starter/solution; edit in Monaco | S1 |
| Simulation | "Get instant feedback on your solutions" | `/api/simulate` → 503 unless a queue or local Docker is configured. Coverage hard-coded 0; no waveform. | Nothing by default | S1 |
| AI tutor / Teach it back | "AI Tutor Chat… available 24/7" | Requires a session and a Gemini key. The homepage anchor `#ai-tutor` doesn't exist. Feynman fails silently when signed out. | Nothing anonymously | S3 |
| Flashcards | Every lesson has a deck (frontmatter required) | 54 registered keys after this session. 31 MDX references still unresolved, mostly in T2 (✅ F3C fixed). | Decks on ~half the lessons | S2 |
| Interview prep | Senior/staff interview readiness | 6 banks / 59 questions exist but are rendered nowhere (tests only). Inline `<details>` Q&As reveal answers immediately. ✅ 21 playground checkpoints now render. | Read Q&As | S2 |
| Progress tracking | "Account features retain progress and suggest future work" | `completeLesson()` is never called. Visits are local only. No Prisma `LessonProgress` writer. Dashboard is a 404 (and shows a fake 65% when the flag is on). | No meaningful progress record | S2 |
| Knowledge graph / concept links | Adaptive learning paths | 15 hard-coded concept nodes power links on every lesson | Some cross-links | S3 |
| Community / projects / certification | Collaborate pillar | Community 404; projects shows a holding message; certification and project evaluator are mocks (random scores) behind flags | None | Prototype (honest gating needed) |
| Visual curriculum | "Interactive diagrams, purposeful motion" (Digital Blueprint) | 94 registered interactives before this session: 0 simulators, ~27 rule models, ~44 scripted illustrations, 8 placeholders. Several encode wrong rules. ✅ F3C flagship set (5 visuals) is model-driven and tested. | Mostly watch, rarely experiment | S2 |

## 3. Trackers and plans

| Document claim | Reality | Note |
|---|---|---|
| `TASKS.md`: T1-FOUNDATIONAL-UPGRADE `todo` | Still mostly open. This session delivered the F3C visual slice that covers the spec's `RaceConditionDebugger` (and more) and corrected the scheduling cluster. 5 visuals, the foundational bank and katas for 12 modules remain. | Spec clause numbers and region model need correcting first (appendix A §6) |
| Lesson tracker says T1 Phase 1 "✅ complete" | That was an earlier enhancement pass; the T1 audit rates 9 of 13 modules depth 2/5 | Keep both meanings distinct |
| `PROJECT_GUIDE.md` §7: Firebase is the identity authority | NextAuth + Prisma is canonical | Doc drift (earlier analysis §F) |
| `SESSION_HANDOFF.txt`: "Expand labs to full simulation-ready code" (approach rule c) | Only `basics-1` and `power-aware-retention` would simulate in the runner, and neither self-checks | Approach rule unmet |
