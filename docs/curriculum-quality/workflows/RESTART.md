# Restarting the curriculum workflows

Written 2026-10-12, when the weekly usage limit paused the program. Read this first in the next session,
then `docs/curriculum-quality/plan.md` (§3 wave table) and the backlog in `TASKS.md`.

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
  (`content/curriculum/labs/compile-units.json`). 245 compile; the 64 that fail are listed under "known" in
  `scripts/sv-compile.config.json`. CI pulls verilator v5.052 too.
  - Two CI fixes are also in: the whole-curriculum tests yield between lessons (04a6269b), and validate:content accepts
    `url` on lesson sources.
  - **Next, after the 6b sweep integrates and before 6a: the compile fix pass.**
    1. Run `UVM_HOME=/Users/Rakesh/Downloads/1800.2-2020.3.1 node scripts/compile-sv.mjs --report <scratch>/sv-report.json`.
    2. Then `node docs/curriculum-quality/workflows/compile-fix-args.mjs <scratch>/sv-report.json > <scratch>/args.json`.
    3. Run `docs/curriculum-quality/workflows/compile-fix.js` with the Workflow tool's `scriptPath` and those args.
    4. Update the "known" list from its report: remove fixed units, and replace each to-verify reason with the verdict.
    5. Run `npm run test:sv`, then integrate.
