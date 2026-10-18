# G29-B-SV accuracy review, round 1: `systemverilog.json`

Reviewer: accuracy lens, round 1. Date: 2026-10-18. Scope: all 46 questions in `content/interview-questions/systemverilog.json` as they stand in the working tree (`git diff HEAD`), read against the author log `G29-B-SV.author.md`, `analysis/G29.md` (SV section, Coverage gaps, Requests for the lead) and `G29.verify.md` (SV-V01, SV-V02, notes for the author).

**Sources I checked**
- IEEE 1800-2023 (`sources/t1_lrm_clean.txt`). I mapped every clause number the bank cites to its heading. All of them exist, and all but one are on point (finding 3). I also read the text behind each claim the answers depend on, including: §1.3 NOTE (1364 merge); §3.14.2.3; §4.4.2.1–§4.4.2.9; §4.4.3 (PLI region list); §6.5; §6.8 and Table 6-7; §6.11.2; §6.19.4; §6.19.5.6; §6.21; §6.22.1 (rule d); §6.24.1 (Syntax 6-7); §6.24.2; §7.2.1; §7.4.4 (`joe` example); §7.8.3; §7.8.5; §7.8.6; §7.10; §7.10.5; §7.12.2; §8.12; §8.16; §8.20; §8.25; §8.26; §8.26.5; §8.26.8; the `:initial`/`:extends` examples; §9.2.2.2; §9.2.2.2.2; §9.2.3; §9.3.2; §9.6.2; §9.7; §10.4.2; §11.4.13; §11.5.1; §11.8.1; §12.4.2.1; §13.5.2; §13.5.3; §14.10; §14.13; §14.16; §15.3.1–§15.3.3; §15.5.2; §15.5.3; §18.3; §18.4.2; §18.5.3; §18.5.9; §18.5.11; §18.14.1; §18.14.2; §19.4; Table 19-1; Table 19-3; §20.3.1; §20.3.3; §20.11; §20.14; Annex N Table N.1; §21.2.3; §22.7; §23.2.2.3; §24.3; §25.9; §26.3; §26.5; §35.5.1.1; §35.5.1.2; §35.5.2; §35.5.3; H.7.4 Table H.1.
- uvm-core 2020.3.1 (`~/Downloads/1800.2-2020.3.1/src`):
  - `tlm1/uvm_tlm_fifos.svh:281`: "analysis fifo must be unbounded"; `uvm_tlm_fifo` size defaults to 1 (`:81`).
  - `base/uvm_registry.svh`: `static function this_type get()` with a `static this_type m_inst`.
  - `macros/uvm_object_defines.svh`: `m_uvm_component_registry_internal` uses `#(T,"S")`; `m_uvm_component_registry_param` uses `#(T)`, with no name.
  - `base/uvm_common_phases.svh:286`: `uvm_check_phase` is annotated 9.8.1.7.
- I hand-traced every predict-the-output item:
  - Equality, inside and X items: `x 1 x 1 1 x`; A, B-else, C-idle, D.
  - Width and sum items: `5'h10 4'h0 5'h00 "not less"`; `54 310 '{1,3} '{1,1,4,5}`.
  - Procedural items: shift register 1/0/0 and 1/1/1; fork loop 3/3/3; display/strobe/monitor 0/1/1; timescale 2/3 and 1.60/3.20.
  - OOP items: `base::who x=1`; `42`; `p1.len=4 p1.h.id=2`; `3 1`.
  - Constraint and case items: dist weights 1/6, 3/6, 2/6; `unique`/`priority`/`unique0` violation sets; `s==1` probability 1/(2^32+1).
  - The mailbox item (finding 1).

**Verdict: does not pass. One S2 is open (finding 1).** There is no S1. The two inherited S1s (G29-SV-01, G29-SV-02) are fixed correctly, and so are the inherited S2s (SV-03, SV-04, SV-05, SV-18) and SV-V01/V02. The S2 is in a new question: its stated trace does not match its own code.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S2 | `sv-mailbox-semaphore` (prompt, model answer "Why") | The code uses a bounded mailbox `new(1)`, one shared `txn`, and a consumer that waits `#5` before each `get`. Trace: at t=0 the producer randomizes (A1), puts, then re-randomizes the same object (A2) before anyone reads it. Its second `put` blocks. At t=5 the consumer gets the handle and prints A2. The producer then randomizes A3 and blocks again. At t=10 and t=15 the consumer prints A3. The output is A2, A3, A3. A1 is never printed. The answer says "sometimes you see three different values, sometimes repeats". Three different values cannot happen. The prompt's "sometimes prints the same address three times" can happen only if the consumer is preempted between `get` and `$display`. The diagnosis (one shared handle) is right, but the key teaches a wrong trace for its own code. | Option 1: make the mailbox unbounded (`new()`). Then all three `put`s happen at t=0 with one handle, and the consumer prints the last address three times, every time. Option 2: keep `new(1)` and state the real trace: "prints A2, A3, A3; A1 is overwritten before it is read; three distinct values never appear". Change the prompt to match ("prints the same address more than once"). | IEEE 1800-2023 §15.4.1, §15.4.3, §15.4.5 (bounded `put` suspends; `get` removes the handle); hand trace |
| 2 | S3 | `sv-packed-unpacked` (model answer, `w[31:0]` bullet) | "The flat word is just `w`, or `logic [31:0]'(w)`." That cast is not legal syntax. A `casting_type` is `simple_type \| constant_primary \| signing \| string \| const`, and `simple_type` has no packed dimension. So `logic [31:0]'(...)` does not parse, and strict tools reject it. G29.verify.md's note suggested the same form, so the error came in from there. | Use `32'(w)` (a size cast), or `typedef logic [31:0] word_t; ... word_t'(w)`. Plain `w` is enough, because a packed array used as a primary is one 32-bit vector (§7.4.1). | §6.24.1 Syntax 6-7; A.2.2.1 (`casting_type`, `simple_type`) |
| 3 | S3 | `sv-structs-enums-typedef` (model answer, prediction 1; sources) | "The static cast `op_e'(raw)` always succeeds and never checks the value (§6.24.2)." The claim is right but the clause is wrong: §6.24.2 defines `$cast`. The rule that casting to an enum converts "without checking the validity of the value" is in §6.19.4. The sources list has neither §6.19.4 nor §6.24.1. | Cite §6.19.4 (and §6.24.1 for the static-cast syntax) for prediction 1. Keep §6.24.2 for prediction 2. Add §6.19.4 to `sources`. | §6.19.4, §6.24.1, §6.24.2 |
| 4 | S3 | `sv-associative-array-leak` (model answer "Leak 2", rubric) | "Leak 2: the analysis FIFO is unbounded ... if a test produces expectations for traffic that never happens, it grows without limit." In the given code, `run_phase` drains `exp_fifo` into `pending` forever, so the FIFO does not grow. Expectations for traffic that never happens pile up in `pending` (leak 1), not in the FIFO. The rubric grades "finds ... the unbounded analysis FIFO" as a leak this code does not have. The unbounded-FIFO fact itself is right (uvm-core `uvm_tlm_fifos.svh:281`). | Recast leak 2 as a risk: "the analysis FIFO is unbounded, so if the draining thread ever blocks, stalls or is killed, it grows without limit and nothing warns you". In the rubric, change "finds ... the unbounded analysis FIFO" to "names the unbounded analysis FIFO as a latent risk and checks `used()` at the end". | uvm-core 2020.3.1 `uvm_tlm_fifos.svh:248,281`; code trace |
| 5 | S4 | `sv-rand-randc-dist-soft` (model answer (2), last sentence) | "Weights only shape probability: they cannot make randomize() fail on their own (§18.5.3)." In 1800-2023 only *nonzero* weights cannot cause a failure. Values with a total weight of zero are treated as a constraint excluding them, the same as unlisted values. This matters for follow-up 1, which already relies on 2023-only §18.5.3 text. | Write "nonzero weights only shape probability ... (values with weight 0, like unlisted values, are excluded) (§18.5.3)". | §18.5.3 ("nonzero distribution weights do not change the solution space ... values specified with a total weight of zero ... shall be treated as a constraint") |
| 6 | S4 | `sv-expression-width-signedness` (model answer "rules in one place", bullet 2) | "Some operands are always self-determined: ... and the operands of relational/equality results (which are 1 bit)." The wording is garbled. Relational and equality operands are sized to each other (max of the two) and are not affected by the outer context; the *result* is 1 bit. | Write "relational and equality operands are sized to the larger of the two, independent of the surrounding expression, and the result is a 1-bit unsigned value (Table 11-21, §11.8.1)". | §11.6.1 Table 11-21; §11.8.1 |
| 7 | S4 | `sv-virtual-methods-cast` (model answer 2) | "A virtual method dispatches on the object type: there is one implementation per hierarchy, the most derived one (§8.20)." A hierarchy can have many implementations. The call runs the override that is most derived for the *object's* class. | Write "the call runs the most-derived override for the object's actual class (§8.20)". | §8.20 |
| 8 | S4 | `sv-dpi-c-basics` (model answer, "Plain import" bullet) | "It may not call exported SystemVerilog functions or VPI." For exports this is right: calling one from a noncontext import "is an error". For VPI the LRM says the effects "can be unpredictable", and H.9.5 lists VPI functions that are safe to call from noncontext imports. | Write "it may not call exported SystemVerilog subroutines (an error, §35.5.3); calling VPI from it is unpredictable except for the functions listed in H.9.5". | §35.5.3 |
| 9 | S4 | `sv-virtual-interface` (model answer, bullet 2) | "`config_db::set` and `::get` must use exactly the same type or the lookup misses (§25.9)." §25.9 backs only the first half: parameters are part of the virtual interface type. The config_db lookup rule is UVM behaviour, not something 1800-2023 specifies. | Keep §25.9 for type identity. Label the lookup consequence as UVM behaviour (uvm_config_db is keyed by its type parameter) or cite the 1800.2 config_db clause. | §25.9; uvm-core `uvm_config_db` (type-parameterized) |
| 10 | S4 | `sv-senior-staff-constraint-perf` (model answer, change 3) | "Express 'aligned to 4 KB' as `addr[11:0] == 0`." The code's `(addr * len) % 4096 == 0` is not a 4 KB alignment rule. For example, `addr = 1, len = 4096` satisfies it. As written, the "reformulation" quietly changes the solution space, which is the risk the answer warns about in its last paragraph. | Write "if the intent is 4 KB alignment, state it directly as `addr[11:0] == 0`; this is a different (smaller) solution space than the product form, so confirm the intent with the spec and compare coverage". | Hand check of the constraint; §18.5.9 (uniform over the legal space) |
| 11 | S4 | `sv-timescale-time-rounding` (model answer, last paragraph); `sv-staff-cross-simulator-portability` (cause 4) | "Files without any timescale get a tool-specific default (§22.7)." This is true when nothing in the compilation sets a time unit. §3.14.2.3 adds that "It shall be an error if some design elements have a time unit and precision specified and others do not." A staff-level interviewer may probe that rule. | Add "(and mixing elements with and without a time unit is an error, §3.14.2.3)" to both answers. | §3.14.2.3, §22.7 |

## Statements I checked and confirmed (no change needed)

- **Inherited S1/S2 fixes.**
  - SV-01: `w[3]` is a byte; `w[3:2]` is two bytes (§7.4.4 `joe[7][3:2]` "2 byte copy"). A partially out-of-range part-select reads x (§11.5.1).
  - SV-02/03: unpacked slices are legal. `{>>{b}}` puts `b[0]` in `word[31:24]`, and `{<<8{b}}` reverses the bytes. An invalid read returns the Table 7-1 value (§7.8.6).
  - SV-04: a failed randomize keeps values and skips `post_randomize` (§18.6.3). `$assertoff` starts "no new attempts" (§20.11). randc is solved first "and this can sometimes cause randomize() to fail" (§18.4.2).
  - SV-05: `disable fork` kills all descendants. The fork declaration area is initialized "before any processes are spawned" (§9.3.2 example, output 123).
  - SV-V01: discard-with-warning (§7.10.5); a bounded mailbox `put` suspends.
  - SV-V02: `#1step` reads the previous step's Postponed value.
- **Data types and operators.**
  - The variable single-driver rule (§6.5); `logic` == `reg` (§6.11.2). The port defaults: `input` is a net, and `output` with an explicit data type is a variable (§23.2.2.3).
  - `always_comb` excludes other writers, including through called functions but not tasks (§9.2.2.2).
  - `name()` returns "" for a non-member (§6.19.5.6). An enum defaults to its base type's default (Table 6-7). The first packed-struct member is most significant (§7.2.1).
  - `$cast` as a function does not assign on failure and returns 0 (§6.24.2).
  - `inside` returns 1'bx on no match with x results, and a left-hand x is not a wildcard (§11.4.13). 4-state to 2-state conversion turns x/z into 0 (§6.11.2).
  - The literal and select signedness rules (§11.8.1).
- **Arrays.**
  - `sort()` needs relational operators on the element type or the `with` expression (§7.12.2).
  - A queue has constant-time access and end insertion and removal, and nothing more is guaranteed (§7.10).
  - Class-index ordering is "deterministic but arbitrary" (§7.8.3).
- **Procedural and scheduling.**
  - NBAs to automatic variables and to dynamic-array elements are illegal (§10.4.2).
  - All five `always_comb`/`@*` differences match §9.2.2.2.2.
  - `unique`/`priority` reports are deferred to Observed, flushed on resume, and controllable by §20.11.
  - The nine regions and the region of each activity (§4.4.2.x). The PLI region list (§4.4.3).
  - `@(cb)` triggers in Observed (§14.10). Zero-skew drives go to Re-NBA (§14.16).
  - Program contents, kill-descendants and the implicit `$finish` (§24.3). `final` order is "arbitrary but deterministic" (§9.2.3).
  - `$monitor` ignores `$time`, and only one list is active (§21.2.3). The `$time`/`$realtime` rounding matches the §20.3.1/§20.3.3 examples.
  - A static initializer needs `static` and runs before procedures start (§6.21, §6.8).
  - `ref` is illegal in static subroutines (§13.5.2).
  - Event race quote (§15.5.2); `triggered` persists for the time step (§15.5.3); `->>` triggers in the NBA region.
  - Semaphore keys can exceed the initial count, and waiters are served FIFO (§15.3.1–§15.3.3).
  - The process methods and the ban on `new`/extending `process` (§9.7). `disable` of a task disables all activations (§9.6.2).
- **OOP.**
  - A shallow copy does not call the constructor or run initializers, and copies RNG state, `rand_mode`, `constraint_mode` and randc state (§8.12).
  - Superclass-to-subclass assignment is illegal (§8.16).
  - "It is not necessary to have matching default expressions, but the presence of a default shall match" (§8.20). Interface-class defaults must be the same constant (§8.26.8).
  - `:initial`/`:extends`/`:final` exist in 2023.
  - Per-specialization statics, and `stack is; // default` (§8.25), including the declaration-context rule used by the follow-up.
  - Interface-class contents (§8.26) and casting (§8.26.5). The `pure virtual protected` prototype grammar is legal.
- **Randomization.**
  - The 2023 `:=` range-weight note (§18.5.3). Uniform over legal combinations, with the `s -> d == 0` example (§18.5.9, Table 18-1).
  - Function arguments are solved first, so the problem is not bidirectional (§18.5.11).
  - The `===` ban in constraints (§18.3).
  - Hierarchical seeding, the "create after existing" advice, and the implementation-dependent default seed (§18.14.1). `$random` is outside the §18.14.2 list.
  - `$random` maps to `rtl_dist_uniform` in Annex N Table N.1 (§20.14), so the portability answer is right.
- **Coverage.**
  - An embedded covergroup may only be assigned in `new()` (§19.4).
  - `per_instance`, `get_inst_coverage` and `merge_instances` semantics and defaults (Table 19-1, Table 19-3). The cross-bin count 3×3 = 9.
- **DPI.**
  - Zero-time imports (§35.5.1.1). Inputs must not be modified (§35.5.1.2).
  - `pure` is for non-void functions with no output or inout arguments (§35.5.2).
  - Export from a noncontext import is an error (§35.5.3).
  - Table H.1 mappings, and `byte unsigned` vs `bit [7:0]` (H.7.4).
- **Packages and generate.**
  - Typedef matching rule (d) (§6.22.1). "The compilation of a package shall precede ..." (§26.3).
  - Wildcard collision on reference (§26.3/§26.5 Table 26-1).
  - `genblk<n>` naming (§27.6). The `do ... while (0)` macro fix is legal and binds the `else` correctly.
- **UVM references.** The analysis FIFO is unbounded and `uvm_tlm_fifo` defaults to 1. Registry singletons come from `static get()`. The param macro registers with no type name. `check_phase` is 9.8.1.7.
