# Learning-First Audit

This audit categorizes all application routes to align with the "Learning-First" primary objective. The goal is to identify and prioritize core learning content while de-scoping or feature-flagging non-essential features like mock community and user-specific tracking elements.

| Route | Learning Outcome | Must-have content | Nice-to-have (later) | Recommendation |
| ----- | ---------------- | ----------------- | -------------------- | -------------- |
| **Core Learning Routes** |||||
| `/curriculum` | Landing hub for the learning paths and curriculum structure. | ✅ Curriculum outline and navigation. | Progress indicators once tracking is real. | Keep |
| `/curriculum/[...slug]` | Delivers SV/UVM lessons, labs, and references. | ✅ MDX content, diagrams, callouts. | Additional interactive aides, spaced-repetition hooks. | Keep |
| `/practice` | Explains practice modalities and links to labs/exercises. | ✅ Overview content + deep links. | Personalized recommendations. | Keep |
| `/practice/lab/[labId]` | Sandbox to apply concepts in code. | ✅ Lab description, Monaco editor, verification harness. | Collaborative lab sharing. | Keep (optimize heavy deps) |
| `/practice/lab/mock-lab` | Legacy demo of the lab experience. | ⚠️ Only needed as showcase; no learning delta. | — | Defer behind tracking flag or archive |
| `/practice/interactive-demo` | Quick taste of practice features. | ⚠️ Demo copy & CTA to real labs. | Extended analytics. | Keep short-term as marketing teaser |
| `/practice/visualizations/assertion-builder` | Teaches assertion syntax via guided UI. | ✅ Guided steps, diagrams. | Leaderboards / sharing. | Keep (lazy-load visuals) |
| `/practice/visualizations/concurrency` | Visualizes concurrency semantics. | ✅ Animation + explanation. | Extra scenarios. | Keep (lazy-load) |
| `/practice/visualizations/coverage-analyzer` | Explains coverage metrics. | ✅ Charts + scenario walkthrough. | Personalized advice. | Keep (lazy-load) |
| `/practice/visualizations/data-type-comparison` | Compares data type usage. | ✅ Tables + interactive toggles. | Export options. | Keep |
| `/practice/visualizations/interface-signal-flow` | Shows signal flow interactions. | ✅ Diagram + narrative. | Multi-protocol variants. | Keep |
| `/practice/visualizations/procedural-blocks` | Differentiates procedural blocks. | ✅ Timeline animation. | Quiz overlays. | Keep |
| `/practice/visualizations/randomization-explorer` | Demonstrates constrained randomization. | ✅ Simulation controls. | Advanced solver insights. | Keep (lazy-load) |
| `/practice/visualizations/state-machine-designer` | Designs FSM interactions. | ✅ Diagramming canvas. | Export to code. | Keep (lazy-load) |
| `/practice/visualizations/systemverilog-data-types` | Deep dive on data types. | ✅ Interactive comparisons. | Additional labs. | Keep |
| `/practice/visualizations/uvm-architecture` | Explains UVM architecture relationships. | ✅ Layered diagrams + copy. | Multi-level toggles. | Keep |
| `/practice/visualizations/uvm-component-relationships` | Maps component relationships. | ✅ Diagram + tooltips. | Team sharing. | Keep |
| `/practice/visualizations/uvm-phasing` | Teaches UVM phasing timeline. | ✅ Timeline animation. | Scenario library. | Keep |
| `/exercises` | Index for targeted exercises. | ✅ Exercise list + statuses. | Personalized ordering. | Keep |
| `/exercises/scoreboard-connector` | Practice scoreboard wiring. | ✅ Exercise description + scoring. | Social sharing. | Keep |
| `/exercises/sequencer-arbitration` | Practices sequencing arbitration. | ✅ Interactive puzzle. | Replay analytics. | Keep |
| `/exercises/uvm-agent-builder` | Builds agents step-by-step. | ✅ Guided builder. | Compare with peers. | Keep |
| `/exercises/uvm-phase-sorter` | Reinforces phase ordering. | ✅ Sorting exercise. | Challenge mode. | Keep |
| `/quiz/placement` | Placement quiz to select entry point. | ✅ Quiz form + recommendations. | Persistence, analytics. | Keep |
| **Supporting & Reference** |||||
| `/` | Orientation for new learners. | ✅ Value prop, CTAs to curriculum. | Personalized hero states. | Keep (trim personalization until ready) |
| `/knowledge-hub` | Repository of articles/glossary. | ✅ Indexed references. | Search + personalization. | Keep |
| `/learning-strategies` | Meta-learning advice. | ✅ Strategy articles. | Adaptive pathways. | Keep |
| `/resources` | External resource catalog. | ✅ Curated links & descriptions. | Filtering, tagging. | Keep |
| `/practice/waveform-studio` | Teaches waveform analysis. | ✅ Waveform viewer + narration. | Upload learner traces. | Keep (optimize) |
| **Mock / Future Features** |||||
| `/community` | Social feed concept; no production backend. | ❌ None critical. | Later: curated discussions. | Gate behind `community` flag |
| `/community/post/[postId]` | Mock post detail. | ❌ | Comments, reactions. | Gate behind `community` flag |
| `/community/test-page` | Internal component testbed. | ❌ Developer playground. | Keep internal only. | Gate behind `community` flag |
| `/dashboard` | Mock learner dashboard. | ❌ | Real analytics once tracking exists. | Gate behind `tracking` flag |
| `/dashboard/coverage` | Curriculum coverage dashboard (internal). | ⚠️ Useful to staff, not learners. | Workflow integrations. | Gate behind `tracking` flag (staff-only toggle) |
| `/dashboard/memory-hub` | Memory consolidation mock UI. | ❌ | Real spaced repetition later. | Gate behind `personalization` flag |
| `/dashboard/notebook` | Personal notebook concept. | ❌ | Real notes sync. | Gate behind `personalization` flag |
| `/assessment` | Mock certification center. | ❌ | Future analytics. | Gate behind `tracking` flag |
| `/history` | Mock activity history. | ❌ | Later when telemetry exists. | Gate behind `tracking` flag |
| `/notifications` | Mock notifications center. | ❌ | Real notifications later. | Gate behind `accountUI` flag |
| `/projects` | Mock project tracker. | ❌ | Portfolio once mentorship launches. | Gate behind `personalization` flag |
| `/settings` | Mock settings/profile. | ❌ | Real preferences later. | Gate behind `accountUI` flag |
| **Static / Legal** |||||
| `/privacy-policy` | Legal requirement. | ✅ Policy text. | Update cadence reminders. | Keep |
| `/terms-of-service` | Legal requirement. | ✅ Terms text. | Version history. | Keep |

**Key Flags:**

- `community`: Controls `/community` routes and any comment/fake social components.
- `tracking`: Controls dashboard analytics, assessment center, and history timelines.
- `personalization`: Controls notebook, projects, and memory hub experiments.
- `accountUI`: Controls account shell experiences (notifications, settings).
- `fakeComments`: Controls seeded comment widgets on marketing pages; replace with empty state when disabled.

**How to toggle flags locally:** set `NEXT_PUBLIC_FEATURE_FLAG_<FLAG_NAME>` in your `.env.local` (or shell) to `true/false`, `1/0`, `on/off`, etc. When unset, the defaults above apply. For full UI test runs, `FEATURE_FLAGS_FORCE_ON=true` now forces every flag on without touching individual values.
