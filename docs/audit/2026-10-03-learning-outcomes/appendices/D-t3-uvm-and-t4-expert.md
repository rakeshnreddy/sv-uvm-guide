> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# Audit: T3 UVM modules (A-UVM-4A..8) and T4 Expert modules

Repo: /Users/Rakesh/Projects/sv-uvm-guide @ main 488f7f43. Read-only audit, 2026-10-03.
Scope: deep pass on the 6 T3 UVM modules, moderate pass on E-CUST-1, E-DBG-1, E-INT-1, E-PERF-1 and E-SOC-1, lighter pass on the other 7 T4 modules. I also read the labs these modules link, plus the flashcard registry, the interactive registrations and the components the modules use.

Method: I read every MDX file line by line, read the linked lab README, lab.json and solution files, and grepped the whole curriculum to check whether key concepts appear anywhere else (results in section 0.3). I did not compile or simulate any code. "Compile error" findings come from reading against SV and UVM rules, and the confidence is stated on each one.

External checks (WebSearch):
- IEEE 2401 is the "LSI-Package-Board Interoperable Design" format (2015/2019), not PSS ([snv.ch listing](https://connect.snv.ch/fr/ieee-2401-2019), [ANSI preview](https://webstore.ansi.org/preview-pages/IEEE/preview_2401-2019.pdf)).
- IEEE P2851 is a functional-safety and dependability data exchange standard, not PSS ([IEEE SA 2851 overview](https://sagroups.ieee.org/2851/wp-content/uploads/sites/131/2021/03/P2851_overview_general-1.pdf)).
- PSS is maintained as an Accellera standard; I found no IEEE number ([Accellera PSS downloads](https://eda.org/downloads/standards/portable-stimulus), [Accellera PSS 2.1 news](https://us.design-reuse.com/news/54986/accellera-portable-test-and-stimulus-standard-2-1.html)).
- UVM Connect (UVMC) was developed by Mentor Graphics (now Siemens) and donated to Accellera. It is not a Synopsys product ([Verification Academy UVMC overview](https://verificationacademy.com/verification-methodology-reference/uvmc-2.3.2/docs/html/files/docs/OVERVIEW-txt.html), [Siemens blog](https://blogs.sw.siemens.com/verificationhorizons/?p=5840)).
- ZeBu is FPGA-based (Xilinx VU19P) ([Synopsys ZeBu EP1 release](https://news.synopsys.com/2021-05-13-Synopsys-Extends-Verification-Hardware-Market-Leadership-with-Breakthrough-Emulation-Performance), [ACL Digital comparison](https://www.acldigital.com/?p=96615)).
- In 1800.2, Clause 18 = register model and Clause 19 = register-layer interaction (adapter, predictor, sequences). This is Medium confidence, based on secondary sources ([Verification Academy uvm_reg_adapter](https://verificationacademy.com/verification-methodology-reference/uvm/docs_1.2/html/files/reg/uvm_reg_adapter-svh.html)).

I did not verify any other clause numbers. Where I mention one below it is marked "clause unverified".

Coverage scale: 0 = absent or name-only, 1 = described or shallow (snippet, no reasoning), 2 = solid (reasoning, a worked example, and either practice or a check).
Columns: E = Explain, P = Predict, A = Apply (write code), D = Debug misuse, T = Transfer.

---

## 0. Executive summary

**The T3 UVM block is not safe to learn from as it stands.** It names the right topics, but its instruction contradicts UVM semantics in exactly the places the brief flagged:

1. **RAL prediction terminology is inverted.** The lesson, a sub-page and an interactive call the predictor-based flow "implicit". The flashcard deck and the lab README use the standard UVM meaning: explicit = `uvm_reg_predictor`, implicit = auto-predict. The lesson also claims implicit prediction is the default, and that `set_auto_predict(1)` "disables the predictor pipeline". Severity S1.
2. **Backdoor semantics are wrong, and two quizzes grade the wrong answer as correct.** They teach that `poke()` needs a manual `predict()`. In fact `poke()` and `peek()` update the mirror themselves. Severity S1.
3. **Several APIs are made up and code would not compile:** `uvm_reg_bit_bash_seq::is_legal()` (also graded correct in a quiz), `register_sequences`, `model.default_map.regs[i]`, the `uvm_mem` and `uvm_mem_mam` constructors, `predict(val, -1, UVM_BACKDOOR)`, and `uvm_report_sequences`. Severity S2.
4. **Callback attachment timing is wrong in both the lesson and the lab solution.** `uvm_callbacks::add(env.agent.driver, cb)` is called in the test's `build_phase`. At that point the handle is still null, so the callback silently becomes type-wide. Severity S2.
5. **The scoreboard material has gaps that cause false passes:**
   - The in-order "complete scoreboard" has no end-of-test check for items left in its FIFOs.
   - The out-of-order example keys one entry per ID, so a reused ID overwrites the earlier entry.
   - The drain example uses a fixed `#100ns` inside an unguarded `phase_ready_to_end`.

   The correct per-ID-queue out-of-order lab exists (B-AXI-6), but A-UVM-6 does not link it. Severity S2.
6. **The multi-agent examples contain the bugs they should be teaching.**
   - A background `forever` thread sits inside `fork...join`, so the test can never end.
   - A virtual sequence starts on the IRQ sequencer, but the test configures that agent PASSIVE, so the sequencer is null.
   - Declarations come after statements, which is illegal SV.

   Severity S2.
7. **Whole competency areas are missing.** None of the six T3 modules teach:
   - RAL desired-vs-mirrored values, `set`/`update`/`get_mirrored_value`, `add_hdl_path`, `provides_responses=1`, or RAL coverage. Grepping the whole curriculum finds no occurrence of `add_hdl_path`, `update(`, or "desired value".
   - Driver or monitor code for a reusable agent: virtual-interface plumbing, reset handling, transaction cloning, responder agents.
   - Env reuse block → subsystem → SoC, or config-object hierarchies.
   - Reset or error injection in any T3 module.
   - Analysis of `uvm_event` races, or of `grab`/`lock`/arbitration in multi-agent stimulus.

**T4 is mostly overview with confident but unsupported numbers.** The best material is the SoC strategy artifact (E-SOC-1 table, risk register, and the strategy-capstone lab). The weakest is debug:
- E-DBG-1 has no `uvm_report_catcher`, no `+uvm_set_*` command-line controls, and no seed reproduction.
- The "Hang Lab" interactive does not provide the hang scenarios it promises.
- `effective-debug.mdx` is a 23-line stub.

Several T4 modules have factual errors:
- **Vendors:** ZeBu and Veloce architectures are swapped, Cadence Cerebrus is presented as a verification tool, and UVM-Connect is attributed to Synopsys.
- **Standards:** PSS is attributed to "IEEE 2401-2024" in one module and "IEEE P2851" in another.
- **Scheduler:** mixing `=` and `<=` is said to cause infinite delta loops.
- **RAL:** auto-predict is said to observe firmware writes.

**Practical readiness.** Of the six target milestones:
- Only "RAL-integrated env" (via the RAL lab solution) and a single-agent reference-model scoreboard (via `uvm-mini-capstone`) have runnable reference material.
- "Out-of-order protocol verification" is solid only in B-AXI-6, which is outside these modules.
- "Multi-agent env with virtual stimulus" and "subsystem/SoC capstone with reset, errors, concurrency and closure" have no implementation lab.
- Every lab is `self_attested`. No lab checks work, and no lab asks for independent design.

### 0.1 Module summary

| Module | Depth (1-5) | Strongest competency | Biggest gap | Severity |
|---|---|---|---|---|
| A-UVM-4A RAL Fundamentals | 2 | Explaining the block/reg/field/map hierarchy and the field `configure()` arguments (4A:22-109) | Desired vs mirrored, `set/update/mirror` semantics, `add_hdl_path`, `provides_responses`; mislabels `configure(this,null)` arg 2 as an HDL path | S2 |
| A-UVM-4B Advanced RAL (+3 sub-pages) | 2 | Mirror-not-updating debug checklist and its lab (4B:23-33, `ral-mirror-bug`) | Inverted implicit/explicit terminology; wrong poke/predict semantics graded correct; made-up built-in-sequence APIs; broken flashcard deck id | S1 |
| A-UVM-5 Callbacks | 3 | Three-part contract plus callback-vs-factory decision table (5:14-136) | Wrong attachment timing (null handle → type-wide); `const ref` misexplained; no `UVM_PREPEND`/`callback_mode` | S2 |
| A-UVM-6 Scoreboards | 3 | Analysis-FIFO pattern, reference model, zero-transaction false-pass guard (6:33-170, 262-271) | No end-of-test accounting in the in-order scoreboard; single-slot out-of-order map; timer-based drain; wrong claim that no `uvm_scoreboard` class exists | S2 |
| A-UVM-7 VIP Construction | 2 | Packaging, directory layout, active/passive build (7:30-77, 165-227) | No driver/monitor/vif/reset code; `$error` assertions invisible to UVM pass/fail; contradicts A-UVM-8 on how `is_active` is configured | S2 |
| A-UVM-8 Multi-Agent | 2 | Virtual sequencer + virtual sequence dispatch (8:54-156) | Hanging fork/join example; passive-agent sequencer used; no `grab/lock`, `uvm_event` race, env-of-envs reuse or config hierarchy | S2 |
| E-CUST-1 Methodology Customization | 2 | Governance (versioning, lint, adoption) (CUST:117-197) | Custom-phase code missing `exec_task` (cannot work); `proj_driver` not a `uvm_driver` | S2 |
| E-DBG-1 Debug | 1 | Triage-playbook concept and event-bus lab (DBG:42-53) | No report catcher, `+uvm_set_*`, recording, config/phase trace or seed reproduction; Hang Lab interactive mismatched; stub sub-page | S2 |
| E-INT-1 Formal Integration | 3 | Assumption pitfalls (over/under-constraint, vacuity) (INT:135-142) | Constraint↔assumption mapping overclaimed; "a CEX is a guaranteed bug" contradicts the under-constraint row; invalid `bind` | S3 |
| E-PERF-1 Performance | 1 | "Measure before tuning", reading a profile (PERF:43-59) | False scheduler "interview pitfall"; FIFOs said to give parallelism; no real UVM hotspots (config_db, messaging, objections, recording) | S2 |
| E-SOC-1 SoC Strategy (+pss) | 3 | Staff-level strategy artifact, risk register, liveness properties, capstone lab (SOC:64-133) | Auto-predict said to see firmware writes; no SoC reset/error strategy; PSS attributed to IEEE P2851 | S2 |
| E-AI-1 AI-Driven | 2 | Risks of LLM-generated SVA (AI:141-195) | Cadence Cerebrus misdescribed as a verification ML tool; unsupported ROI figures | S3 |
| E-EMU-1 Emulation | 2 | Pin-level vs transaction-level sync bottleneck (EMU:49-129) | ZeBu and Veloce architectures swapped; no SCE-MI or split HVL/HDL BFM pattern; invalid SVA example | S3 |
| E-PSS-1 PSS | 2 | Why portable intent matters (PSS:12-23) | Wrong IEEE number; resources used as action `input`, scalars as `output`; invalid `soft ... dist` syntax | S3 |
| E-PWR-1 Power-Aware | 2 | Power-cycle virtual-sequence recipe; isolation SVA (PWR:57-95) | Callbacks said to abort sequences; reset/abort mechanics missing | S3 |
| E-PYUVM-1 Python | 2 | SV vs pyUVM mapping table (PY:135-216) | AXI-Lite cocotb example holds AWVALID/ARVALID until response (protocol bug); cocotb 2.0 API drift | S3 |
| E-RISCV-1 RISC-V | 2 | Step-and-compare plus RVFI explanation (RV:131-235) | Made-up RISCV-DV `dist:` YAML; trace compare with `zip()` silently passes truncated traces; async events not covered | S3 |
| E-UVM-ML-1 Multi-Language | 2 | When DPI is enough vs a backplane (ML:12-22, 184-194) | UVM-Connect misattributed to Synopsys; project-status claims unsupported | S3 |

### 0.2 Assessment counts (T3)
- Interactive quizzes: A-UVM-6 has 4, A-UVM-7 has 3, A-UVM-8 has 4. 4A, 4B (index) and 5 have none.
- The 4B sub-pages have static "Quiz Yourself" bullets with the answer printed inline ("*(correct)*"), so learners cannot retrieve or predict before seeing it. Two of those answers are wrong (F-RAL-02).
- No module has predict-the-output or find-the-bug items. All quiz items are definition recall.

### 0.3 Concepts not found anywhere in the curriculum (grep)
- Absent everywhere: `add_hdl_path`, `uvm_report_catcher`, `UVM_PREPEND`, `callback_mode`, `wait_ptrigger`, `NO_REG_*` resource exclusions, `set_compare`, `uvm_reg_cbs`, `provides_responses = 1`, `add_submap`, `stop_sequences`, `uvm_reg_frontdoor`, and RAL `update()`/`set()`/"desired value".
- `get_mirrored_value` appears only in a lab solution.
- `phase.jump`, `set_drain_time` and `uvm_barrier` exist only in T2 I-UVM-1C. `grab`/`set_arbitration` exist only in T2 I-UVM-3B. None of these is cross-linked from A-UVM-8.

---

## 1. T3 deep audit

### 1.1 A-UVM-4A RAL Fundamentals
**Inventory**
- File: `content/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals/index.mdx` (194 lines).
- H2 sections: Quick Take, Build Your Mental Model (H3: block, map, reg/field, adapter, frontdoor flow, generation workflow), Make It Work, Push Further, Practice & Reinforce.
- Interactive: `<RalRegisterMapVisualizer/>` (4A:32). No quiz, no lab.
- Flashcards: frontmatter `A-UVM-4A_RAL_Fundamentals`, which is **not a key in `src/lib/flashcard-decks.ts`** (the registry key is `A-UVM-4_RAL`). `FlashcardWidget` therefore shows "No flashcards available" (FlashcardWidget.tsx:34-35, 65). Finding F-NAV-01.
- Next link → 4B. No prerequisite links.
- Code: block (snippet, no constructor), field reg (complete enough), adapter (complete). No env integration code (set_sequencer, predictor) at all; that is only described in prose (4A:179).

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| reg_block/reg/field build, lock_model | 2 | 0 | 1 | 0 | 0 | 4A:34-67, 88-109 |
| map(s), multi-map | 1 | 0 | 1 | 0 | 0 | 4A:69-82 |
| add_hdl_path / backdoor setup | 0 | 0 | 0 | 0 | 0 | absent; 4A:66 mislabels configure arg |
| adapter reg2bus/bus2reg | 2 | 0 | 1 | 0 | 0 | 4A:111-146 |
| provides_responses | 0 | 0 | 0 | 0 | 0 | 4A:122 comment only |
| frontdoor flow | 1 | 0 | 0 | 0 | 0 | 4A:148-158 (omits that prediction requires predictor or auto-predict) |
| access policies | 1 | 0 | 1 | 0 | 0 | 4A:86, 101-104 |
| generation/governance | 2 | 0 | 0 | 0 | 1 | 4A:160-173 |

**Accuracy findings**
- **F-RAL-01 (Confirmed defect, S3, High).** 4A:66 says "`configure(this, null)` sets the parent block and optional back-door HDL path." The signature is `uvm_reg::configure(uvm_reg_block blk_parent, uvm_reg_file regfile_parent=null, string hdl_path="")`. The second argument is the register-file parent, and the HDL path is the third. Combined with `add_hdl_path` being absent everywhere, learners cannot set up a backdoor.
  - Fix: correct the description and add an `add_hdl_path`/`add_hdl_path_slice` example.
  - Acceptance: the lesson shows a backdoor-capable register and a `peek` that returns the DUT value.
- **F-RAL-03 (Confirmed defect, S3, High).** 4A:101-104 configures a HW-driven `state` status field and a HW-set `error` W1C field with `volatile=0`. This contradicts 4B:66-75 and will cause false mirror mismatches. Fix: set volatile=1 or explain the choice. Acceptance: the example matches the 4B guidance.
- **F-RAL-04 (Missing coverage, S2, High).** The adapter section never says that on a **frontdoor read** the map calls `bus2reg()` on the item the driver completed (or on the response, if `provides_responses=1`) to obtain read data. 4A:146 lists only the predictor use. This is the main cause of "read returns 0", and `provides_responses=1` is never taught.
  - Fix: add a read-path walkthrough plus a debug exercise where the driver does not write read data back to the request.
  - Acceptance: a predict question ("driver returns rsp via put_response, provides_responses=0: what does read() return?").
- **F-RAL-05 (Interaction weakness, S3, High).** `bus2reg` sets `rw.status = UVM_IS_OK` unconditionally (4A:139). There is no mapping of PSLVERR or SLVERR to `UVM_NOT_OK`, and no error-response teaching.
- **F-RAL-06 (Confirmed defect, S4, Medium).** 4A:145 says `reg2bus()` is "used by the sequencer". The register map / `uvm_reg_sequence` path calls it, not the sequencer. Minor.
- **F-RAL-07 (Missing coverage, S2, High).** Desired vs mirrored value, `set()`, `update()` (writes only when desired != mirrored), `get()` vs `get_mirrored_value()`, `reset()`, `randomize()` on the model, and RAL coverage (`include_coverage`, `UVM_CVR_*`, `sample_values`) are absent from 4A and 4B. Grep finds no occurrence in the curriculum.
  - Fix: add a "model value semantics" section with a predict table (call → bus traffic? → desired → mirrored).
  - Acceptance: learners predict the result of `set(5); update(); set(5); update();` (second update: no bus write).

### 1.2 A-UVM-4B Advanced RAL (index + explicit-vs-implicit + frontdoor-vs-backdoor + built-in-ral-sequences)
**Inventory**
- Files: index.mdx (142), explicit-vs-implicit.mdx (90), frontdoor-vs-backdoor.mdx (69), built-in-ral-sequences.mdx (98). The three sub-pages are registered in curriculum-data (curriculum-data.tsx:621-631).
- Interactive: `<RALPredictorVisualizer/>` (4B:31). Static figure: mirror-health heatmap.
- Lab: `ral-mirror-bug` (4B:136, self_attested).
- Flashcards: `A-UVM-4B_Advanced_RAL` is **not registered** (F-NAV-01).
- Quizzes: static bullets with answers inline (explicit-vs-implicit:76-88, frontdoor-vs-backdoor:55-67, built-in:84-96).
- Next link: "Tier-4 methodology customization".

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| prediction modes (auto/explicit/passive) | 1 (inverted) | 0 | 1 | 1 | 0 | 4B:20-21, 77-102; e-v-i:17-20 |
| uvm_reg_predictor wiring | 2 | 0 | 1 | 1 | 0 | 4B:95-101; e-v-i:24-47; lab solution |
| mirror(UVM_CHECK) semantics | 1 | 0 | 0 | 1 | 0 | 4B:73, 117 |
| peek/poke/backdoor | 1 (wrong) | 0 | 1 (wrong) | 0 | 0 | e-v-i:59-68; f-v-b:26-47 |
| volatile/W1C/RC/W1S | 1 | 0 | 0 | 1 | 0 | 4B:64-75 |
| built-in seqs (hw_reset, bit_bash, access, mem_walk) | 1 | 0 | 1 (made-up) | 0 | 0 | built-in:15-73 |
| memories/MAM | 1 | 0 | 1 (won't compile) | 0 | 0 | 4B:35-62 |
| multi-map prediction | 1 | 0 | 0 | 0 | 0 | 4B:104-111 |
| RAL coverage | 0 | 0 | 0 | 0 | 0 | absent |

**Accuracy findings**
- **F-RAL-02 (Confirmed defect, S1, High). Inverted prediction terminology, plus a wrong default and wrong auto-predict semantics.**
  - Evidence:
    - 4B:21 "updates the register model's mirrored values automatically (implicit prediction)."
    - 4B:79 "By default, RAL uses **implicit prediction**: a `uvm_reg_predictor` component watches bus traffic".
    - 4B:81 "`set_auto_predict(1)` on a map **disables** the predictor pipeline".
    - explicit-vs-implicit.mdx:19-20 defines implicit = predictor, explicit = manual `mirror/peek/predict`.
    - `RALPredictorVisualizer.tsx:55,138` labels the predictor "Implicit Prediction".
  - The same site contradicts itself:
    - `content/flashcards/A-UVM-4_RAL.json:16`: "Explicit mode: the predictor is manually connected to a bus monitor's analysis port. Implicit mode: the RAL adapter updates the map directly."
    - `labs/ral_advanced/lab1_mirror_bug/README.md` ("This lab demonstrates **explicit prediction**").
  - Correct semantics, per UVM User Guide usage:
    - implicit = auto-predict (`set_auto_predict(1)`; the map predicts from the RAL-initiated operation);
    - explicit = `uvm_reg_predictor` fed by a monitor;
    - passive = a predictor observing traffic the RAL did not initiate.
  - The default is auto-predict off and **no** predictor, so the mirror is not updated by frontdoor accesses unless you wire one. `set_auto_predict(1)` does not disable a connected predictor. If both are active, the same operation is predicted twice (the lab README warns about this).
  - The auto-predict "cons" (4B:86) omit the main limitation: auto-predict cannot see traffic from other initiators (CPU, DMA, firmware).
  - Learner consequence: wrong interview answers, and a mirror that never updates in envs built from the lesson. The learner meets three conflicting definitions.
  - Fix: rewrite 4B:20-21, 77-102, e-v-i:13-20 and the visualizer labels to standard terms. Add a 3-row table (auto / explicit / passive) with "who updates the mirror, sees non-RAL traffic?, failure mode".
  - Acceptance: grep for "implicit" across content and components gives consistent definitions. Add a quiz item: "Firmware writes a scratch register; auto-predict on, no predictor. Does the mirror change?" (No.)
- **F-RAL-08 (Confirmed defect, S1, High). Backdoor `poke`/`peek` mirror semantics are wrong, and two quizzes grade the false answer as correct.**
  - Evidence:
    - e-v-i:62-63 `blk.status.poke(s, new_val); blk.status.predict(new_val, -1, UVM_BACKDOOR);`
    - e-v-i:84-87, where "Do nothing; it updates automatically" is marked wrong and "Call `predict()` or `mirror()` explicitly *(correct)*".
    - f-v-b:63-65, "Backdoor writes require… Updating the mirror manually *(correct)*".
    - f-v-b:22 "risk of divergence unless you update the mirror manually".
  - In UVM, `uvm_reg::poke()` and `peek()` (and backdoor `write()`/`read()`) call the register's internal `do_predict` after a successful access. Backdoor accesses therefore update the mirror without the `uvm_reg_predictor` component. What is true is that a **monitor-fed predictor does not see** backdoor accesses, and that `peek` of RC fields has side-effect caveats.
  - In addition, `predict(new_val, -1, UVM_BACKDOOR)` passes a `uvm_door_e` into the `kind` (`uvm_predict_e`) argument. Compile error or wrong semantics, High confidence.
  - Fix: correct the quizzes. Teach "the mirror updates, the predictor component does not see it". Show `predict(val)` only for sideband or HW-side changes such as DMA or interrupt status.
  - Acceptance: both quizzes key "updates automatically". Add a predict item on `poke` then `get_mirrored_value()`.
- **F-RAL-09 (Confirmed defect, S2, High). Built-in sequence APIs are made up.**
  - built-in:23-25 `constraint c_paths { register_sequences == {"cfg_map"}; }` — no such member exists in `uvm_reg_hw_reset_seq`.
  - built-in:30-31 `model.default_map.regs[i]` — `uvm_reg_map` has no public `regs`; use `get_registers()`.
  - built-in:45, 67-71 override `is_legal()` on `uvm_reg_bit_bash_seq` — no such method. Quiz built-in:92-95 grades it correct.
  - The real mechanism is resource-db attributes, for example `uvm_resource_db#(bit)::set({"REG::",rg.get_full_name()},"NO_REG_BIT_BASH_TEST",1,this)`, plus `NO_REG_HW_RESET_TEST`, `NO_REG_TESTS`, `NO_MEM_WALK_TEST`, etc. These appear nowhere in the curriculum.
  - built-in:46 says `uvm_reg_access_seq` is a "simple sweeping read/write". In fact it checks frontdoor-write/backdoor-read and the reverse, so it requires HDL paths. Mischaracterized.
  - Acceptance: every API in the page exists in the UVM 1800.2 reference implementation. Exclusions are taught with `NO_REG_*`. The quiz is re-keyed.
- **F-RAL-10 (Confirmed defect, S2, High). `uvm_mem` and MAM code would not compile.**
  - 4B:45-46 `sram = uvm_mem::type_id::create("sram"); sram.configure(this, 1024, 32, "RW");`. Size, width and access are `uvm_mem::new(name, size, n_bits, access, has_coverage)` arguments. `configure(parent, hdl_path)` takes no size.
  - 4B:58 `uvm_mem_mam mam = new("mam", sram.get_size());`. The constructor is `new(name, uvm_mem_mam_cfg cfg, uvm_mem mem=null)`.
  - 4B:59 "Claim 256 words": `request_region` takes **bytes**.
  - Acceptance: the code compiles against the UVM reference; a subclass `sram_mem extends uvm_mem` with `super.new(name,1024,32,"RW")` is shown.
- **F-RAL-11 (Unverified concern → likely defect, S3, Medium). Volatile fields and `mirror(UVM_CHECK)`.** 4B:73, 117 recommend scheduling `mirror(UVM_CHECK)` on interrupt-status/volatile registers. In the reference implementation a field configured `volatile=1` defaults to `UVM_NO_CHECK`, so `mirror(UVM_CHECK)` silently skips it unless `set_compare(UVM_CHECK)` is used (`set_compare` appears nowhere). Learners may believe volatile fields are checked when they are not. Fix: teach `set_compare`, `get_compare`, and the volatile-implies-no-check default.
- **F-RAL-12 (Confirmed defect, S3, Medium). Multi-map text (4B:106-111) implies per-map mirrors.** The mirror lives in the `uvm_reg`, which is shared by all maps. A predictor on map A updates the same register that a read via map B checks. What actually matters is that each bus with traffic needs a predictor bound to its own map (for address decode), and that address/rights may differ per map.
- **F-RAL-13 (Confirmed defect, S3, High). Env example and hybrid sequence are incomplete or would not compile.**
  - e-v-i:33-45 never calls `ral.build()`, `lock_model()` or `ral.default_map.set_sequencer(axi_agt.sequencer, adapter)`. Only the lab solution (testbench_solution.sv:222) does.
  - f-v-b:38 declares `uvm_reg_data_t data;` after statements (illegal SV).
  - f-v-b:34-35 pokes `control_config` then predicts `status` to 0 with no rationale.
  - Line-number callouts (e-v-i:50-51, f-v-b:46-47) do not match the code.
- **F-RAL-14 (Interaction weakness, S4, Medium).** 4B:91 says auto-predict is "never in production regressions". That is overly absolute. Many production envs where RAL is the only initiator use auto-predict legitimately. The correct rule is "only if the RAL is the sole initiator and the adapter round-trip is trusted".

**Lab `ral-mirror-bug` (owning module A-UVM-4B, self_attested)**
- `testbench_buggy.sv:4-6, 146-152` states the bug and the exact fix line in comments. The README (Step 3) also prints the fix. There is no diagnosis left to do.
- The buggy file has no driver, sequencer, DUT, test or `tb_top` (it ends at the env, line 154), so "Run the simulation" (Step 1) is impossible from the buggy file. Its stub monitor never writes `ap`.
- The solution is a good reference RAL-integrated env: real driver and monitor, `set_sequencer`, `set_auto_predict(0)`, predictor, and a `mirror(UVM_CHECK)` test.
- **F-LAB-01 (Interaction weakness, S2, High).** The debug lab does not exercise debugging.
  - Fix: remove the answer comments. Make the buggy file runnable. Add 2–3 alternative root causes (null `predictor.map`, `bus2reg` dropping `kind`, auto-predict + predictor double-predict, missing `set_sequencer`) chosen by seed or define.
  - Acceptance: the learner must name the cause from log evidence. A grader or a self-check (UVM_ERROR count == 0 and mirror == 0x55) is reported.

### 1.3 A-UVM-5 Callbacks
**Inventory**
- File: index.mdx (222 lines). H2: Quick Take, Build Your Mental Model, Managing Callbacks at Runtime, Callbacks vs Factory Overrides, Debug & Failure Modes, Push Further, Practice & Reinforce, References.
- No interactive, no quiz. Lab `callbacks-driver-behavior` (self_attested). Flashcards `A-UVM-5_Callbacks` resolve correctly.
- Prerequisites: I-UVM-1B, I-UVM-2A. The next link points to 4A, which is circular navigation (4A→4B→T4; 5→4A).
- Code: complete 3-part example (needs `typedef class my_driver;` forward declaration), add/delete/display snippets, run-phase toggling.

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| uvm_callback / `uvm_register_cb / `uvm_do_callbacks | 2 | 0 | 2 | 1 | 0 | 5:14-74 |
| add/delete, instance vs type-wide | 1 | 0 | 1 | 1 | 0 | 5:97-108, 163 |
| ordering | 1 (incomplete) | 0 | 0 | 1 | 0 | 5:87, 110, 148-149 |
| callbacks vs factory | 2 | 0 | 0 | 0 | 1 | 5:123-136 |
| ref/const ref semantics | 1 (partly wrong) | 0 | 0 | 1 | 0 | 5:76-83 |
| callbacks in monitors / uvm_reg_cbs | 0 | 0 | 0 | 0 | 0 | absent |

**Accuracy findings**
- **F-CB-01 (Confirmed defect, S2, High). The handle is null when the callback is attached.**
  - Evidence: 5:91 "Attachment ... (typically in `build_phase`)"; 5:149 "control the sequence of `add()` calls in your test's `build_phase`"; 5:172-179 "In test build_phase: ... `add(env.agent.driver, err_cb)`".
  - Lab: `labs/uvm_callbacks/lab1_driver_behavior/solution.sv:151-155` creates `env` and calls `add(env.drv, my_cb)` in the same test `build_phase`.
  - UVM builds top-down: the env's `build_phase`, which creates `drv`, runs after the test's `build_phase` returns. `env.drv` is therefore **null**, and `uvm_callbacks::add(null, cb)` registers a **type-wide** callback. The lab "works" only because there is one driver. With two drivers, both are corrupted. The later `delete(env.drv, my_cb)` (solution.sv:167) targets an instance queue the callback was never added to.
  - Fix: attach in `connect_phase`, `end_of_elaboration_phase` or `start_of_simulation_phase` (or via `uvm_top.find`). Teach the null-means-all-instances trap explicitly as a predict question.
  - Acceptance: lesson and lab add callbacks after build. Add a lab step with two driver instances where only one may be corrupted.
- **F-CB-02 (Confirmed defect, S3, High). `const ref` explanation.** 5:81 "By `const ref`: The callback can observe but not modify anything." For a class handle, `const ref` makes only the **handle** constant. The object's members can still be modified (`pkt.crc = ~pkt.crc` is legal). Learners will believe `post_send` hooks are read-only. Fix: state this, and recommend cloning or discipline for observers.
- **F-CB-03 (Missing coverage / defect, S3, High). Ordering.** 5:87, 110, 149 present FIFO add-order as the only rule. `uvm_callbacks::add(obj, cb, ordering=UVM_APPEND)` supports `UVM_PREPEND`. The ordering interaction between type-wide (`null`) and instance callbacks is not discussed. `callback_mode(0/1)` (enable/disable without delete) is absent.
- **F-CB-04 (Unverified concern, S4, Low-Medium).** 5:93, 152 claim iteration walks a "snapshot", so mid-iteration deletes do not affect the current pass. In the reference implementation `uvm_callback_iter` steps through the live queue by index (`get_next`), and I am not aware of any snapshot. Fix: remove the claim or verify it in a simulator.
- **F-CB-05 (Confirmed defect, S4, Medium).** 5:145 says a wrong type parameter "will silently attach". With `uvm_register_cb` checking, UVM issues a `CBUNREG` warning for unregistered pairs.
- **F-CB-06 (S4).** 5:155 says "sub-nanosecond per-bit driver loops", which confuses sim time with CPU time. 5:10, 218-219 cite Clause 10.7/10.8 (clause unverified).

**Lab**: scaffold plus solution. The task is guided ("flip parity, add 10 ns delay"), so it is Apply level 1. It has no check that a downstream scoreboard detects the parity error, and no independent design decision.

### 1.4 A-UVM-6 Scoreboards & Reference Models
**Inventory**
- File: index.mdx (370 lines). H2: Quick Take, Build Your Mental Model, Building a Transaction-Level Reference Model, The Complete Scoreboard, Handling Out-of-Order Transactions, Common Pitfalls, Knowledge Check, Hands-On Lab, Capstone Lab, References.
- Quiz: 4 recall items. Labs: `scoreboard-reference-model`, `uvm-mini-capstone` (both self_attested). Flashcards resolve.
- Prerequisite and next links use lowercase "pretty" slugs, which resolve through `findBySlug`/`toPrettyCurriculumSlug` (curriculum-data.tsx:1012-1016).
- The B-AXI-6 out-of-order lab (`axi-scoreboard-lab`) is **not linked**.

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| analysis FIFO vs imp | 2 | 0 | 2 | 0 | 0 | 6:33-69 |
| reference model separation | 2 | 0 | 2 | 0 | 0 | 6:71-96 |
| in-order matching | 2 | 0 | 2 | 0 | 0 | 6:98-168 |
| out-of-order, per-ID queues, tx IDs | 1 (single slot) | 0 | 1 | 0 | 0 | 6:172-246 |
| end-of-test accounting (check_phase, leftovers) | 1 | 0 | 1 | 1 | 0 | 6:170, 236-246, 262-271 (in-order example lacks it) |
| drain/objection until empty | 1 (flawed) | 0 | 1 | 0 | 0 | 6:273-287 |
| expected-vs-actual timing/latency | 0 | 0 | 0 | 0 | 0 | absent |
| reset flush / error-injection expectations | 0 | 0 | 0 | 0 | 0 | absent |
| monitor must publish clones | 0 | 0 | 0 | 0 | 0 | absent (6:289-302 covers prediction copy only) |

**Accuracy findings**
- **F-SB-01 (Confirmed defect, S3, High).** 6:10 "IEEE 1800.2-2020 does not prescribe a single `uvm_scoreboard` base class." `uvm_scoreboard` exists in UVM (a thin `uvm_component` subclass), and the module's own lab solution extends it (`labs/scoreboard/lab1_reference_model/solution.sv:25`). Fix: say it exists and adds no behavior.
- **F-SB-02 (Missing coverage, S2, High).** The "Complete self-checking scoreboard" (6:102-168) has no `check_phase` for unconsumed `input_fifo`/`output_fifo` entries. If the DUT drops the last output, `run_phase` blocks in `output_fifo.get()`, the phase ends when objections drop, and the summary reports PASS with an input left unmatched. The lab solution does this correctly (`solution.sv:82-91` checks `is_empty()` and accepted == processed). Acceptance: the lesson code includes a leftover check, plus a predict question about a dropped final output.
- **F-SB-03 (Confirmed defect, S2, High). Out-of-order design overwrites on ID reuse.**
  - 6:184 `my_transaction expected_queue[int unsigned];` and 6:211 `expected_queue[txn.id] = expected;`. Two outstanding items with the same ID (normal in AXI) overwrite each other. The quiz (6:331-339) and flashcard `A-UVM-6_Scoreboards.json` reinforce "associative array keyed by ID".
  - The correct per-ID ordered queue is in `labs/axi_scoreboard/lab1_out_of_order/solution.sv:58-60, 127-155`, but not in this module.
  - Also missing:
    - a race where the output is processed before the concurrently-collected input (6:200-203 `fork` threads with `uvm_error` on "unexpected" at 6:220-222);
    - where IDs come from (a DUT-visible tag vs a TB-only sequence number);
    - per-ID ordering as a protocol requirement vs design policy.
  - Acceptance: the code uses `expected[id][$]`, the unmatched-output race is explained, and the B-AXI-6 lab is linked.
- **F-SB-04 (Confirmed defect, S2, Medium-High).** Drain pattern 6:278-286: `phase_ready_to_end` raises an objection and forks `#100ns` then drops, **unconditionally and with no guard**. UVM calls `phase_ready_to_end` again after each drop, up to the `max_ready_to_end_iterations` limit (default 20 in the reference implementation), so this adds about 2 µs of fixed delay and never checks that anything is pending. The correct pattern raises only when work is outstanding (expected queue not empty, FIFO used() > 0), waits for that condition with a timeout, and drops. Alternatively, use the objection drain time (`phase.phase_done.set_drain_time`, covered in T2 I-UVM-1C).
- **F-SB-05 (S4).** In the in-order example, `output_txn.compare(expected)` compares every field, but the error message prints only `result`. If the output monitor does not populate operands, every compare fails. Teach a field-scoped `do_compare` or a dedicated result item.
- **F-SB-06 (Missing coverage, S3).** Not covered: monitors publishing a reused handle (scoreboard sees overwritten data; needs `clone()`), latency/timing checks, scoreboard flush on reset, expected-error accounting for error-injection tests, RAL-aware prediction (predictor reads the register model for configuration), and multi-stream merges.

**Labs**
- `scoreboard-reference-model`: the solution has strong end-of-test accounting. But it compares a single monitor stream that carries both inputs and result in one item, so it never practises two-stream matching. Guided TODOs only.
- `uvm-mini-capstone`: a good single-agent block env (agent, scoreboard, coverage, factory override, injected bug via `+define+INJECT_FIFO_BUG`, coverage threshold enforced with `uvm_error`, solution.sv:447-457). It has no reset, no config object, no virtual sequence and no multi-agent setup. Self-attested.

### 1.5 A-UVM-7 VIP Construction
**Inventory**
- File: index.mdx (313 lines). H2: Quick Take, What is a VIP, VIP Internal Architecture, Passive vs Active, Packaging, Integrating 3rd-party VIP, Knowledge Check, References.
- Quiz: 3 items. **No lab.** Flashcards resolve.
- Code: agent (complete), interface with SVA (complete), config object, package, parameterized-agent stub. No driver, no monitor and no virtual-interface plumbing anywhere.

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| config object | 1 | 0 | 1 | 0 | 0 | 7:143-158 |
| active/passive | 2 | 0 | 2 | 0 | 1 | 7:52-63, 133-163 |
| virtual interface handling | 0 | 0 | 0 | 0 | 0 | `cfg.vif` declared at 7:148, never set or used |
| driver/monitor implementation | 0 | 0 | 0 | 0 | 0 | absent |
| packaging/reuse | 2 | 0 | 1 | 0 | 1 | 7:165-227 |
| protocol checkers: interface vs monitor | 1 | 0 | 1 | 0 | 0 | 7:79-131, quiz 7:294-302 |
| parameterized VIP + factory | 0 | 0 | 0 | 0 | 0 | 7:229-237 stub only |
| reset handling, responder agents | 0 | 0 | 0 | 0 | 0 | absent |

**Accuracy findings**
- **F-VIP-01 (Confirmed defect, S2, High). Assertions report through `$error`, which the UVM pass/fail summary does not count.** 7:99-100, 107-108, 115-116 use `else $error(...)`. `$error` does not go through the UVM report server, so the UVM error count stays 0. A regression that keys on "UVM_ERROR : 0" passes with protocol violations unless the simulator exit status is also checked.
  - The quiz (7:294-302) says assertions belong in the interface and are "always on". But the package ships `apb_error_inject_seq.sv` (7:189), which conflicts with always-on assertions. No enable knob (`checks_enable` bit, `$assertoff`) is taught.
  - Fix: route the action block to `uvm_report_error` (or `` `uvm_error `` via a package function), add a `checks_enable` control, and discuss interface SVA vs monitor checking (passive reuse, coverage of assertions, error-injection waivers).
  - Acceptance: an example where a deliberately illegal transfer makes the test FAIL in the UVM summary.
- **F-VIP-02 (Missing coverage, S2, High).** No driver or monitor code, no virtual-interface `config_db` set in `tb_top` → get in agent/cfg → hand to driver/monitor, no null-vif check, no reset-aware driver/monitor (abort mid-transfer, flush), no `clone()` before `ap.write`, and no slave/responder agent. These are the core of the "reusable UVM agent" milestone. The mini-capstone lab partially fills this (single agent, no reset).
- **F-VIP-03 (Confirmed defect, S3, High).** APB assertions are weak or mislabelled. `p_setup_before_enable` (7:95-100) checks only `$rose(psel) |-> !penable`. It misses back-to-back transfers and the real rule (PENABLE rises only one cycle after a SETUP cycle with PSEL high), yet the message says "PENABLE asserted without SETUP phase". No PWRITE/PWDATA stability check, and no "PENABLE deasserts after completion" check.
- **F-VIP-04 (Confirmed defect, S3, High). Inconsistent active/passive mechanism across modules.** The A-UVM-7 agent reads `cfg.is_active` from a mandatory `"cfg"` object (7:49-50, 59). A-UVM-8's test sets the `uvm_agent` field `"is_active"` via `config_db` (8:262-271) and never sets `"cfg"`, so with the A-UVM-7 agent it would fatal `NO_CFG` or ignore the passive setting. Labs use `get_is_active()`. Teach one mechanism, and explain how `uvm_agent::get_is_active()` relates to a config object.
- **F-VIP-05 (Confirmed defect, S3, Medium).** 7:244-256 show "connect DUT to VIP interface" using `assign dut.apb_slave.psel = apb_master_if.psel;` (continuous assigns to hierarchical DUT ports). This risks multiple drivers. The normal practice is port connection at instantiation or `bind`.
- **F-VIP-06 (S4).** Unsupported numbers and overgeneralizations: "30–60% of testbench bring-up time" (7:9), "commercial VIP ... follows these exact patterns" (7:9), and "Your custom sequences must extend the VIP's base sequence class" (7:262).

### 1.6 A-UVM-8 Multi-Agent Topologies
**Inventory**
- File: index.mdx (382 lines). H2: Quick Take, Scaling Beyond a Single Agent, Virtual Sequencer Pattern, Virtual Sequence Construction, Cross-Agent Synchronization (events, semaphores), Topology Configuration, Worked Example, Knowledge Check, References.
- Quiz: 4. **No lab.** Flashcards resolve.
- Prerequisite links: I-UVM-3A, I-SV-5. It does **not** link T2 `I-UVM-3B/virtual-sequences` or `sequence-arbitration`.

**Concept coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| virtual sequencer + p_sequencer | 2 | 0 | 2 | 0 | 0 | 8:54-110 |
| virtual sequence with handles (no vsqr) | 0 | 0 | 0 | 0 | 0 | absent |
| cross-agent sync (events) | 1 | 0 | 1 (buggy) | 0 | 0 | 8:160-203 |
| shared-resource arbitration (semaphore vs grab/lock/arb modes) | 1 | 0 | 1 | 0 | 0 | 8:205-246 |
| barriers, objections in vseqs, end-of-test | 0 | 0 | 0 | 0 | 0 | absent |
| env reuse block→subsystem→SoC, config hierarchies | 0 | 0 | 0 | 0 | 0 | absent (8:248-286 is a flat config_db set) |

**Accuracy findings**
- **F-MA-01 (Confirmed defect, S2, High). The example never terminates.** 8:177-200 put Thread 3, "Background interrupt monitoring (always running)", inside `fork ... join`. If `irq_monitor_seq` runs forever (as described), `body()` never returns, the test's `vseq.start` never returns, and the objection is never dropped. The test hangs. Fix: `fork ... join_none` for the background thread (with `disable fork`/kill), or `join_any` on the foreground threads. Acceptance: a predict-the-hang question.
- **F-MA-02 (Confirmed defect, S2, High). Internal contradiction.** 8:269-271 configure `irq_agt` as UVM_PASSIVE. `dma_transfer_with_irq_vseq` (8:142-145) then starts `irq_wait_seq` on `p_sequencer.irq_sqr`, which is null for a passive agent, so `start(null)` fatals. Waiting for an interrupt should use a monitor event, analysis subscription or vif wait, not a sequence on a passive agent.
- **F-MA-03 (Confirmed defect, S3, High). Declarations after statements (illegal SV).** 8:188-189 (`wait_trigger(); dma_transfer_seq xfer_seq;`), 8:230-231 and 8:239-240 (`bus_lock.get(1); axi_write_seq wr = ...`). In addition, `soc_env` (8:77-109) and `dma_stress_test` (8:253-285) have no constructor, which is a compile error for components. The text calls the worked example "minimal but complete" (8:290).
- **F-MA-04 (Missing coverage, S2, High).** Not covered:
  - `uvm_event` race semantics: `wait_trigger` misses a trigger in the same time step; use `wait_ptrigger`, `wait_on` or `is_on`.
  - `uvm_event_pool`/`uvm_barrier` for N-agent synchronization.
  - Why a test-level semaphore does not arbitrate between sequencers.
  - Sequencer `lock`/`grab`/priority/`set_arbitration` (exists only in T2).
  - Passing the parent (`start(sqr, this)`).
  - Virtual sequences with handles (no virtual sequencer).
  - Env-of-envs reuse (block env reused passive inside a subsystem env, reusing block scoreboards and RAL sub-blocks via `add_submap`).
  - Hierarchical config objects (env_cfg → agent_cfg).
  - Mid-test reset or error injection across agents.
- **F-MA-05 (S4).** The modelling is confused: a "dma_agent" and `dma_transfer_seq` drive the DMA (the DUT) through its own sequencer. Normally a DMA is started via register writes and observed on its master port.

---

## 2. T4 audit

### 2.1 E-CUST-1 Methodology Customization (moderate-deep)
**Inventory**: index.mdx (214 lines). H2: Quick Take, Build Your Mental Model, Make It Work, Failure Modes & Methodology Drift, Push Further, Practice, References. Interactive `<MethodologyPhaseVisualizer/>`. Lab `methodology-custom-phase` (self_attested). Flashcards resolve. No quiz.

**Coverage**

| Concept | E | P | A | D | T |
|---|---|---|---|---|---|
| Project base classes | 1 | 0 | 1 | 0 | 0 |
| Custom phases | 1 | 0 | 1 (broken) | 1 | 0 |
| Governance/versioning | 2 | 0 | 0 | 0 | 1 |

- Evidence: base classes CUST:17-67; custom phases CUST:69-143; governance CUST:117-197.
- Phase jumping, report-server or catcher customization, and factory-policy layers are absent.

**Findings**
- **F-CUST-01 (Confirmed defect, S2, High). Custom phase cannot execute.**
  - `load_fw_phase extends uvm_task_phase` (CUST:74-86) does not implement `exec_task(uvm_component comp, uvm_phase phase)`. Without it, UVM never calls any component method.
  - `task soc_env::load_fw_phase(uvm_phase phase)` (CUST:97) is an out-of-block definition with no `extern` declaration, and it has the same name as the phase class.
  - The lab solution is correct: `labs/methodology_customization/lab1_custom_phase/solution.sv:21-25` has `exec_task` with `$cast(env, comp)`. The lesson teaches a version that silently does nothing or fails to compile.
- **F-CUST-02 (Unverified concern, S3, Medium-Low).** Lesson and lab add the phase to `uvm_domain::get_common_domain()` with `.after_phase(uvm_reset_phase::get())`. `reset_phase` lives in the UVM runtime schedule (the "uvm" domain), and reference examples usually add runtime phases to `uvm_domain::get_uvm_schedule()`. Whether `common.add()` can find `reset` from the common scope depends on `find()` scope rules. Needs a simulator run. Also, adding in `build_phase` should be justified (schedule edits must happen before the run phases start).
- **F-CUST-03 (Unverified concern, S3, Medium).** CUST:131-143 claim that a task phase inserted after `extract_phase` "gets no simulation time and its objections are never reached". I know of no basis for that in UVM. A task phase there would run and could consume time; the real hazard is ordering and semantics, not zero time. Rewrite or verify.
- **F-CUST-04 (Confirmed defect, S3, High).** `proj_driver extends proj_component` (CUST:53) is not a `uvm_driver`, so it has no `seq_item_port`. A single `uvm_component`-derived base cannot be the root of drivers, monitors and agents. The usual pattern is per-role bases (`proj_driver #(REQ) extends uvm_driver#(REQ)`) plus shared utility objects. `post_configure()` is never called by anything, and `proj_driver` has no constructor. CUST:147-152 (lint for raw `uvm_driver`) then contradicts the design.
- **F-CUST-05 (S4).** "Clause 6 (Component hierarchy)" (CUST:11, 210) is clause unverified. My recollection is that Clause 6 is reporting, which would make this likely wrong.

### 2.2 E-DBG-1 Advanced Debug (moderate-deep)
**Inventory**
- Files: index.mdx (58), effective-debug.mdx (23), hang-lab.mdx (44).
- Interactives: `<TelemetryEventBusVisualizer/>`, `<DebuggingSimulator scenario="hang"/>`.
- Lab: `debug-waveform-trigger` (self_attested). Flashcards resolve. No quiz.

**Coverage (systems debug).** All rows score 1 or less.

| Concept | Score | Evidence |
|---|---|---|
| failure triage | E1 | DBG:42-49 |
| verbosity/IDs | E1, contains an inaccuracy | DBG:18-22 |
| report catcher | 0 | not found in the curriculum |
| transaction recording | 0 here | T2 I-UVM-6 has it |
| waveform strategy | E1/A1 | DBG:33-36 plus lab |
| seed reproduction | 0 | DBG:49 "Reduce randomization seeds" is confusing |
| objection/phase/config tracing | E1 | hang-lab:27 only (`+UVM_OBJECTION_TRACE`) |

**Findings**
- **F-DBG-01 (Confirmed defect, S2, High). Hang Lab promises scenarios the component does not have.** hang-lab.mdx:16-23 promises three UVM hangs (missing `item_done`, stuck objection, `grab()` leak) with objection traces. `DebuggingSimulator` (`src/components/ui/DebuggingSimulator.tsx:109`) takes **no props**, so `scenario="hang"` is ignored. Its scenarios are generic "Null Pointer Dereference", "Race Condition" and "Memory Leak" (lines 16-60) with no UVM content. Learners get no hang-debug practice.
- **F-DBG-02 (Confirmed defect, S3, High).** hang-lab:30 "check the active sequence list via `uvm_report_sequences`". No such UVM API exists. Real options include sequencer `print()`, `is_grabbed()`, `current_grabber()` and `+UVM_OBJECTION_TRACE`.
- **F-DBG-03 (Confirmed defect, S3, High).** DBG:22 says `set_report_id_action_hier()` lets you "promote or demote categories from the command line without recompiling". That is a procedural API. The command-line equivalents are `+uvm_set_verbosity`, `+uvm_set_action`, `+uvm_set_severity` and `+UVM_VERBOSITY`. Verbosity and action are also conflated.
- **F-DBG-04 (Missing coverage, S2, High).** Not covered:
  - `uvm_report_catcher` (demote expected errors in error-injection tests);
  - `+UVM_MAX_QUIT_COUNT`, `UVM_STOP`/`UVM_EXIT` actions;
  - `+UVM_CONFIG_DB_TRACE`, `+UVM_PHASE_TRACE`, `factory.print()`, `print_topology`, `uvm_top.find`;
  - transaction recording for waveform correlation;
  - seed capture and replay (seed in log header, reproducible regression command), random stability when code changes;
  - failure signature bucketing.

  The flashcards (`E-DBG-1_Advanced_Debug.json`) mention several of these, but the lesson does not teach them.
- **F-DBG-05 (Prototype/gated, S3, High).** `effective-debug.mdx` is a 23-line placeholder ("Level 1/2/3") registered as a lesson (curriculum-data.tsx:874).

### 2.3 E-INT-1 UVM + Formal (moderate-deep)
**Inventory**: index.mdx (244 lines). Three `InteractiveCode` blocks, `<FormalVsSimulationVisualizer/>`, lab `formal-harness` (self_attested). No quiz.

**Coverage**: assumption pitfalls E2/D1 (INT:135-142); harness construction E1/A1 (INT:74-97); CEX replay E1/A1 (INT:144-191); coverage unification E1. Not covered: bounded vs full proof / inconclusive results, liveness vs safety, assume-guarantee, data-integrity checking in formal (symbolic or tracked data), and the fact that a simulation `assume` is checked against the TB.

**Findings**
- **F-INT-01 (Confirmed defect, S3, High).** INT:146 "that trace is a guaranteed bug witness". A CEX is a witness only relative to the assumptions. With under-constraint (which the module's own table at INT:140 lists) a CEX can be spurious. This misleads triage.
- **F-INT-02 (Confirmed defect, S3, High).** INT:92 "Map these directly from your UVM sequence constraints" and INT:103 "Every constraint block in a UVM sequence item has a formal equivalent". Sequence-item constraints are per-transaction and generated ahead of time. They cannot see cycle-level DUT state (`full_flag`, INT:112, is not visible at randomize time), and drivers often implement protocol rules that are not in constraints. Assumptions should come from the interface specification or upstream guarantees. Auditing "against actual UVM driver behavior" (INT:97, 139) imports TB bugs into the proof.
- **F-INT-03 (Confirmed defect, S3, High).** INT:53 `bind fifo dut_props (.clk(clk), ...)`: the module is named `fifo_properties` and no instance name is given. Invalid. INT:57-58 tool commands are generic pseudo-commands presented as a "Formal script". Label them as illustrative.
- **F-INT-04 (S3).** CEX replay via a transaction sequence (INT:156-191) assumes the driver reproduces cycle-exact timing, and it bypasses the item's own `c_legal` constraint by direct assignment. Neither is discussed.
- **F-INT-05 (S4).** References cite IEEE 1800-2017 §16–17 while the rest of the site uses 1800-2023. "1K–10K gates" (INT:90) is an unsupported number.

### 2.4 E-PERF-1 UVM Performance (moderate)
**Inventory**: index.mdx (128 lines). `<EventSchedulerVisualizer/>`, profile `InteractiveCode`, 3 static SVGs. No quiz. The `uvm-performance-1` lab has status `coming_soon` and no LabLink, although `labs/uvm_performance/lab1_bottleneck/tb_buggy.sv` and `tb_solution.sv` exist.

**Findings**
- **F-PERF-01 (Confirmed defect, S2, High).** PERF:41 "Interview Pitfall: Mixing `=` and `<=` indiscriminately causes the scheduler to 'thrash' ... stalling the simulator in an infinite delta-cycle loop." That is false. Mixing them causes races and simulation/synthesis mismatch. Zero-time loops come from combinational feedback or zero-delay oscillation.
- **F-PERF-02 (Confirmed defect, S3, High).** PERF:39 "Postponed Region: Executes sampling after all signals settle, preventing race conditions." Assertion and clocking-block input sampling happen in the **Preponed** region. Postponed is for `$strobe`/`$monitor`. The Preponed, Observed and Reactive regions are omitted.
- **F-PERF-03 (Confirmed defect, S3, Medium-High).** PERF:62, 121 "Decouple with FIFOs ... exploit parallelism" and "measure the win". Simulation kernels run SV processes on a single thread. Analysis FIFOs add copying and unbounded memory and give no CPU parallelism.
- **F-PERF-04 (Missing coverage, S3, High).** No actual UVM hotspots:
  - `config_db` wildcard lookups in loops;
  - `` `uvm_info `` cost (the macro guards formatting, but `$sformatf` outside the macro does not);
  - `uvm_field_*` automation cost;
  - per-item objection raise/drop;
  - transaction recording;
  - covergroup sampling granularity;
  - constraint-solver cost (`solve-before`, large arrays);
  - clocking-block vs per-edge wakeups.
- **F-PERF-05 (S4).** Tool flags are unverified. "Xcelium `simvision -profile`" (PERF:126) is wrong in kind, because SimVision is the waveform/debug GUI.

### 2.5 E-SOC-1 SoC Strategies (+ pss.mdx) (moderate-deep)
**Inventory**: index.mdx (150 lines), pss.mdx (64 lines). `<VIPReuseVisualizer/>`. Labs: `soc-vip-reuse`, `soc-strategy-capstone` (both self_attested). No quiz.

**Coverage**: active/passive reuse E2/A1 (lab); firmware handshakes E1; regression tiers E1 (SOC:90-102); formal/liveness list E2 (SOC:111-121); risk register E2/T1 (SOC:123-133). The capstone lab (`labs/soc_level/lab2_soc_strategy_capstone/README.md`) is the best transfer exercise in scope: it asks for a written strategy with an acceptance list and requires seed, RTL hash and firmware hash. It is self-attested and has a model answer.

**Findings**
- **F-SOC-01 (Confirmed defect, S2, High).** SOC:54 "Firmware writes to a scratchpad register; UVM RAL auto-predicts the write and tests can `wait(rm.scratchpad.get() == 0xDEADBEEF)`." This has three problems:
  1. Auto-predict sees only RAL-initiated accesses. Firmware traffic needs a passive predictor on the CPU-bus monitor.
  2. `get()` returns the **desired** value, not the mirror (`get_mirrored_value()`).
  3. `wait()` on a function-call expression has no reliable sensitivity, and `0xDEADBEEF` is C syntax (`32'hDEADBEEF` in SV).

  This is the same RAL misconception as F-RAL-02, now in a system context.
- **F-SOC-02 (Confirmed defect, S3, High).** SOC:101 lists "Scoreboard mismatch (Actual DUT bug)" as a triage category. A mismatch can come from a reference-model or test bug. This contradicts the capstone's own bucketing (firmware / UVM / RTL / test intent).
- **F-SOC-03 (Missing coverage, S2, High).** No SoC-level reset strategy (multi-domain resets, reset during outstanding traffic, TB component reset handling), error-injection plan, concurrency stress patterns, RAL integration at SoC (sub-blocks, `add_submap`, CPU vs debug maps), or quantitative closure criteria (code + functional + assertion coverage, bug-rate trend, regression pass-rate thresholds) beyond prose. The capstone template partially prompts for these.
- **F-SOC-04 (Confirmed defect, S3, High).** pss.mdx:8 "PSS 2.0, IEEE P2851". P2851 is a functional-safety data-exchange project. E-PSS-1:8, 348 claim "IEEE 2401-2024", and IEEE 2401 is the LSI-Package-Board format. So the site gives two conflicting and incorrect IEEE attributions.
- **F-SOC-05 (S4).** SOC:148-149 cite "IEEE 1800.2-2020 Clause 4.1.1" and "UVM User Guide Section 4.5.1" (both unverified, likely wrong). SOC:88 has the typo "unreachble".

### 2.6 Lighter T4 modules

**E-AI-1 (244 lines; quiz 3; no lab or interactive)**
- **F-AI-01 (Confirmed defect, S3, High).** AI:164-168: "Cadence Cerebrus ... Verification application: Intelligent seed selection, regression scheduling, and formal property guidance". Cerebrus is Cadence's implementation (RTL-to-GDS) optimization product, as the cited URL path itself shows (`digital-design-and-signoff/cerebrus-intelligent-chip-explorer`). Cadence's verification-AI product line is a different one (e.g., Verisium).
- **F-AI-02 (S4).** Unsupported quantitative claims ("50–80% of compute", "2–5×", "2–3×"). The "LLM-generated SVA" example at AI:124-127 has a false-fail when a read coincides with a write-when-full, and the module does not critique it. That is a missed chance to teach review.
- Strength: AI:141-195 is a sound reliability/vacuity caution.

**E-EMU-1 (307 lines; quiz 3)**
- **F-EMU-01 (Confirmed defect, S3, High).** EMU:35-36 call ZeBu "Custom processor-based". EMU:44 calls Veloce Strato "FPGA-based". ZeBu is FPGA-based (Xilinx VU19P). Veloce uses custom emulation chips. Palladium is processor-based.
- **F-EMU-02 (Confirmed defect, S4, High).** EMU:175-181 `valid |-> ##1 begin $display...; 1; end` is not legal SVA even as a "cannot run" example.
- **F-EMU-03 (Missing coverage, S3).** No Accellera SCE-MI, no split HVL/HDL (dual-top) BFM-in-interface pattern, and no streaming/pipes. "Remove `$display` from all synthesized code" (EMU:253) is overgeneralized; several emulators support a synthesizable display subset (Medium confidence).

**E-PSS-1 (352 lines; quiz 4; lab `pss-portable-intent`)**
- **F-PSS-01 (Confirmed defect, S3, High).** PSS:8, 348 "ratified as IEEE 2401-2024" is wrong (see the external checks at the top).
- **F-PSS-02 (Confirmed defect, S3, Medium-High).** PSS code is non-conformant:
  - resource types used as action `input` (PSS:45, 57); resources are claimed with `lock`/`share`;
  - scalar `output data_t data` (PSS:59); flow outputs must be buffer, stream or state objects;
  - `soft use_burst == 1; dist {...}` (PSS:119) is malformed;
  - `burst_len inside [1..16]` (PSS:253); PSS uses `in`;
  - `addr_t`/`data_t` are undefined.
- **F-PSS-03 (S4).** "PSS Reference Compiler — Accellera" and "Google ... open-source PSS parsers" are unverified. Quiz Q3 overgeneralizes the action→`uvm_sequence` mapping, which is tool-dependent.

**E-PWR-1 (143 lines; lab `power-aware-retention`; no quiz)**
- **F-PWR-01 (Confirmed defect, S3, Medium-High).** PWR:127 "Use UVM Callbacks injected into the driver to cleanly abort the active sequence". Callbacks do not abort sequences. You need a power/reset-aware driver (fork/`disable` on event, complete or flush the item) plus `stop_sequences()`/`kill()` handling. This is the same missing reset mechanics as F-VIP-02.
- **F-PWR-02 (S4).** PWR:130 gives an objection/power-drop causal claim with no mechanism. The cross at PWR:106-116 lacks `illegal_bins`/`ignore_bins` for opcodes that are illegal in sleep.

**E-PYUVM-1 (303 lines; quiz 3)**
- **F-PY-01 (Confirmed defect, S3, High).** PY:78-91, 94-102: the cocotb AXI-Lite example holds `AWVALID`/`WVALID` high until `BVALID`, and `ARVALID` until `RVALID`, instead of dropping each after its own handshake. A slave may accept a second transfer. A protocol bug in a "minimal testbench".
- **F-PY-02 (S4, Medium).** Version drift: `cocotb.result.TestFailure` (removed in cocotb 2.0), `units=` (now `unit=`), `.value.integer`. "2–10× slower" (PY:242, quiz Q3) is presented as fact.

**E-RISCV-1 (348 lines; quiz 4)**
- **F-RV-01 (Confirmed defect, S3, Medium-High).** RV:70-83 show a testlist `dist:` key with per-instruction weights. I am not aware of such a RISCV-DV testlist key. Distribution is controlled through generator options or config classes and directed-instruction streams.
- **F-RV-02 (Confirmed defect, S3, High).** RV:215-217 `for ... in enumerate(zip(rtl_trace, iss_trace))`. `zip()` truncates silently, so a hung or early-terminated RTL trace passes. This is the end-of-test-accounting error again. Also missing: handling of asynchronous events (interrupts, debug) and lock-step co-simulation vs post-hoc trace compare.
- **F-RV-03 (S4).** riscv-formal is now maintained under YosysHQ. "Commercial tools support riscv-formal out of the box" (RV:170) is an overclaim.

**E-UVM-ML-1 (242 lines; quiz 3)**
- **F-ML-01 (Confirmed defect, S3, High).** ML:10, 180 attribute "UVM-Connect" to Synopsys. UVM Connect was created by Mentor (now Siemens) and donated to Accellera. "Cadence ML-Connect" is unverified; Cadence originated UVM-ML OA.
- **F-ML-02 (S4).** "Current Limitations (2025–2026)" (ML:165) presents the UVM-ML OA project as active. Its current maintenance status is unverified, and the SC-side API in ML:96-109 is illustrative, not real.

---

## 3. Practical readiness by milestone

| Milestone | Instruction in scope | Starter material | Checks | Debug practice | Independent task | Missing |
|---|---|---|---|---|---|---|
| Reusable UVM agent | A-UVM-7 (structure only); no driver/monitor/vif/reset | `uvm-mini-capstone` starter (single FIFO agent) | self-attested; coverage threshold enforced in solution | none | none | driver/monitor patterns, vif plumbing, reset, responder agent, cloning, parameterized factory, VIP self-test; lab for A-UVM-7 |
| Reference-model-backed scoreboard | A-UVM-6 (good basics) | `scoreboard-reference-model`, `uvm-mini-capstone` | self-attested; solution has leftover/NO_TRAFFIC checks | injected FIFO bug (capstone) | none | two-stream matching with latency, reset flush, expected-error accounting, monitor cloning |
| Multi-agent env with virtual stimulus | A-UVM-8 (buggy examples) | none | none | none | none | runnable vseq lab, event/barrier races, arbitration, objections in vseqs |
| Out-of-order protocol verification | A-UVM-6 single-slot map (flawed) | `axi-scoreboard-lab` (B-AXI-6, correct per-ID queues) **not linked** | self-attested | none | none | link B-AXI-6; write channels and interleaving; ID reuse and ordering-rule checks |
| RAL-integrated env | A-UVM-4A/4B (terminology and semantics errors) | `ral-mirror-bug` solution is a correct runnable reference | self-attested; solution checks `mirror(UVM_CHECK)` | bug and fix printed in comments | none | desired/mirror/update, backdoor/HDL paths, built-in seqs with `NO_REG_*`, passive prediction, RAL coverage |
| Subsystem/SoC capstone (reset, errors, concurrency, closure) | E-SOC-1 (strategy level) | `soc-vip-reuse` (one config_db line); `soc-strategy-capstone` (written plan) | self-attested; model solution | none | written strategy only | an implementation capstone: env-of-envs, multi-agent concurrency, mid-test reset, error injection with report catcher, closure gates |

**F-LAB-02 (Missing coverage, S2, High).** All 13 in-scope labs are `self_attested`, with fully worked solutions next to the starter. None asks for an unguided design decision, and none has an automated or rubric check. The multi-agent, VIP and subsystem milestones have no implementation lab at all.

---

## 4. Systems practice coverage

| Practice | Where | Score (0-2) | Notes |
|---|---|---|---|
| Reproducible seeds | E-SOC-1:102; capstone template | 1 | Stated as a rule. No mechanics (seed plusargs, logging, random stability). E-DBG-1:49 is confusing |
| Regression organization | E-SOC-1:90-102; capstone §6; E-PERF-1:84-91 | 1 | Tiers named; no selection/ranking or flaky-test policy |
| Triage | E-DBG-1:42-49; E-SOC-1:98-101; capstone | 1 | Bucketing is shallow and partly wrong (F-SOC-02); no report-catcher or signature work |
| CI | E-CUST-1:167-177; E-INT-1:215, 227; E-VIP license note 7:264-265 | 1 | Conceptual only; no pass/fail criteria such as UVM_ERROR==0 plus `$error`/exit-status (see F-VIP-01) |
| Protocol requirement vs design policy | absent (A-UVM-6 out-of-order, A-UVM-7 SVA) | 0 | e.g., AXI same-ID ordering is a protocol rule; DUT reordering across IDs is policy |
| Tool limitations / portability | E-EMU-1, E-PYUVM-1, E-UVM-ML-1 (vendor claims partly wrong) | 1 | No multi-simulator UVM portability guidance |
| Reset handling | E-PWR-1 (power cycles), E-SOC-1 liveness bullet | 0-1 | No T3 module covers TB reset handling; phase jumping only in T2 |
| Error injection | A-UVM-5 (callbacks), A-UVM-7 file name only | 1 | No expected-error accounting or catcher; assertions conflict with injection |

---

## 5. Advanced and corner-case depth for experienced engineers

This is mostly overview. Real depth for an experienced engineer is limited to:
- the RAL mirror debug checklist (4B:23-33);
- the callbacks failure-mode list (5:138-163), which contains errors;
- the formal assumption-pitfall table (INT:135-142);
- the SoC strategy table and risk register (SOC:64-133).

Corner cases the brief named, and their status:
- **Sequence arbitration:** absent in T3 (T2 only); not linked.
- **Objection drain races:** a flawed example (F-SB-04). The `phase_ready_to_end` re-entry semantics are not explained.
- **Phase-jumping hazards:** absent in T3/T4; T2 mention only.
- **RAL with multiple maps:** a muddled paragraph (F-RAL-12). No per-map rights or address decode, and no `add_submap` offsets.
- **Mirror races with concurrent traffic:** absent. Examples include a predictor updating mid-`mirror()`, volatile/HW-updated fields, and backdoor vs in-flight frontdoor.
- **uvm_event trigger/wait races:** absent.
- **Callback type-wide vs instance ordering:** absent, and the lesson's own example triggers it (F-CB-01).
- **Scoreboard ID reuse / unmatched-output races:** absent in the lesson; present in the B-AXI-6 lab.

---

## 6. Navigation and infrastructure findings
- **F-NAV-01 (Confirmed defect, S3, High).** Flashcard ids `A-UVM-4A_RAL_Fundamentals` (4A:4) and `A-UVM-4B_Advanced_RAL` (4B:4) are not keys in `src/lib/flashcard-decks.ts` (only `A-UVM-4_RAL`, line 89). `page.tsx:50` passes the id to `FlashcardWidget`, which then renders "No flashcards available" (FlashcardWidget.tsx:34-35, 65). Fix: rename the frontmatter or add aliases. Acceptance: a unit test that every frontmatter `flashcards` id resolves in the registry.
- **F-NAV-02 (S4).** Next-topic chain anomalies: 4B → "Tier-4 methodology customization"; A-UVM-5 "Next" → 4A (circular); E-SOC-1 "Next: Continue with Tier-4 performance" with no link.
- **F-NAV-03 (S4, Low).** Lowercase "pretty" slugs (e.g., `/curriculum/t2-intermediate/i-uvm-3a-fundamentals`, A-UVM-8:379; `i-uvm-1a-components`, PY:302) depend on `toPrettyCurriculumSlug` matching. Not exhaustively verified; a link-checker run is recommended.

---

## 7. Prioritized remediation
1. **S1 (do first):**
   - Rewrite RAL prediction terminology and auto-predict semantics across 4B index, explicit-vs-implicit, `RALPredictorVisualizer`, and E-SOC-1:54 (F-RAL-02, F-SOC-01).
   - Fix the backdoor `poke`/`peek` quizzes and code (F-RAL-08).
   - Validation: grep consistency check, and a quiz re-key reviewed against the UVM reference source (`uvm_reg.svh` poke/peek → `do_predict`; `uvm_reg_map` auto-predict).
2. **S2:**
   - Replace the made-up RAL APIs (F-RAL-09, F-RAL-10).
   - Fix the callback attachment phase in lesson and lab (F-CB-01).
   - Scoreboard end-of-test accounting, per-ID queues and condition-based drain, and link the B-AXI-6 lab (F-SB-02..04).
   - Fix the A-UVM-8 hang, passive-sequencer and illegal-declaration examples (F-MA-01..03).
   - Route VIP assertion reporting through UVM (F-VIP-01).
   - Add desired/mirror/update and `add_hdl_path` (F-RAL-07, F-RAL-01).
   - Fix E-CUST-1 `exec_task` (F-CUST-01).
   - Rebuild the Hang Lab interactive (F-DBG-01) and add report-catcher, seed and trace debugging (F-DBG-04).
   - Fix E-PERF-1 scheduler misinformation (F-PERF-01).
3. **S2 (curriculum gaps):**
   - Add an implementation multi-agent/subsystem lab with mid-test reset, error injection plus catcher, and closure gates.
   - Add an A-UVM-7 VIP lab (driver/monitor/vif/reset).
   - Convert at least one lab per milestone to a graded or self-checking format (e.g., the scoreboard must report exactly N matches and 0 leftovers; seeded bug must be detected).
4. **S3/S4:** vendor and standard attributions (ZeBu/Veloce, Cerebrus, UVM Connect, PSS IEEE number), PSS syntax, cocotb protocol bug, RISC-V `zip`, flashcard id mismatch, citation clean-up (mark clause numbers unverified or remove them).

Validation that would actually show learning, beyond "tests pass":
- Compile every T3 code block against a UVM 1.2 / 1800.2 reference with one open simulator in CI. Mark intentionally partial snippets as such.
- Add predict-then-reveal and find-the-bug items for each S1/S2 topic (prediction modes, poke mirror, null-handle callback, dropped final output, same-ID reuse, fork/join hang, `$error` invisibility).
- For each milestone, add one self-checking lab whose pass condition fails on the seeded misconception.
