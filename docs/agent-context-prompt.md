# New-agent context prompt

Copy the block below into a new agent session. It is written for the current repository and links to the complete analysis. Recheck Git and validation rather than assuming the snapshot stays current.

```text
You are taking over the sv-uvm-guide project at:
/Users/Rakesh/Projects/sv-uvm-guide

Your immediate task is to understand the project, its implemented behavior,
product intent, active work, and analysis findings. Do not mistake historical
completion claims or prototype components for finished learner behavior.
An accompanying user request determines whether you should implement work;
this context prompt alone is not an instruction to rewrite the platform.

BASELINE AND CURRENCY
The October 3, 2026 analysis was performed on clean main after fetching and
fast-forwarding to:
488f7f43d2523840efebb0c4d1f87e9087807c2d
Remote: https://github.com/rakeshnreddy/sv-uvm-guide.git
This is merged PR #391, Refactor full-stack and UVM platform (July 19).
Its required CI passed on source head 0f32be9e163e8737e12d8d0df91f6471954b469f.
There were no open PRs at audit time.

First inspect git status, branch, HEAD, remotes, and current remote refs.
Preserve local changes. Fast-forward only when safe. Do not reset or force-push.
The previous session produced documentation and setup artifacts; inspect the
working tree before any branch, commit, or installation action.

READ THESE IN ORDER
1. AGENTS.md and applicable ancestor/user instructions.
2. docs/project-analysis-2026-10-03.md (full source-backed project assessment).
3. SESSION_HANDOFF.txt (workstream and prior session context).
4. TASKS.md (single authority for active task status and priority).
5. docs/planning/lesson-analysis-tracker.md.
6. docs/planning/foundational-upgrade-spec.md.
7. PROJECT_GUIDE.md for educational/design intent; its older Firebase and
   routing descriptions are partly superseded by current code.
8. package.json and .github/workflows/quality-gates.yml.

WHAT THE PROJECT IS
An MIT open-source educational platform for digital hardware verification.
It teaches SystemVerilog, UVM, AMBA, and expert methodology through four tiers.
The intended retention loop is Learn -> Apply -> Solidify -> Collaborate.
It should move a learner from beginner concepts to practical verification,
corner-case reasoning, debugging, and senior/staff interview readiness.
Pedagogy: explain why before syntax, progressive disclosure, runnable examples,
meaningful practice, primary sources, and accessible interactive visuals.
Topic structure: Quick Take -> Build Your Mental Model -> Make It Work ->
Push Further -> Practice & Reinforce -> References & Next Topics.
Visual language: Digital Blueprint, navy/cyan/glass cards and local fonts.

VERIFIED INVENTORY
69 module indexes and 105 MDX files:
- T1: 13 modules, 16 MDX files.
- T2: 24 modules, 51 MDX files (13 SV + 11 UVM modules).
- T3: 20 modules, 23 MDX files (6 UVM + 14 AMBA modules).
- T4: 12 modules, 15 MDX files.
29 lab manifests: 21 available and 8 coming soon.
63 lab steps: 61 self-attested and 2 statically graded.
64 flashcard files / 412 cards, but only 53 registered decks / 363 cards.
6 interview banks / 59 questions.
20 components in components/visualizers; many more interactives live elsewhere.
120 Vitest files / 795 tests. Five optional audits are skipped by default.

CURRENT ARCHITECTURE
Next.js App Router 14.2.35, React 18.3.1, TypeScript 5.8.3, Tailwind 3.4.19,
NextAuth 4.24.13, Prisma 6.19.2/PostgreSQL, MDX RSC, Zod, Vitest, Playwright.

Start with these code paths:
- src/app/layout.tsx and src/app/(public)/(learning) route groups.
- src/components/providers/ClientProviders.tsx.
- src/app/(learning)/curriculum/[...slug]/page.tsx.
- src/lib/curriculum/lesson-loader.ts and lesson-frontmatter.ts.
- scripts/generate-curriculum-data.ts -> src/lib/curriculum-data.tsx.
- src/generated/mdx-component-registry.tsx.
- src/components/mdx/lazy-mdx-interactives.ts and LazyMdxInteractive.tsx.
- src/lib/auth.ts and prisma/schema.prisma.
- src/lib/lab-manifest.ts, lab-registry.ts, lab-assets.ts, lab-graders.ts.
- scripts/generate-lab-registry.mjs -> src/generated/lab-registry.ts.
- src/server/labs.ts and api/me/labs routes.
- src/server/simulation/*, simulation-runner/*, docs/simulation-worker.md.
- src/server/ai/* and src/server/assessment-question-bank.ts.
- src/tools/featureFlags.ts.

NextAuth is canonical identity. AuthContext is a compatibility wrapper; its
uid is not a Firebase-auth session. APIs derive identity through requireSession.
Prisma stores owned preferences, goals, attempts, reviews, cards, jobs, and
activities. Notifications are derived on request, not a persisted inbox model.
Labs enforce versioned server completion policies and withhold solution assets.
Only the basics lab has a static syntax grader; other available labs are
self-attested. Simulation is a separate batch job, not lab grading by default.
It needs a queue dispatcher/consumer or explicit Docker mode. The runner returns
pass/diagnostics; coverage is currently zero and waveformKey is null.
AI requires authenticated/database/provider configuration.
All five feature flags default false; forced-on E2E differs from default UX.

ACTIVE PRIORITIES
T1-FOUNDATIONAL-UPGRADE is P0 todo (new upgrade not yet implemented).
DEEP-ANALYSIS-SWEEP is P1 in_progress, paused for that upgrade.
The earlier T1 enhancement pass completed all 13 modules; that is a distinct
scope and does not mean the newer foundational spec is complete.
T2-T4 deeper analysis remains pending in the supporting tracker.
July platform/refactor and merge-blocker workstreams are complete.

KEY FINDINGS TO RETAIN
1. 32 MDX flashcard references, including 29 module indexes, have no registered
   deck key. Some JSON files exist but were never wired. The widget reads only
   src/lib/flashcard-decks.ts. Preserve aliases while reconciling.
2. Lesson/exercise progress uses localStorage. The main lesson visit tracker
   does not write Prisma LessonProgress, while engagement reads it. The old
   TopicPage and community use Firestore. Progress is not unified across devices.
3. The foundational spec proposes an interview schema incompatible with current
   InterviewBank types/tests. Integrate its educational requirements into the
   current bank object and prompt/rubric/model_answer/sources schema, or add a
   deliberate typed adapter. A bare proposed array will break bank tests.
4. New visual files/MDX tags need the lazy name/loader registry. The curriculum
   generator does not register a new interactive automatically.
5. All six foundational visuals and foundational_systemverilog.json are absent.
   No T1 index has a standard Kata heading.
6. Scheduling/clocking explanations disagree between interview bank and lessons.
   Verify normative statements and clause numbers against primary sources before
   copying them into questions or simulation visuals.
7. Dashboard, projects, notebook, project evaluation, certification, and social
   components mix real services with fixed/mock/random data. Many are gated off.
8. Product guide, ADRs, status badges, QA restart files and some contributor
   links are historical. Current code/TASKS/fresh checks take precedence.
9. Optional link audit uses stale route matching: route groups and pretty slugs
   cause false positives. Consult the actual HTTP sweep in the report before
   treating its 41 reported source-link occurrences as broken destinations.
10. Application Dockerfile installs dependencies before copying its postinstall
    script; validate that path. Web build success does not certify app-container,
    queue, database rollout, OAuth, or live AI readiness.

FRESH VALIDATION / LOCAL QUIRKS
The prior session refreshed exact dependencies, regenerated Prisma/curriculum,
moved stale .next output aside, built production output, and installed Chromium.
It kept environment files and secrets unchanged. Logs/inventory are under
test-results/project-analysis/ (ignored, so not guaranteed in a new clone).

PASS: type-check after stale cache removal, lint, strict labs (4 tests), content
validation (105 MDX/29 manifests), redirects (27), production build (156 pages),
bundle guard (994,613 B global aggregate gzip; 132,211 B curriculum entry), and
public HTTP/auth-boundary probes. Read the report for final authored-link results.

Ordinary npm test: 789 passed, 1 failed, 5 skipped (119/120 files passing).
The missing-secret test fails because the first generated Prisma import reloads
the existing .env and restores the secret after deletion. Minimal reproduction
confirmed this; changing Node did not resolve it.
With NODE_OPTIONS='--require @prisma/client' npm test:
790 passed, 5 skipped, all 120 files passed. This is a diagnostic workaround,
not a committed test fix. Do not claim ordinary npm test passed unqualified.
The optional strict subset ran all five previously skipped checks:
14 passed, one link-matcher failure across three files.

No local SV compiler/Docker/psql was found. test:sv-solutions discovers 23 files
but exits zero without compiling outside CI: do not count that as a pass.
Migration rehearsal, runner execution, live AI/OAuth, and authenticated browser
flows were not rerun. Chromium is available for the release suite; a disposable,
migrated PostgreSQL fixture is still needed for authenticated E2E.
Never point migration rehearsal at an existing production database.

Default Node is 20.12.2/npm 10.5.0; install warned that some dependencies need a
later Node patch. Bundled Node 24.19.0 exists at:
/Users/Rakesh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
Read supported engines before choosing a runtime. Do not print .env values.
.env.example lacks DATABASE_URL even though Prisma requires it.

IF THE USER ASKS YOU TO CONTINUE IMPLEMENTATION
Start the first todo in TASKS.md, with a bounded foundational work unit.
First reconcile the interview schema and migrate verified F1A/F2A questions.
Then implement NetResolutionSimulator and its pure tested semantics, register
it lazily, and embed it in F2A. Follow the spec's subsequent order.
Retain inline MDX Q&A during migration. Final acceptance requires all 13 modules,
at least three senior questions per module, six visuals, verified citations,
standard katas, and normalized SV examples.
Include flashcard integration explicitly if addressing related learning wiring.
Do not silently expand into non-T1 curriculum or a platform rewrite.

Use matching installed skills per AGENTS.md. Preserve canonical links,
frontmatter, existing imports and component APIs. Do not hand-edit generated
curriculum/lab/redirect data. Validate targeted behavior first, then the required
broader gates. Record limitations honestly. Update TASKS.md only when acceptance
passes; update session/module/template trackers as appropriate.
Do not assume a separate QA agent or automation is currently running.

FIRST RESPONSE AFTER READING
Give a concise evidence-based orientation: what the product does, strongest
implemented paths, meaningful gaps, active task, validation limits, and the
first bounded next step. Honor the accompanying user's scope before editing.
```
