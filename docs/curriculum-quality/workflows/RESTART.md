# Restarting the curriculum workflows

Written 2026-10-12, when the weekly usage limit paused the program. Read this first in the next session,
then `docs/curriculum-quality/plan.md` (§3 wave table) and the backlog in `TASKS.md`.

## Release cadence and pause procedure (owner, 2026-10-26)

The owner wants work visible on the live site before each week's usage limit, and a clean pause that resumes
seamlessly. Two scripts and two rules make that routine.

**Checkpoint release.** Run `SCR=<scratchpad> docs/curriculum-quality/workflows/checkpoint-release.sh <filelist> "<msg>"`.
- It copies the listed files into a clean worktree, regenerates the derived data, and runs the gates: flashcards,
  content, MDX render, tsc, lint, unit tests and `test:sv`.
- It commits there and moves the branch without touching the main tree, so agents that are still editing lose
  nothing.
- It pushes, waits for CI, and fast-forwards `main` only if CI passes. Cloudflare deploys `main`.

Release at each of these points:
- after each 6b round's fixes are checked (while the next round is still in its read-only critique);
- after the compile-fix pass;
- after the components track registers its components;
- after each 6a tier batch;
- at least once a day when reviewed work is waiting.

Only reviewed work is released. Work that has not been reviewed goes to a backup branch, never to `main`.

**Usage watch (owner, 2026-10-26: pause at 65 % of the weekly limit).** Read the plan limits (`get_usage`) at every
checkpoint and about every 10 minutes while workflows run. Begin the pause procedure at about 62 %, so the wind-down
(stopping, releasing, CI, deploy, notes) finishes by 65 %. Launch nothing large past 60 %.

**Pause procedure**, when the owner says pause or the usage watch fires (65 % weekly):
1. Launch nothing new.
2. For each running workflow, read its journal or agent files to see whether fixers or builders are mid-edit.
   - If only read-only agents (critics, skeptics, auditors, reviewers) are running, stop it with `TaskStop`.
   - Otherwise, let the edit agents in flight finish, then stop it.
3. Release every reviewed change with checkpoint-release.sh, and confirm the live site.
4. Push every change that has not been reviewed (for example a fixer that was killed before its check) to
   `backup/wip-<date>`. Then revert those files in the main tree, so the next release cannot pick them up by accident.
5. Update this file for each workflow: the run ID, its saved script, which phases finished, and the exact resume step.
   - In the same session, use `resumeFromRunId`.
   - In a new session, rerun the saved script. Finished fixes are already committed, so a new run starts with fresh
     critics.
6. Update the memory note, then report to the owner what is live, what is on the backup branch, and what resumes next.

## Where things stand

**Integrated and deployed** (branch `curriculum-quality-program`, last integration `1f15a3f0`): tiers 1 and 2;
T3 A-UVM-4A to A-UVM-9; the expert lessons E-CUST-1, E-PERF-1, E-DBG-1 (3 pages), E-INT-1, E-PSS-1, I-SV-8,
E-EMU-1 and E-UVM-ML-1; lab simple-dut-1 rebuilt for F2E (milestone M0); sitemap.xml and robots.txt.

**Authored but not yet reviewed.** The files are in the working tree, and the backup branch
`backup/curriculum-quality-wip` holds a snapshot (see the commit message there):
- **W5 AMBA, 15 groups:** L32a/b (B-AMBA-1, B-AMBA-2), N06 (new B-APB-1), L33a/b (B-AHB-1, B-AHB-2),
  L34 (B-AHB-3 and ahb-checker-lab), L35–L36 (B-AXI-1, B-AXI-2), L37a/b (B-AXI-3, B-AXI-4),
  L38a/b (B-AXI-5 and axi-deadlock-hunt-lab; B-AXI-6 and axi-scoreboard-lab), L39 (B-AMBA-F1 and the bridge lab),
  L40a/b (B-AMBA-F2, B-AMBA-F3).
- **W6, 6 groups:** L45b (E-PWR-1 and its lab), L47a (E-SOC-1 index and its two labs), L47b (E-SOC-1/pss),
  L47c (E-PYUVM-1), L48a (E-RISCV-1), L48b (E-AI-1).
- **G29, all 6 interview banks** in `content/interview-questions/`. Authors finished; most reviews never ran.

**Why everything above needs a fresh review.** In October two runs authored the same groups at once.
A resumed run was still active when a restart run was launched, so the files hold whichever author wrote last.
Reviews from either run do not reliably match the current text. Do **not** re-author.
Run the review-only pass below and integrate what passes.

**Partial lead work, in the backup branch only and unverified.** A visualizer-fix agent was cut off part-way:
- edited: `src/components/curriculum/interactives/visuals/PowerDomainVisualizer.tsx`,
  `src/components/visuals/TelemetryEventBusVisualizer.tsx`, `src/lib/power-sequence-model.ts`,
  `src/lib/uvm-report-model.ts` and their tests, with one-line edits in the I-SV-8 and E-DBG-1 index pages;
- started: an MDX render smoke test, `tests/curriculum/mdx-render-smoke.test.tsx`.

Finish or discard these before integrating; see "Lead follow-ups".

## Source texts (never commit them; they are copyrighted)

They live in `/Users/Rakesh/.claude/projects/-Users-Rakesh-Projects-sv-uvm-guide/sources/`:
- `t1_lrm_clean.txt`: IEEE 1800-2023
- `uvm_lrm.txt`: IEEE 1800.2-2020
- `ahb5.txt`: Arm IHI0033C
- `arm_ahb.txt`: IHI0033B.b
- `arm_axi.txt`: IHI0022E
- `arm_apb.txt`: IHI0024
- `arm_axis.txt`: IHI0051A

Each file is a few very long lines, so search it with Python. Every path in the scripts and args below already points there.

## Step-by-step restart

1. **Check the tree.** Run `git status`. If the unreviewed files are missing, restore them from the backup with:
   `git checkout backup/curriculum-quality-wip -- content docs src tests`.
2. **Never run two workflows on the same groups.** Before launching, check `/workflows` and make sure no earlier
   or resumed run is still active.
3. **Lesson review pass** (the 21 groups; each author step is skipped through `priorAuthor`):
   ask Claude to run the Workflow tool with `scriptPath: docs/curriculum-quality/workflows/curriculum-implementation.js`
   and `args` set to the JSON in `next-run-review-args.json`. Each group gets accuracy, completeness and visuals reviews,
   then up to 3 fix rounds. To stay within usage, run it in two halves: the W5 groups first, then the W6 six.
4. **Interview-bank review pass:** run `docs/curriculum-quality/workflows/interview-banks.js` with `args: {"reviewOnly": true}`.
5. **Integrate each group that comes back clean** in a clean worktree. Never generate or build in the main tree while agents run:
   ```bash
   SCR=<this session's scratchpad dir> bash docs/curriculum-quality/workflows/integrate.sh <file-list> --prep <prep.sh>
   SCR=<same> bash docs/curriculum-quality/workflows/integrate-commit.sh "<message>"
   ```
   `integrate.sh` regenerates the lab registry, curriculum data and search index, updates the generator snapshot,
   and runs the full test suite and tsc.
   - Run `npx next lint` and `npx next build` in the worktree before committing: every push deploys to Cloudflare.
   - Commit explicit paths only, with `--no-verify`.
   - **Checkpoint deploy:** Cloudflare Workers Builds deploys every push to `main` (fixed 2026-10-19, see
     docs/deploy/cloudflare.md). After a green integration, fast-forward `main`
     (`git push origin curriculum-quality-program:main`), then check the GitHub check "Workers Builds: sv-uvm-guide"
     on the commit and curl the live site. Fallback: the local `npm run cf:deploy` described in the runbook.
   - Load-related timeouts in `feature-gating`, `expert-index` and `tests/qa/*` pass when the file is run alone.
6. **Escalated groups:** read the `open` findings and fix them yourself or with a targeted agent, then integrate.
   `author-args-w5-w6.json` has the full author briefs, for any group that must be re-authored.

## Lead follow-ups (do while or after the reviews run)

- **Visualizers (W6 lead requests):**
  - PowerDomainVisualizer `upfLines()`: the switch input supply must be the 0.8 V net (VDD_LV); then remove I-SV-8's caveat sentence.
  - TelemetryEventBusVisualizer Demote preset: `uvm_report_cb::add(<monitor>, catcher)` in connect_phase, plus a demoted count checked in check_phase.
  - `uvm-hang-model` set_drain_time label.
  - `curriculum-status.ts:141`: remove the stale E-DBG-1 note.
  - `pss-scenario-model.ts`: unsigned decimal, begin/end inside the SV templates, `test_fail()` in the C template, `p_sequencer.mem_sqr`, `bit[32]`, the verified PSS version; then trim E-PSS-1's "Four simplifications" note.
- **MDX render smoke test:** a page passed `check-mdx` but returned HTTP 500. Finish `tests/curriculum/mdx-render-smoke.test.tsx`,
  which compiles and evaluates every lesson with stub components.
- **Spine** (`curriculum-spine.md`): position lines for E-CUST-1, E-INT-1, E-EMU-1 and E-UVM-ML-1; §5.1 term "transaction-based acceleration (TBA)"
  (ban "TLA"); Appendix A gets the clauses verified by L32a, L46a and L46b; E-PERF-1 and E-DBG-1 now require I-UVM-1D; simple-dut-1 is now F2E-owned.
- **Checks when integrating W6/G29:**
  - E-SOC-1 must say no `#` delays, clock waits or DUT polling in the **host-side (HVL)** parts.
  - E-PYUVM-1 must not say "TLA".
  - Map the debug-bank ids `debug-staff-regression-triage` and `debug-methodology-first-steps` to E-DBG-1/effective-debug,
    and update `tests/lib/practice-links.test.ts:356-361`.
  - Point the sva bank items at the E-INT-1 anchors `#over-constraint-vacuity-and-sanity-covers` and `#expert-signing-off-a-hybrid-flow`.
  - The uvm bank item `uvm-senior-staff-methodology` must match E-EMU-1.
- **G29 lead requests:**
  - The `/interview-prep` RichText renders neither `**bold**` nor single-newline lists.
  - Allow the `debug` and `predict-output` categories in `tests/interview-questions/bank-schema.test.ts`.
  - Optionally add a `visual` field that links visualizers.
  - Add a content lint for known-wrong phrases ("analysis ports receive a copy", drain time as a "safety net", the old 1800.2 §3/§9.4 citations).
- **L32a (B-AMBA-1) open visual findings:**
  - The AHB-Lite ArchitectureDiagram renders garbled (labels overlap, 390 px is unreadable).
  - The SoC diagram's stream arrow is hidden by its label.
  - Pass `legend={false}` to both diagrams.
  - The INCR4 caption gives away the prediction's answer.
  - APB has no picture.

## Then: phase 6 closure (plan §5)

1. Run the curriculum-wide accuracy and completeness critics until two consecutive rounds find nothing new.
2. Walk the junior, practitioner and expert routes.
3. Run the full build, the 390 px and contrast sweeps, e2e and the bundle check.
4. Update `TASKS.md` and `SESSION_HANDOFF`.

Still waiting on the user:
- switching the Cloudflare build branch;
- approving a Verilator install, so that code and labs can be compiled.

## Run log

- 2026-10-18: started the W5 review-only pass (run `wf_e047c557-093`, 15 groups) and the G29 bank review pass
  (run `wf_31252013-f8d`, `reviewOnly`). The W6 half (6 groups) starts after W5 finishes. If a run is cut off,
  resume it with `resumeFromRunId` and the same script; do not start a second run over the same groups.
- 2026-10-18: G29 banks integrated (3f53f5a8): all six passed review; `/interview-prep` now renders bold, lists and
  tables. Lead fixes integrated (94dfc853): PowerDomain UPF, Telemetry Demote code, PSS generator, hang-model label,
  status note; `tests/curriculum/mdx-render-smoke.test.tsx` and `check-mdx --render` added; lesson `sources:` may
  carry `url`. UVM misconception lint added (00e55c4e). Spine update agent running.
- **Check when integrating L40a (B-AMBA-F2):** the AMBA bank reviewer found that `index.mdx` (~l.158) says a cache may
  drop a Shared copy silently. Only a clean line may be dropped silently, and only by a master without an external
  snoop filter (IHI0022E C1.2.3, C4.2, C4.3, C4.9.1 Evict); SharedDirty must be written back or passed on. The
  coherency checker (~l.437, 532-533) must treat dirty responsibility in transit as an owner. Optional: PrefetchTgt
  is never retried (IHI0050E.b 2.11).
- Still open: the E-RISCV-1 interview question (no bank has one; SoC bank suggested); follow-up answers field;
  `debug`/`predict-output` categories in `bank-schema.test.ts`; a `visual` field linking visualizers.
- 2026-10-18: W5 review-only pass (wf_e047c557-093) came back with all 15 groups clean; integrated as f8784b67
  (B-APB-1 now live). W6 review-only pass started (run `wf_7ee1b1aa-4df`, 6 groups). Two follow-up agents running:
  diagram kit (phone width, label geometry checks, legend, role=img) and AMBA models/spine (AW payload SVA,
  WaveDrom edge numbers, same-ID RAW preset, APB citation, quiz-objective sentence, spine B-AHB-3/B-AXI-4/App. A/B).
- 2026-10-18: W6 review-only pass: all 6 groups clean; a verified fix pass cleared 9 diagram findings and E-SOC-1's
  inverted co-emulation rule; integrated as 53c0b6fc. **Every lesson has now been reviewed.** Diagram fixes for 131
  findings (7424a5bc), kit and AMBA follow-ups (a14d0d07). Deployed 53c0b6fc to the live site (version 28c5eec5).
  Next: phase 6 closure (plan section 5).
- 2026-10-18: phase 6 closure sweep started: run `wf_010d0167-550` (script saved as
  `docs/curriculum-quality/workflows/phase6-closure-sweep.js`). Each round has 19 lesson groups × (accuracy,
  completeness/coherence) plus a curriculum-wide consistency critic. Every S1/S2 finding goes to 3 skeptics
  (source, misread, impact) and is kept only if at least 2 uphold it. One fixer per file, then an independent check.
  It loops until two dry rounds (cap 5). Files are edited in the main tree, so integrate its result in a clean worktree.
  If it is cut off, resume with `resumeFromRunId` and the same script path; do not start a second sweep.

## Phase 6 closure sweep: paused by the owner (2026-10-18)

The owner paused the sweep (run `wf_010d0167-550`) to resume later. It was stopped while its first six round-1 critics
(G01–G03, both lenses) were still reading. No agent had finished and no file had changed, so nothing is half-done
and the working tree was clean.

**To resume:**
- **Same Claude session:** `Workflow({scriptPath: "<session>/workflows/scripts/phase6-closure-sweep-wf_010d0167-550.js",
  resumeFromRunId: "wf_010d0167-550"})`. Finished agents replay from the cache. There were none, so it starts at round 1.
- **New session:** resume ids do not carry across sessions. Run `docs/curriculum-quality/workflows/phase6-closure-sweep.js`
  (identical to the paused script) with the Workflow tool's `scriptPath`, and no args. Because nothing had finished, this is the
  same as continuing.
- **Before starting:** let the sweep be the only thing editing lesson MDX, decks and lab files, since its fixers edit them
  in the main tree. Integrate its fixes in a clean worktree. Deploy only from a clean tree.
- If it is stopped again after some agents have finished, resume it in the same session with `resumeFromRunId`. In a new
  session, rerun the script: its loop deduplicates findings per round, so a rerun re-reviews from the current, partly fixed
  content. First commit, or back up, any fixes already checked.

## Next phases, in order (owner, 2026-10-18)

1. **No-login mode:** finish design → implement → review, then push, deploy and fast-forward `main` (see plan §5 item 1).
2. **Phase 6a: visual enrichment.** Run `docs/curriculum-quality/workflows/visual-enrichment.js` with the Workflow tool's
   `scriptPath`, one tier per run: `args: {"tiers": ["T1_Foundational"]}`, then T2_Intermediate, T3_Advanced and
   T4_Expert. Integrate each batch in a clean worktree (prep: none; the diagram known-issues list must stay empty) and
   deploy at the checkpoint. Its `newComponentRequests` output seeds a component-build workflow.
3. **Phase 6b:** resume the paused closure sweep (section above), so that it reviews the enriched lessons too.
4. **Closure checks:** plan §5 item 4.
- 2026-10-18: no-login design done (`docs/no-login/`). Implementation running: run `wf_d9f39553-dd9`, script saved as
  `docs/no-login/no-login-implement.js`. Its steps:
  1. **Revise:** turn the design and both critiques into final packages with disjoint file ownership.
  2. **Foundation:** build the shared pieces first.
  3. **Packages:** build the rest in parallel, each with two-lens reviews and fix rounds.
  4. **Integrate:** run the whole suite, tsc and lint, and fix cross-package breakage.
  5. **Verify:** do an anonymous-visitor walkthrough.

  It edits src/ and tests/ in the main tree; integrate its result in a clean worktree, test in the browser, deploy, then
  fast-forward `main`. Do not run the visual enrichment or closure sweep while it runs.
- 2026-10-19: no-login mode integrated (f13e357d), verified (4317 tests, tsc, lint, production and analyzer builds,
  prerender check, browser walkthrough) and deployed (version e10696e2). `main` was fast-forwarded to the branch (691c7bd7),
  which also merged PR #392 (its one extra commit was superseded). **Next: phase 6a, visual enrichment**, then resume
  the 6b closure sweep. Follow-ups:
  - self-host Monaco instead of loading it from jsDelivr (the privacy policy now discloses the CDN);
  - add a theme control to the phone menu;
  - remove or replace the knowledge-graph placeholder behind the opt-in ConceptLink;
  - when accounts return: navbar overflow at 768 px, and the `POST /api/me/import` route (SERVER_SYNC_READY).
- 2026-10-25: the owner asked to resume the paused work. Phase 6b closure sweep resumed: same run `wf_010d0167-550`
  (task `wu1b1igge`), same script. No agent had finished before the pause, so it starts at round 1. 6a visual enrichment
  stays planned for afterwards. Its fixers edit lesson files in the main tree, so run nothing else on lessons until it
  ends. Then integrate in a clean worktree and fast-forward `main` to deploy.
- 2026-10-25: the owner approved Verilator, and adding the hidden pages and missing labs to 6a. The extras workflow is
  saved as `docs/curriculum-quality/workflows/phase6a-extras.js` (run it after the 6b sweep, with or after
  visual-enrichment.js). Verilator via Homebrew is blocked: /opt/homebrew is owned by macOS user "chaitra". Options: the
  owner runs `brew install verilator` from that account, or a no-admin build into ~/.local (autoconf 2.72, bison 3.8.2,
  verilator 5.052 from source).
- 2026-10-25: CI enabled on every push to `curriculum-quality-program` (6df00f99; docs-only pushes skipped). It runs the
  full quality gates, including the Verilator 5.050 + uvm-core 2020.3.1 compile of lab solutions and Playwright. The first
  run is 40181660082. Homebrew is now owned by Rakesh with group `admin`. The Verilator install waits on the owner
  updating the Command Line Tools for Xcode 27 (`softwareupdate`); then `brew install --build-from-source` for m4,
  autoconf, automake, flex, help2man and verilator.
- 2026-10-25: Verilator 5.052 is installed in `~/.local/verilator` (`/opt/homebrew/bin/verilator` links to it). It was
  built from source with GNU flex 2.6.4 (a Homebrew keg). Its `src/flexfix` macOS rewrite of `int` to `size_t` was turned
  off, because the GNU FlexLexer.h declares `int`. uvm-core 2020.3.1 is at `/Users/Rakesh/Downloads/1800.2-2020.3.1`
  (use it as UVM_HOME). `npm run test:sv` (f7d139fa) compiles 309 units: 241 lesson units and 68 lab units
  (`content/curriculum/labs/compile-units.json`). 237 compile; the 72 that fail (8 of them mixed time scales, IEEE 1800-2023 3.14.2.3) are listed under "known" in
  `scripts/sv-compile.config.json`. CI pulls verilator v5.052 too.
  - Two CI fixes are also in: the whole-curriculum tests yield between lessons (04a6269b), and validate:content accepts
    `url` on lesson sources.
  - **Next, after the 6b sweep integrates and before 6a: the compile fix pass.**
    1. Run `UVM_HOME=/Users/Rakesh/Downloads/1800.2-2020.3.1 node scripts/compile-sv.mjs --report <scratch>/sv-report.json`.
    2. Then `node docs/curriculum-quality/workflows/compile-fix-args.mjs <scratch>/sv-report.json > <scratch>/args.json`.
    3. Run `docs/curriculum-quality/workflows/compile-fix.js` with the Workflow tool's `scriptPath` and those args.
    4. Update the "known" list from its report: remove fixed units, and replace each to-verify reason with the verdict.
    5. Run `npm run test:sv`, then integrate.
- 2026-10-25: CI is green end to end for the first time: run 40190482658 on a0d04db3, including both Playwright
  suites. Fixes on the way:
  - e2e: `followLink` and `clickUntil` in `tests/e2e/utils/navigation.ts` retry clicks that are lost on long lesson
    pages, and the B-AXI-2 search test uses the renamed heading.
  - `requireSession` retries the user upsert once on P2002. Concurrent first requests raced to create the row.

  The 6b sweep stopped at the session limit: 109 agents failed, including 17 round-1 fixers, most checks, and every
  round-2 and round-3 critic. Its "two dry rounds" were not real. It was resumed with `resumeFromRunId` (task
  `wno3tqlqk`); cached agents replay and the failed ones rerun. Round 1 had already edited 12 files in the tree.
- 2026-10-25: The 6b sweep was resumed again (task `w0cd0g5b8`) after an expired login token failed every round-2
  and round-3 critic. Round 1 is fully done: 27 lessons, 7 lab files, 3 decks and the UVM interview bank are edited
  in the tree, not yet integrated.
- 2026-10-25: The owner asked whether the flow adds 2D/3D and interactive visualizations. It did not yet: 6a only
  embeds existing components. `visual-components.js` (run `wf_d75ad03e-524`, task `wfbmi7tpo`) now audits all 112
  lessons, builds the backlog, builds and reviews each new interactive, and registers them. It edits only `src/` and
  `tests/` (plus the two registry files), so it runs alongside 6b. Save its `lessonPlans` output for the 6a author
  step.

## Weekly pause, 2026-10-26 (owner: "at 65 % weekly limit we will pause this week's work")

The pause started at 61 % of the weekly limit, because two parallel workflows were spending about 6 % per 40 minutes. At the time of stopping, both workflows had only read-only agents running, so no edit was cut off.

**Live (`main` = 648bd15b, production build 7885a3e9 succeeded):** everything below has passed CI and is deployed.
- This session's engineering work, in 5f10ccf8:
  - the Verilator compile check (`npm run test:sv`);
  - e2e fixes and the `followLink`/`clickUntil` helpers;
  - the `requireSession` P2002 retry;
  - checkpoint-release.sh.
- 6b closure sweep, round 1 fixes (cd4aa4e2).
- 6b closure sweep, round 2 fixes (648bd15b). Every file passed its independent check or was repaired after one.
  Spot check: the live A-UVM-8 scoreboard declares `int unsigned n_match, n_mismatch;`.

Preview builds (fixed 2026-10-26, with the owner's approval). Every push to a non-`main` branch builds that
branch's own Cloudflare **Preview**, a separate Worker named after the branch, at
`https://<branch>-sv-uvm-guide.rakesh-n99.workers.dev`. Its deploy command is now
`npx opennextjs-cloudflare populateCache local && npx wrangler preview`.
- `wrangler preview` (open beta) needs a `previews` block in `wrangler.jsonc`. That block was missing, so every preview
  build failed after a good build.
- The `populateCache local` step copies the prerendered pages into the static assets, as `opennextjs-cloudflare deploy`
  does. Without it, the preview answered 404 for lessons and 500 for `/curriculum`.
- Now `wrangler.jsonc` has `previews.vars` (APP_URL and NEXTAUTH_URL, both the production origin).
- The build settings ("Previews Base" and the existing `curriculum-quality-program` Preview) carry the production
  build variables: NODE_VERSION=22, SKIP_DEPENDENCY_INSTALL=1, NEXT_TELEMETRY_DISABLED=1, APP_URL.
- Do not use `npx opennextjs-cloudflare upload` there. It uploads a version to `sv-uvm-guide` itself, and Wrangler
  rejects that from a Preview build ("name ... must match the name of your Worker").
- Previews have no NEXTAUTH_SECRET. Lesson pages work, but `/api/auth/*` would throw. No-login mode does not call it.

Production (`main`) still deploys with `npx opennextjs-cloudflare deploy`. checkpoint-release.sh checks only the
production build.

The working tree is clean except for `.claude/`. There is no unreviewed work, so no backup branch was needed.

**Resume next week, in this order.** Release with checkpoint-release.sh after each step. Pause at 65 % weekly; start
the wind-down at about 62 %.
1. **Finish 6b.** The run `wf_010d0167-550` (script `phase6-closure-sweep.js`) was stopped during round 3's read-only
   critique.
   - In this same session, resume it with `resumeFromRunId`: rounds 1 and 2 replay from cache, and round 3 runs live.
   - In a new session, rerun the saved script fresh. Its critics start at round 1 with no "seen" list, but rounds 1 and
     2 are fixed, so they look for what remains. It stops after two rounds with no new confirmed finding (at most 5).
2. **Compile-fix pass.** Follow the 2026-10-25 entry above. There are 60 known compile failures, minus any that 6b
   fixed (`npm run test:sv` lists them).
3. **Interactive components.** The run `wf_d75ad03e-524` (script `visual-components.js`) was stopped during the
   lesson audit, with 70 of 112 audits done.
   - In this same session, resume it with `resumeFromRunId`.
   - In a new session, run `docs/curriculum-quality/workflows/visual-components.js` with
     `args = visual-components-args.json` (the 112 lessons). Its audits run again.
   - Then save the `lessonPlans` output for step 4.
4. **Phase 6a.** Run visual-enrichment.js per tier, embedding the new components and adding the static visuals from
   the lesson plans. Run phase6a-extras.js for the hidden pages and labs. Release after each tier.
5. **Closure checks** (plan §5 item 4).

## Weekly pause, 2026-10-27 (owner: "work till 75% weekly usage")

The pause started at 71 % weekly. Both workflows were stopped while only read-only agents were running, so no edit was cut off.

**Burn rates measured this week:**
- Two workflows in parallel used about 3 % weekly per 10 minutes.
- One workflow alone used about 1 % per 9 minutes.

Plan next week's runs for that, and run one workflow at a time when the budget is tight.

**Released:**
- `main` = the pause checkpoint. It carries the two checked round-2 wording fixes (F4C and I-SV-3B), the
  `previews` block, and `staticPageGenerationTimeout: 300`.
- That timeout fixes failed production build ea57fd7b. There, `/curriculum/expert-index` passed the 60 s
  per-page limit on a slow Cloudflare builder.

**Resume next week, in this order:**
1. **6b sweep, round 3 onward** (run `wf_010d0167-550`).
   - The session copy of the script has `MAX_ROUNDS = 3`. Raise it to 5 first. Then resume with `resumeFromRunId`:
     rounds 1 and 2 and the finished round-3 critics replay from cache.
   - In a new session, rerun `docs/curriculum-quality/workflows/phase6-closure-sweep.js` (MAX_ROUNDS 5) fresh.
2. **Interactive components** (run `wf_d75ad03e-524`). It was stopped after 76 of 112 lesson audits, all cached.
   - Resume it with `resumeFromRunId` and `args = visual-components-args.json`.
   - The session copy builds only the top 8 components (`BUILD_CAP = 8`); raise the cap if the budget allows. The
     docs copy `visual-components.js` has no cap.
   - Start it only after 6b, or alone, because of the burn rate.
3. Compile-fix pass, then phase 6a, then closure checks. These are unchanged from the 2026-10-26 pause notes.

## Weekly pause, 2026-10-27, second session (owner: "work till 80% usage")

The owner restarted at 72 % weekly with a new limit of 80 %. This session ran the compile-fix pass, which was
step 3 of the earlier order and the work most likely to finish and deploy within the budget, then used the rest
of the budget on read-only lesson audits.

**Released** (both passed CI and were deployed; `main` = `04627c0c`, production build succeeded):
- **Checkpoint 1, `9f66e67a`: compile-fix pass on 24 failing units in 13 groups.** Each unit had one fixer, then
  an independent check.
  - I-UVM-2B: the scoreboard counter `matches` was a reserved keyword; it is now `n_match`/`n_mismatch`. The
    printed text is unchanged.
  - I-UVM-2B and A-UVM-4A: mixed time scales fixed by adding `timeunit`/`timeprecision` to the package.
  - B-AHB-3 and I-SV-6: multi-file benches now tag every file (`// compile: ahb_if.sv (file 1 of 6)` and so on).
  - The arbiter lab RTL now compiles with a sized round-robin index. That was a compile fix only; the pointer logic
    is still wrong (see the hidden bugs below). Both lab1_reference_model files gained their missing `endmodule`.
- **Checkpoint 2, `04627c0c`: limitation probe pass over the other 25 units.** It found that every one is legal
  IEEE 1800-2023 code that Verilator 5.052 rejects or crashes on. Each `known` entry in
  `scripts/sv-compile.config.json` now cites the LRM clause and gives the probe result: the construct, worked
  around in a copy, lints clean. The F2A index and operators-and-expressions "Run it" notes said the bench runs
  on Verilator with only its `x` checks failing. Verilator rejects both files at compile time, and the notes now
  say so.

**Compile check now:** 260 of 297 units compile (it was 254 of 307 before the pass; stale units are gone).
There are 37 known failures:
- 36 are Verilator limitations, each with its LRM clause. The main groups are:
  - coverpoint and cross member access, `cg.cp.get_inst_coverage()` (§19.8): 8 lesson units and 2 lab units;
  - `randomize(null)` (§18.11.1);
  - program blocks nested in modules (§24.3);
  - a 4-state right operand of `==?` or `inside` (§11.4.6, §11.4.13);
  - `$past` with gating (§16.9.3);
  - timing controls in DPI-exported tasks (§35.5.1.5);
  - clocking blocks reached through a modport (§25.5.5);
  - several internal errors (crashes).
- 1 is a harness case: the I-SV-6 kata solution uses a module from its Given block.

A unit in this list is not a content bug, and there is nothing left for a compile-fix pass to do. Revisit it only
when Verilator is upgraded (`--prune-known` lists any that start to compile).

**Hidden bugs recorded for phase 6a (not fixed; behaviour, not compile):**
- `content/curriculum/labs/common/rtl/arbiter.sv` ROUND_ROBIN: `last_gnt <= gnt` stores the one-hot grant, and
  `$clog2(N)'(last_gnt)` keeps its low bits instead of encoding it. With N = 4, grant `0100` gives a start offset
  of 0, not 2. Encode the one-hot grant (or keep a binary pointer), and start the search one past the last winner.
- `labs/arbiter/lab1_simple_tb/test_arbiter.sv` leaves `ARBITRATION_SCHEME` at its default, `"FIXED_PRIORITY"`, but
  `lab.json` says "Verify a synchronous round-robin arbiter". Make them agree, after the RTL fix.
- `labs/ahb_checker/lab1_monitor_checker` starters: the monitor instance in `tb_top` ships commented out, as a
  learner TODO, so `ahb_monitor` becomes a second top-level module with an unconnected interface port (§23.3.3.4).
  Verilator only warns. README Part 1 step 3 tells the learner to uncomment it, so leave it unless 6a changes the
  lab flow.

**Flaky account-mode e2e test: fix it first next week.** `tests/e2e/navigation.spec.ts:329`, "opens the account
and notification menus for a signed-in learner", failed in CI attempts 1 and 2 on `04627c0c`. Attempt 3 passed
and released the checkpoint. The same code passed twice on `9f66e67a`, on 10-27 and again at the pause. The
diff between the two is content only (two MDX prose lines and the compile config), so this is a flaky test, not
a regression. A flaky gate can hold back any release, so fix it before the next one.
- The snapshot from the failure (CI artifact `test-results`) shows the open account panel with "Not signed in" and a
  "Sign in" link. The session came back unauthenticated; it was not still loading, so a longer timeout will not help.
- The other signed-in tests in the same run passed. Those sign in before their first page load. This test's
  `beforeEach` loads `/curriculum` first, then it calls `authenticateTestLearner(page)` and `page.reload()`.
- Likely cause: on the cold `next dev` server, the client's first `/api/auth/session` request after the reload
  fails or races the on-demand route compile, and NextAuth then settles on unauthenticated. The other suspects
  are a stale status kept across the reload (`useSessionAccountSession` in `src/lib/persistence/target.ts`) and
  the sign-in cookie not reaching the page (`tests/fixtures/auth.ts`).
- Fix: sign in before the first `goto`, as the passing tests do. Alternatively, wait for a 200 from
  `/api/auth/session` after the reload, then assert "Sign out". Run the spec about 10 times in accounts mode
  (`--repeat-each`) to confirm the fix.
- Production runs in no-login mode (accounts off), so the live site is not affected.

**Interactive components (run `wf_d75ad03e-524`).** This session resumed it for its read-only lesson audits only.
The session copy of the script gained `STOP_AFTER_AUDITS = true`, which returns right after the Audit phase. It
was stopped at 78 % weekly, with 98 of 112 audits cached and 14 left. No build agent ran, and no file was edited.

**Usage this session:** 72 % → 78 %.
- Compile-fix pass (13 groups, 35 agents): about 2 %.
- Probe pass (17 groups, 35 agents): about 1.5 %.
- 22 lesson audits: about 2 %, roughly 1 % per 10 minutes.

**Order changed (owner, 2026-10-28): defer the 6b sweep until after 6a.** This goes back to the owner's
2026-10-18 order. 6a adds new text and visuals to every lesson, and those need the same review. One sweep after 6a
covers old and new together; sweeping now as well would pay for the critics twice. The two finished rounds are
not wasted, because 6a adds content and removes none.
- Rounds 1 and 2: about 100 file fixes. Raw S1 findings fell from 9 to 7, and the skeptics confirmed 91 % of
  findings in round 1 but 57 % in round 2.
- The 7 round-3 critics that finished cover only T1 and raised no S1. They raised 4 S2 findings, which no skeptic
  has checked yet. Check each by hand before fixing; it is quick, and 6a then does not build on them:
  - `content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx:897`: the cnt4 kata solution pairs
    the Wrap row with the mutant "Wraps at 14", which reportedly does not satisfy "only that row's check would
    catch".
  - `content/interview-questions/systemverilog.json:1134`: the `sv-functional-vs-code-coverage` answer says
    coverage metrics are tool-defined, not defined by IEEE 1800, which contradicts F1B (§40.2.1).
  - `content/interview-questions/systemverilog.json:112`: the `sv-equality-operators-x` rubric grades as weak the
    `===` X check that the mapped lessons teach.
  - `content/curriculum/labs/simple_dut/README.md:155`: the Step 7 table gives the all-tests BUG=2 run a single
    result, which reportedly does not match what lab.json Step 7 asks the learner to compare.
- **Do not resume `wf_010d0167-550` after 6a.** Its cache keys hash the prompts, which name files but not their
  contents, so a resume would replay critic results for the pre-6a text. Run
  `docs/curriculum-quality/workflows/phase6-closure-sweep.js` fresh, with MAX_ROUNDS 5.

**Resume next week, in this order.** Pause at the owner's threshold, and start the wind-down about 3 % before it.
0. **Fix the flaky account-mode test above**, so that releases stop depending on reruns. Then check the 4 S2
   findings above by hand.
1. **Interactive components** (run `wf_d75ad03e-524`, args `visual-components-args.json`). It edits only `src/`,
   `tests/` and `docs/visual-learning/`, never lessons.
   - In this session's copy, set `STOP_AFTER_AUDITS = false`, then resume. The catalog and 98 audits replay, and 14
     audits run live. Then come the Backlog phase, Build (`BUILD_CAP = 8`; raise it if the budget allows), Review
     and Integrate.
   - In a new session, run `docs/curriculum-quality/workflows/visual-components.js`. It has no stop flag and no cap,
     and all its audits run again.
2. **Phase 6a.** Run visual-enrichment.js per tier and phase6a-extras.js. Include the arbiter and lab fixes listed
   above. Release after each tier.
3. **Phase 6b: final closure sweep** over the enriched lessons. Run it fresh (see above), with MAX_ROUNDS 5.
4. **Closure checks** (plan §5 item 4).

The compile-fix pass is finished; it no longer appears in the order.

## Weekly pause, 2026-10-28 (owner: "resume and work till 90% usage for steps 1-3")

Usage 78 % → about 87 %. Steps 1 and 2 of the order above are done; step 3 (6a) has started (F1B done).

**Released** (each passed CI and was deployed; `main` = see the last checkpoint below):
- **Checkpoint 3, `199b5185`: flaky test fixed and four review findings corrected.**
  - `tests/fixtures/auth.ts` now confirms the session after test sign-in, and retries.
    - Root cause: NextAuth answers a CSRF mismatch on a credentials sign-in with 200 and
      `{url: ".../signin?csrf=true"}`, which the old fixture accepted.
    - A page opened before sign-in (a `beforeEach` `goto`) can have an `/api/auth/*` request in flight with no
      CSRF cookie; its response sets a new cookie, and the posted token no longer matches.
    - The first CI run after the fix passed, account mode included.
  - F1B cnt4 kata: Increment covers 0–14, the Wrap row's mutant is "Saturates: holds at 15", and a paragraph
    explains that a wraps-at-14 mutant is the Increment row's catch.
  - Interview bank:
    - IEEE 1800-2023 §40.2.2 defines statement, toggle, FSM and assertion coverage, so they are not tool-defined.
    - `!==` against a known expected value does flag X (§11.4.5).
  - simple_dut README: the BUG=2 all-tests totals depend on process order on one edge (§4.7). Checked by hand:
    `smoke` and `corners` never hit the race; `gaps` hits it, but its totals cannot change.
- **Checkpoint 4, `235f8641`: round-robin arbiter fixed.**
  - The arbiter now stores the winner's index and searches from one past it.
  - `test_arbiter.sv` selects ROUND_ROBIN and checks rotation, wrap and alternation. It passes 7 of 7 in
    Verilator 5.052, and it fails at 30 ns on the old RTL.
- **Checkpoint 5, `79a0ab01`: three interactive components from the components track** (run `wf_d75ad03e-524`).
  Each is clean on both lenses.
  - **visual-system primitives:** OutcomeGroups, ReorderList, MutationMatrix and BitStrip. They are not MDX tags;
    other components import them from `src/components/visual-system`.
  - **FirstBugHuntGame:** a vacuous success is neither a pass nor a failure (§16.14.8). The game adds a tally,
    and the AHB model's note uses the same wording. On the live F1B page the game renders, and "passes
    vacuously" no longer appears.
  - **ProceduralBlocksSimulator:** time-zero scenarios (`time0-reset`, `comb-vs-star`, `time0-race`,
    `decl-init-ready`, `initialVariant`), with a new `src/lib/sv-event-control-model.ts`.
  - The integrator ran the component, lib and render suites: 3296 tests passed; tsc and lint are clean.

**Not released: ScenarioSorter, escalated.** Its three review rounds each found a new S1 in the deck feedback.
It is on branch `backup/wip-2026-10-28-scenario-sorter` (`d173bb49`) and was removed from the main tree.
- Open at the stop:
  - **S1** `scenario-sorter-decks.ts:847`: the covergroup tile's uvm-core feedback says uvm-core uses
    covergroups. It declares none: a grep of uvm-core 2020.3.1 finds no `covergroup`.
  - **S3** `:442`: the summary promises "why the others do not". The reveal shows only the learner's pick and the
    best choice.
  - **S3** `:1159`: "How many keys does new() create?" reads as a question about the default, which is 0.
  - **S3** `:1782`: `withBins()` does not filter the follow-up options.
- Next: check out the branch, fix these, then run a fresh two-lens review before it goes anywhere near `main`.
  Its `PacketSorterGame.tsx` change also changes the live F2B game, so review that too.

**Components backlog** (in the final result of `wf_d75ad03e-524`):
- 48 components were ranked; 4 were built this week (`BUILD_CAP = 4` in the session copy) and 29 are deferred
  with reasons.
- The final backlog flags that the F3C audit input was cut off. Rerun that one audit before building for F3C.
- The full result (backlog, results, integration) is saved in the session scratchpad as `components-result.json`,
  with `lesson-plans.json` (all 112 lesson audits). These are session files, not committed. In a new session,
  rerun `visual-components.js`; its audits run again.
- To build the next batch in this session: raise `BUILD_CAP` (for example to 8) and resume `wf_d75ad03e-524`. The
  catalog, audits, backlog and the four finished builds replay from cache, and only new builds run.

**6a started on F1B** (run `wf_db5144d5-6ef`, `visual-enrichment.js` with `args.modules = ['F1B_The_Verification_Mindset']`).
- `visual-enrichment.js` now takes an optional `args.extraContext`. The lead used it to pass the new components'
  status, "do not embed ScenarioSorter", and the components track's audit of the lesson.
- F1B outcome: **clean** after three rounds. Accuracy passed in round 1. The learning lens caught two real
  problems: an 899-character caption, and the rule "zero nonvacuous successes means a check never ran", which is
  false because a failing check has none either.
  - The run made 16 additions: the six questions as predict-then-check; the four silent failures as a card grid; a
    `|->`/`|=>`/`disable iff` timing diagram; a predict-then-check on X; a bug-hunt step 4 for the tally; a hunt
    debrief table recomputed from `counter-bug-model`; and timing diagrams for the load-priority bug, the two-hot
    state and the WRAP_AT(6) mutant.
  - It also added: a code versus functional coverage table; `$onehot` and vacuity truth tables; an
    assert/assume/cover/restrict table; and a VisualRecap.
  - The lead also fixed "passes vacuously" in the cnt4 kata paragraph. This was the lead's own wording from
    checkpoint 3.
  - F1B was released as checkpoint 6, together with these notes. Usage at the pause was about 87 %.
  - The run asked for two new components: BenchMutationLab (high value) and MethodBudgetExplorer. Add them to
    the backlog.

**Resume next week, in this order:**
1. Finish 6a on T1, in small module batches. Include the components track's lesson plans in `extraContext`,
   and never embed a component that is not on `main`.
2. Fix and re-review the ScenarioSorter branch; build the next components batch (raise `BUILD_CAP`).
3. Phase 6a for T2–T4, plus `phase6a-extras.js` (hidden pages, coming-soon labs; the arbiter RTL is now fixed).
4. Final 6b sweep, run fresh, then closure checks.

**Burn rates this session:**
- Component builds: about 1 % weekly per 10 minutes with 4 builders.
- Single-agent backlog phases: about 0.3 % each, but 20–30 minutes each.

**Addendum, after checkpoint 6 (`d8c282a9`, live).** F1B cost only about 1 %, so 6a on F2C was started (run
`wf_a6a9e9ea-42c`, with the time-0 presets `time0-reset` and `comb-vs-star` in `extraContext`). The lead stopped
it at 88 % weekly, to stay under the owner's 90 %.
- `index.mdx` was authored (14 additions). Its round-1 review failed one lens with an S2 at line 368: the
  always_comb / always_latch / always_ff row of the new "Blocks and processes at a glance" table.
- The `flow-control.mdx` author was stopped mid-edit.
- Both drafts are on `backup/wip-2026-10-28-f2c-6a` (`bd809b05`), for reference only, and the main tree was
  reverted. Next week, rerun 6a on F2C from `main` with the same `extraContext`; do not merge the branch.
- Final usage this session: 88 % weekly. Nothing is running, and the working tree is clean apart from `.claude/`.
