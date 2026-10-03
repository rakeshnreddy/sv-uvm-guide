# Practical testbench mastery progression (2026-10-03)

A progressive path from a minimal DUT testbench to a reusable subsystem environment. Each milestone defines:
- an **observable outcome**: what the learner can show, not what they read;
- the **current evidence** in the repo;
- the **missing pieces**;
- **acceptance criteria** that would make completion meaningful.

Lab-level detail and per-lab defects are in [appendix H](appendices/H-labs-and-tb-progression.md).

Ratings: **P** present · **Pa** partial · **A** absent.

## Ladder at a glance

| # | Milestone | Instruction | Starter | Automated checks | Debug practice | Independent task | Overall today |
|---|---|---|---|---|---|---|---|
| M0 | Self-checking directed TB for a tiny DUT | P (F1–F2) | Pa (simple-dut-1 coming soon; basics-1 mis-graded) | A | A | A | Absent as a reachable lab |
| M1 | Race-aware, interface-based TB with clocking blocks | **P ✅** (F3B–F4C corrected; F3C model visuals) | Pa (constructs-1 coming soon) | A | **Pa ✅** (F3C RaceDebugChallenge, model-graded) | **Pa ✅** (F3C Kata 2, unscaffolded but not auto-checked) | Partial: concepts strong now, no runnable lab |
| M2 | Reusable UVM agent (active/passive, config object) | P (I-UVM-2A, A-UVM-7) | Pa (capstone TODOs) | A | Pa (config-debug typo) | A | Partial (weak) |
| M3 | Reference-model scoreboard with end-of-test accounting | P (A-UVM-6) | P (scoreboard-reference-model) | A | Pa (capstone `INJECT_FIFO_BUG`, but its reference monitor is wrong) | A | Partial |
| M4 | Coverage-driven environment with a measured closure loop | P (I-SV-3A/3B) | Pa (coverage-advanced-1 can't close) | A (runner coverage hard-coded 0) | A | A | Partial (weak) |
| M5 | Multi-agent environment with virtual sequences | P (I-UVM-3B, A-UVM-8; both contain broken exemplars) | A | A | A | A | **Absent** |
| M6 | Out-of-order / ID-aware protocol verification | P (B-AXI-3/5/6) | Pa (axi-scoreboard starter doesn't compile) | A | Pa (axi-deadlock analysis) | A | Partial |
| M7 | RAL-integrated environment with predictor | P (A-UVM-4A/4B; terminology inverted) | Pa (ral-mirror-bug fragment) | A | Pa | A | Partial (weak) |
| M8 | Subsystem/SoC capstone: reset, errors, concurrency, closure | P (E-SOC-1) | Pa (strategy document only) | A (self-scored) | A | Pa (document) | **Absent in code** |

**Diagnosis.** Instruction exists everywhere. The ladder breaks at three places:
1. **Execution:** the runner can't run UVM and isn't on by default.
2. **Verification of completion:** completion is self-attested.
3. **Independence:** there is no unscaffolded, auto-checked task.

M0, M5 and M8 have no runnable lab at all.

## Milestone definitions and acceptance

### M0: Self-checking directed testbench
- **Observable:** for a 4-bit counter or AND gate, the learner writes a TB that prints `PASS n FAIL 0` and fails loudly on an injected DUT bug.
- **Instruction:** F1B mindset, F2C/F2D procedural and system tasks.
- **Missing:** make `simple-dut-1` available, with steps that match its README; replace the `basics-1` token grader.
- **Acceptance:**
  - Runner-graded.
  - The clean DUT run matches `^PASS=\d+ FAIL=0$`.
  - Hidden mutant (stuck bit) → learner TB reports `FAIL>0`.
  - Starter blocking drives at the edge are flagged as the bug to fix.

### M1: Race-aware interface TB ← this session's visual slice prepares it
- **Observable:**
  - The learner converts a racy TB (blocking drives at `@(posedge clk)`) into an interface with `drv_cb`/`mon_cb` clocking blocks plus driver and checker tasks.
  - They can explain why results changed across simulators or source orders.
- **Now available:**
  - F3C mental picture, synchronized trace, all-orders experiment, drive-style comparison, model-graded debugging challenge, Kata 1 (guided) and Kata 2 (independent).
  - F4C corrected (`Re-NBA`, `@(cb)` in Observed, `default clocking`).
- **Missing:** "Race-Free Pipeline TB" lab (non-UVM; Verilator `--timing`).
- **Acceptance:**
  - Clean `PASS=N FAIL=0`.
  - Mutants pass/fail as expected: DUT samples on negedge; one extra cycle of latency; TB reverts to a blocking drive. Each must produce `FAIL>0` or a race detection.
  - A lint rule: no TB-side assignment to DUT inputs outside a clocking block.
  - Pre-lab gate: the F3C RaceDebugChallenge was solved, with a correct suspect and a hardware-faithful fix.

### M2: Reusable UVM agent
- **Observable:**
  - The learner builds a valid/ready stream agent: driver via `vif.drv_cb`, monitor via `vif.mon_cb`, sequencer, and an agent config object `{vif, is_active, coverage_enable}`.
  - It is reused **active** in one env and **passive** in a second.
- **Missing:**
  - an agent config object anywhere in the curriculum;
  - `get_is_active()` usage;
  - a runnable UVM env at the end of T2. I-SV-9 promises one, but it doesn't exist.
- **Acceptance:**
  - The active run drives N items.
  - The passive topology has no driver/sequencer (checked against a `print_topology` signature).
  - The passive monitor count equals N.
  - `UVM_ERROR : 0`.

### M3: Reference-model scoreboard with end-of-test accounting
- **Observable:** the scoreboard predicts from inputs, matches outputs, reports unmatched expected/actual at `check_phase`, and keeps the test alive until it drains, using an objection or a drain condition (not `#100`).
- **Missing:**
  - fixed scoreboard-lab accounting (LAB-S1);
  - a fixed capstone monitor (LAB-C1/C2);
  - an EOT accounting lesson section in A-UVM-6.
- **Acceptance:**
  - Clean `SCB_SUMMARY matches=N mismatches=0 pending=0`.
  - Mutants: dropped output, wrong opcode, extra output. Each must give ≥1 `UVM_ERROR`.
  - A "zero transactions observed" run must fail.

### M4: Coverage-driven environment with a closure loop
- **Observable:** from a 6-row plan excerpt, the learner writes coverpoints, crosses and exclusions; measures holes; adds directed or biased stimulus; closes to 100% within a run budget.
- **Missing:**
  - covergroup support in the runner backend;
  - real coverage parsing;
  - a closure lab that is solvable as written.
- **Acceptance:**
  - Grader parses the coverage report.
  - Plan IDs appear in `option.comment`.
  - `illegal_bins` never hit.
  - Closure in ≤ K seeds.

### M5: Multi-agent environment with virtual sequences
- **Observable:** a config agent and a data agent with a virtual sequencer; the virtual sequence enforces config-before-data and handles a mid-stream reconfiguration.
- **Missing:**
  - all lab material;
  - corrected I-UVM-3B and A-UVM-8 exemplars (remove invented APIs and hanging forks).
- **Acceptance:**
  - Scoreboard 0 mismatches.
  - An ordering assertion holds.
  - A hidden mutant virtual sequence (`fork` without ordering) is caught by the learner's checks.

### M6: Out-of-order / ID-aware protocol verification
- **Observable:** an AXI read scoreboard with per-ID queues that accepts legal cross-ID reordering and rejects same-ID reordering, a missing `RLAST`, extra beats, and a wrong `RID`.
- **Missing:**
  - a compiling starter;
  - multi-beat and interleaving stimulus via a reordering slave model;
  - random READY/backpressure;
  - error responses.
- **Acceptance:** clean `MATCH=N`; the four mutants each produce ≥1 error.

### M7: RAL-integrated environment
- **Observable:**
  - From a 4-register spec (RW, RO, W1C, volatile counter), the learner writes the register block, adapter and explicit predictor.
  - Runs `uvm_reg_hw_reset_seq` and a W1C test.
  - Explains desired vs mirrored values.
- **Missing:**
  - correct terminology in A-UVM-4B;
  - desired/mirror/`set`/`update` teaching;
  - a runnable buggy environment.
- **Acceptance:** clean `UVM_ERROR : 0`. Mutants (wrong reset value, W1C implemented as RW, predictor disconnected) each give ≥1 RAL error.

### M8: Subsystem capstone (unscaffolded)
- **Observable:** for a small DMA (configuration registers, AXI-lite-like memory port, interrupt), the learner delivers:
  - ≥2 agents, RAL, a reference-model scoreboard and a coverage plan;
  - reset asserted mid-transfer;
  - error-response injection and concurrent channels;
  - an E-SOC-1 strategy document as the planning step.
- **Missing:** everything except the strategy-document rubric.
- **Acceptance:**
  - Zero mismatches over K seeds.
  - Coverage ≥ X% on the provided plan.
  - Every hidden mutant (5) detected.
  - No false failure on 3 clean seeds.
  - Fully runner-graded.

## Guided → independent transitions

| After | Guided practice | Independent practice |
|---|---|---|
| F3C / F4C | F3C debugger + challenge (✅ now); M1 lab | F3C Kata 2; spec-only "interface + clocking-block TB for a 2-stage pipeline" graded against timing mutants |
| I-UVM-3A | M2 agent with TODOs | Spec-only agent for a new stream protocol, reused passive |
| A-UVM-6 | Fixed scoreboard lab | Scoreboard for a pipelined DUT with latency and drops, against hidden mutants |
| I-SV-3B | Fixed closure lab | Close a new plan within a seed budget |
| I-UVM-3B / A-UVM-8 | Guided 2-agent virtual sequence | Add a third agent and an ordering rule with no TODOs |
| B-AXI-6 | Fixed AXI scoreboard | Multi-beat, interleaved, same-ID-ordered scoreboard from spec |
| A-UVM-4B | Guided RAL build | Spec-only register block with explicit predictor |
| E-SOC-1 | Strategy document | M8 code capstone |

**Hint fading.** The F3C challenge shows the pattern: three progressively revealing hints, a diagnostic for every wrong suspect, and a fix graded on two axes (deterministic, hardware-faithful). Reuse the `PredictionPrompt` and fading-hint pattern for every guided lab's pre-lab.
