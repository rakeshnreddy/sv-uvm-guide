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
