# 6a author log: lab multi-agent-vseq (milestone M5)

## What was built

New lab `multi-agent-vseq` v1, "Multi-Agent Environment with Virtual Sequences", status `available`, in the new folder
`content/curriculum/labs/multi_agent/`. M5 had no lab before this.

- DUT `work/key_stream.sv`: a keyed byte-stream transformer with a configuration port (one write per cycle; `CTRL` EN and
  MODE at address 0, `KEY` at address 1) and a data stream in and out (one edge of latency). Rules R1-R4 in the README: a
  write updates at its edge and a byte at the same edge uses the old values; bytes sent while EN = 0 are dropped silently;
  XOR or ADD with KEY; configuration locked while EN = 1 (KEY write ignored, CTRL write changes EN only). Run-time
  `+BUG=1` (MODE ignored) and `+BUG=2` (EN one edge late), so one build serves every run.
- `work/mx_tb.sv` (starter) and `solution/mx_tb.sv`: three interfaces (`cfg_if`, `din_if`, `dout_if`; the DUT-driven one
  has no driving clocking block), `mx_pkg` with items, per-agent configuration objects, `cfg_agent` and `din_agent`
  (active, mode from the config object), `dout_agent` (always passive), agent sequences, `mx_env_cfg`, `mx_vsqr`
  (handles only), `mx_scoreboard` (three `uvm_analysis_imp_decl` imps; predictor state from the configuration monitor,
  committed by time stamp so same-edge write/byte pairs are predicted correctly in either process order; `ORDER` for R2
  and R4 violations; `SCB_MISMATCH`, `SCB_UNEXPECTED`, `SCB_PENDING`, `SCB_NO_TRAFFIC`; one `SCB_SUMMARY` line),
  `mx_env`, `mx_reconfig_vseq` (null checks; configure, burst, reconfigure at the safe point, burst), `mx_reconfig_test`
  (one objection, 20 ns drain, 100 us `set_timeout`, `RESULT TEST PASSED/FAILED` from the report server), and `tb_top`
  with `ORDER_SVA` and `LOCK_SVA`. The starter keeps the M2-level parts complete; TODOs are in the env (step 2), the
  virtual sequence (3), the scoreboard (4) and the assertions (5). The starter compiles and runs.
- `work/mx_mutants.svh` (complete, not edited by the learner, `include`d in `mx_pkg`): the hidden mutants of the spine card.
  `mx_data_first_test` (fork config and data), `mx_no_quiesce_test` (KEY and MODE written while enabled), both factory
  overrides of `mx_reconfig_vseq`, and `mx_passive_cfg_test` (passive configuration agent, null `cfg_sqr`).
- README: spec, topology table, scenario table with every byte and expected output, seven steps with predict/answer
  details, captured logs, mutant table, a bug table (two planted bugs plus the learner's own lock bug, which only mutant 2
  catches), run commands, Verilator notes, PASS/FAIL rules, checklist, references.
- lab.json: owningModule `A-UVM-8` (spine card: "Feeds milestone: M5 (gate)", "LAB-M5 (not built)"; I-UVM-3B's
  coordinated-attack-lab is the pre-lab). modulePrerequisites `["I-UVM-3B", "A-UVM-7", "I-SV-5"]` (the card's
  prerequisites); labPrerequisites `["uvm-mini-capstone"]` (M2). Seven steps, all `self_attested`; no grader id added.
  `node scripts/generate-lab-registry.mjs --stdout` accepts it (not written to `src/generated/`).

## Sources verified

- IEEE 1800.2-2020 (uvm_lrm.txt, read in place): §13.4.2.2 `get_is_active`; §14.2.3.1 `start`; §8.2.4.2.5
  `uvm_object_registry::set_type_override`; §10.5.1.3.7 `set_drain_time`; §6.5.1.2.6 `get_severity_count`; §6.5.1.2.18
  `get_server`; Annex B.3.3 `uvm_declare_p_sequencer`; Annex B.5.22 `uvm_analysis_imp_decl`; Annex C.4.2
  `uvm_config_db`; Annex F.7.3.3 `set_timeout`; Annex G.2.1 `+UVM_TESTNAME`.
- IEEE 1800-2023 (t1_lrm_clean.txt): §3.14.2.3; §4.7; §9.3.2; §14.4; §14.13; §14.16 and §14.16.2 (the last synchronous
  drive maturing in one Re-NBA region is the value driven; glitch otherwise); §16.5.1; §16.9.3.
- uvm-core 2020.3.1 sources (`/Users/Rakesh/Downloads/1800.2-2020.3.1`): with `UVM_NO_DPI`, `uvm_root.svh` reads
  `UVM_TESTNAME` directly and warns `NO_DPI_USED`. No external URLs, dates or history are cited.
- Terminology §5.1: "shadow register" and "time step" avoided in prose and comments ("predictor's copy", "time slot").

## Verilator (5.052, installed; uvm-core 2020.3.1 as UVM_HOME)

Lint, from the lab folder, both units, 0 errors (warnings only: DECLFILENAME, UNDRIVEN/UNUSEDSIGNAL on class members and
interface signals):

```
verilator --lint-only -Wall --timing -Wno-fatal --timescale 1ns/1ps +define+UVM_NO_DPI -I$UVM_HOME/src -Iwork \
  $UVM_HOME/src/uvm_pkg.sv work/key_stream.sv solution/mx_tb.sv --top-module tb_top     # exit 0
  (same with work/mx_tb.sv)                                                            # exit 0
verilator --lint-only -Wall --timing work/key_stream.sv                                # exit 0, no warnings
```

The exact `scripts/compile-sv.mjs` argument set (no `--timescale`) also gives no `%Error` and no TIMESCALEMOD outside
`$UVM_HOME` for either unit.

Simulation (self-checking): `verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps
+define+UVM_NO_DPI -I$UVM_HOME/src -Iwork $UVM_HOME/src/uvm_pkg.sv work/key_stream.sv solution/mx_tb.sv --top-module
tb_top`, then `./obj_dir/Vtb_top +UVM_TESTNAME=<test> [+BUG=n]`. Final build, every row captured:

| Test | BUG=0 | BUG=1 | BUG=2 |
|---|---|---|---|
| mx_reconfig_test | matches=12 mismatches=0 pending=0 order=0, TEST PASSED, UVM_ERROR 0, $finish at 245ns | matches=7 mismatches=5, 5 errors | matches=0 mismatches=10 pending=2, 11 errors |
| mx_data_first_test | matches=9 order=3, 6 errors (3 ORDER_SVA + 3 ORDER at 55/65/75 ns) | matches=4 mismatches=5 order=3, 11 errors | matches=0 mismatches=7 pending=2 order=3, 14 errors |
| mx_no_quiesce_test | matches=12 order=1, 2 errors (LOCK_SVA 145 ns, ORDER 155 ns) | same as BUG=0 | matches=0 mismatches=11 pending=1 order=1, 14 errors |
| mx_passive_cfg_test | UVM_FATAL [NO_SQR] at 0 | same | same |

UVM_WARNING is 2 in every run (NO_DPI_USED, NO_VISIT_CHECK from `UVM_NO_DPI`).

Extra captured runs, quoted in the README:
- Starter as shipped: `UVM_FATAL [NO_CFG] cfg_agent_cfg not set for this agent` at 0 (uvm_test_top.env.cfg_agt).
- Starter plus the step 2 env code: `SCB_SUMMARY matches=0 mismatches=0 pending=0 order=0`, `RESULT TEST PASSED` at 20 ns
  (the vacuous pass step 2 asks about).
- Own bug (`mode <= cfg_wdata[1]` without the `!en` guard): reconfig PASSED (escape), data_first unchanged,
  no_quiesce matches=6 mismatches=6 order=1, passive unchanged.
- Solution variant without the `check_handles()` call: `mx_passive_cfg_test` ends `UVM_FATAL [PH_TIMEOUT]` at 100 us.
- Solution variant whose `write_cfg` applies on arrival: reconfig still PASSED; data_first ends
  `matches=0 mismatches=9 pending=1 order=2` (Verilator ran the configuration monitor first at 75 ns).

Build cost: 82-307 s per build, about 154 MB of objects; scratch builds were deleted after each run.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/lab-registry.test.ts tests/lib/lab-assets.test.ts
  tests/lib/lab-graders.test.ts`: 42 passed (they read the generated registry, which does not yet include this lab).
- `node scripts/generate-lab-registry.mjs --stdout`: schema, assets and owning module accepted.
- No MDX was touched, so `check-mdx` was not needed; no TypeScript was touched.

## Shared-file requests (Integrate step)

1. `src/lib/learning-paths.ts` MILESTONES: `{ id: 'M5', name: 'Multi-agent environment with virtual sequences', lab: 'multi-agent-vseq' }`.
2. `tests/lib/learning-paths.test.ts:250` pins `['M5']` as the only milestone without a lab; change to `[]` (or drop the
   assertion).
3. `src/generated/lab-registry.ts`: regenerate (`node scripts/generate-lab-registry.mjs`).
4. `content/curriculum/labs/compile-units.json`: add `"multi_agent": [{ "name": "solution", "files":
   ["work/key_stream.sv", "solution/mx_tb.sv"], "includeDirs": ["work"], "uvm": true }, { "name": "starter", "files":
   ["work/key_stream.sv", "work/mx_tb.sv"], "includeDirs": ["work"], "uvm": true }]` (`mx_mutants.svh` is only
   `include`d).
5. `src/lib/practice-links.ts`: none required (the lab launches from its owning module's index, the registry default).
   Optional `LAB_LESSON_OVERRIDES['multi-agent-vseq'] = ['A-UVM-8_Multi_Agent_Topologies/index',
   'I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab']` so the pre-lab links forward.
6. Lessons that still call the lab planned: `A-UVM-8_Multi_Agent_Topologies/index.mdx:2120` ("LAB-M5 (planned) ... It is
   not available yet") and `I-UVM-3B.../coordinated-attack-lab.mdx:1300` ("LAB-M5 (planned)"). Replace with
   `<LabLink labId="multi-agent-vseq" />` and one line on what it adds (time-stamped cross-agent scoreboard, three
   mutants). No test was found that pins this lab as coming_soon.
