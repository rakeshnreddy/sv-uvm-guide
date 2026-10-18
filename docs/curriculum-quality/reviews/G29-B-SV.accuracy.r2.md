# G29-B-SV accuracy review, round 2: `systemverilog.json`

Reviewer: accuracy lens, round 2. Date: 2026-10-18. Scope: all 48 questions in `content/interview-questions/systemverilog.json` as they stand in the working tree. Against HEAD the whole bank is new (`git diff HEAD`: 1417 insertions, 106 deletions), so I re-read every question, not only the fix-round changes. The JSON parses. Inputs I read: `README.md` (brief), `analysis/G29.md` (the `systemverilog.json` section, Coverage gaps, Requests for the lead), `G29.verify.md` (SV-V01, SV-V02, completeness gaps, notes for the author), `curriculum-spine.md`, the author log (including "Fix round 1") and `G29-B-SV.accuracy.r1.md`.

**Sources I checked**
- IEEE 1800-2023 (`sources/t1_lrm_clean.txt`).
  - Clause titles: I mapped all 184 distinct `§` numbers in the bank to their headings by script. All of them exist and all are on point. The 2023 renumbering in Clause 18 is followed correctly: §18.5.3 is Distribution, §18.5.4 Uniqueness, §18.5.7.1 foreach, §18.5.9 Variable ordering, §18.5.11 Functions, §18.5.12 Guards and §18.5.13 Soft. §7.4.4 is Multidimensional arrays (the `joe` example) and §7.4.5 is Indexing and slicing (Table 7-1).
  - Text I read for this round:
    - Clauses 1–4: §1.3 NOTE (the 1364 merger); §3.14.2.3 (precedence rules, the mixing error, implementation-specific defaults); §4.4.2.4, §4.4.2.6, §4.4.2.8.
    - Clause 6: §6.10; §6.21 (explicit `static` for initializers; for-loop variables are automatic; automatic references limited to procedural blocks); §6.24.1 Syntax 6-7 and A.2.2.1 (`casting_type`); §6.24.2 (task vs function form; "a coercion that always succeeds at run time").
    - Clause 7: §7.4.5; §7.10.5; §7.12.1 ("Array locator methods traverse the array in an unspecified order"); §7.12.2.
    - Clause 8: §8.7 (initialization order; "The value of a property prior to its initialization shall be undefined"; local or protected constructors); §8.12 (shallow copy steps 1–3); §8.17 (`default` arguments, `extends base(args)` forbids `super.new`, NOTE 1, NOTE 2); §8.18; §8.20 (the presence-of-default rule); §8.25 (non-parameterized base for shared statics); §8.26.8; §8.27.
    - Clauses 9–13: §9.2.2.2, §9.2.2.2.2 (all five differences); §9.2.3 ("All final procedures shall execute in an arbitrary order"); §9.3.2 (`ref` arguments in fork-join_none, `ref static`); §10.4.2 (the NBA ban on automatic variables and dynamic-array elements); §11.5.1; §12.4.2.1 (flush points); §13.3.1; §13.4 (rules a to c; the implicit return type is a `logic` scalar); §13.4.4; §13.5.2 (`ref static`); §13.5.3.
    - Clauses 14–27: §14.10; §14.16; §18.3 (4-state operators illegal); §18.4.2 (Figure 18-1; the 8-bit minimum; randc solved first); §18.5.3 (2023 text: zero total weight, `:=` range size); §18.5.7.1 (size constraints solved first); §19.4; §19.7.1 (procedural type options); §19.10; §20.3.1 (example output); §20.14, §20.14.1; §21.2.3; §23.2.2.3; §24.3 (contents, kill rule, implicit `$finish`); §25.5; §26.5 (Table 26-1).
    - DPI: §35.5.1.3 (a plain import "can perform side effects such as writing to a file"); §35.5.3 (the export error; the H.9.5 pointer).
- IEEE 1800.2-2020 (`sources/uvm_lrm.txt`): C.4.2 is `uvm_config_db`; 9.8.1.7 is `uvm_check_phase`; 8.3 is the UVM factory.
- Module refs: all 105 `modules` entries resolve to exactly one lesson `.mdx`.
- Hand traces. I re-traced every predict, find-the-bug and cycle-table item independently:
  - Data types and operators: (1) error, (2) legal, (3) error; `[] 3` then "bad opcode"; `x 1 x 1 1 x`; A, B-else, C-idle, D; `5'h10 4'h0 5'h00 "not less"`.
  - Arrays: `54 310 '{1,3} '{1,1,4,5}`; `q4.size()` = 4.
  - Procedural and scheduling: 1/0/0 and 1/1/1; `unique`/`priority`/`unique0` violation sets; 3/3/3; D=0, S=1, M=1; `2 1.60`, `3 3.20`; both clocking-race traces; C-only for the event race.
  - The new `sv-task-vs-function`: (1) and (2) rejected; `0: f3 returned, f4 = 1` then `5: edge after f3`.
  - OOP: `base::who x=1`, `derived::vwho`, `1`, `extra`, `cast failed`. The new `sv-constructor-chaining-access`: `len=4`, `size=12 tag=2`; (3), (4) and (6) rejected. Also `p1.len=4 p1.h.id=2` and `3 1`.
  - Randomization and coverage: dist 1/6, 3/6, 2/6 and `len == 20`; `a == 0`, 1/(2^32+1) vs 1/2; `len=0 size=0`; (A) fails and (B) gives `p.len < 10`; 9 cross bins; 50% vs 100% type coverage.
  - The mailbox item: unbounded gives A3, A3, A3; `new(1)` gives A2, A3, A3.

**Verdict: passes. No S1 or S2 remains.** The round-1 S2 (`sv-mailbox-semaphore`) is fixed correctly. With `new()` all three `put` calls complete at time 0 with one handle, so the consumer prints the third address three times on every run. The `new(1)` trace (A2, A3, A3) and its §4.7 caveat are right. All ten other round-1 findings are fixed in the file and correct:
- `32'(w)` / `word_t'(w)`, with the Syntax 6-7 explanation;
- the §6.19.4 citation for the static enum cast;
- the latent-risk framing of the analysis FIFO, plus the `used()` check;
- nonzero dist weights, and the zero-weight exclusion;
- the relational-operand sizing bullet;
- "most-derived override for the object's actual class";
- the export error vs unpredictable VPI, with H.9.5;
- the config_db type match labelled as UVM behaviour (1800.2 C.4.2);
- the 4 KB alignment caveat;
- the §3.14.2.3 mixing error in both answers.

The two new questions are accurate:
- `sv-task-vs-function`: every rule matches §13.4 rules a–c, §13.4.1 and §13.4.4, including the implicit `logic` scalar return type.
- `sv-constructor-chaining-access`: every claim matches §8.7, §8.15, §8.17 (including `new(default)`, `extends base(0)`, NOTE 1 and NOTE 2), §8.18 and §13.5.3.

Two new S3 and five S4 findings remain.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | `sv-coverage-options-instances` (model answer, `type_option` bullet, `systemverilog.json:1198`; common mistake 3, `:1207`) | The answer says `type_option.<name>` "is set with a constant expression". The common mistakes list "Setting a `type_option` from a run-time variable; it must be a constant expression." That is only half the rule. Inside the covergroup definition, `type_option.member = constant_expression;` is required, which is why instances cannot set different values. But §19.7.1 also says: "The strobe and real_interval type options can only be set in the covergroup definition. Other type options can be assigned procedurally at any time during simulation", for example `gc::type_option.comment = ...; gc::a::type_option.weight = 3;`. A candidate who learns the key would wrongly reject a procedural `cg_t::type_option.weight = w;`. | Write: "Inside the covergroup definition a type option is initialized with a constant expression, so instances cannot disagree (§19.7.1). Outside it, every type option except `strobe` and `real_interval` can be assigned procedurally at any time with `cg_type::type_option.member = expr`, and the value applies to the whole type." Replace the common mistake with, for example, "Expecting one instance to have its own `type_option` value; type options belong to the type, and only `strobe` and `real_interval` are fixed in the definition." | IEEE 1800-2023 §19.7.1 (constant-expression syntax; "Different instances of a covergroup cannot assign different values to type options"; the procedural-assignment paragraph and its `gc::` example) |
| 2 | S3 | `sv-senior-staff-constraint-perf` (code, `:1502`; model answer, first cause, `:1504`) | The example class constrains `rand byte payload[]` with `unique {payload}`, and `payload.size() == len` with `len inside {[1:4096]}`. A byte has only 256 values, so no solution exists with `len > 256`. `c_sum` is an array-reduction iterative constraint, so the size constraints are solved first (§18.5.7.1: "This implicit ordering can cause the solver to fail"). Any `len` above 256 picked in that step makes `randomize()` fail. The answer says these constraints put "up to 4096 variables in one problem" and treats the class as slow but satisfiable. A senior-staff key should catch the hidden conflict in its own example. Fix 1 (fill the payload procedurally) also drops the uniqueness property without saying so. | Either change the example so it is satisfiable (for example `len inside {[1:256]}`, or drop `c_uniq`), or keep it and add the conflict as a cause. Suggested text: "`c_uniq` on byte elements caps `len` at 256. Because array size is solved before the `sum()` constraint (§18.5.7.1), a larger `len` makes `randomize()` fail, so check the return value before you profile. If uniqueness matters after moving to procedural fill, generate a shuffled set in `post_randomize()`." Change "up to 4096 variables" to "up to 256 element variables in any solution". | §18.5.4; §18.5.7 (array reduction is an iterative constraint); §18.5.7.1 (size constraints solved first; can cause failure); hand check of the constraint set |
| 3 | S4 | `sv-array-manipulation-methods` (model answer (3), `:241`) | The key predicts `'{1, 3}` as if the order were guaranteed. §7.12.1 says "Array locator methods traverse the array in an unspecified order", so the LRM does not fix the order of the returned indices. Both matches are certain; their order is not. | Add: "the order of the indices is not fixed by the LRM (§7.12.1); simulators typically return them in ascending index order (tool-dependent)." No rubric change is needed. | §7.12.1 |
| 4 | S4 | `sv-rand-randc-dist-soft` (model answer (1), `:999`) | "Four consecutive calls give each value exactly once" holds only for a window aligned with one permutation, such as the first four calls on a new object. A window that straddles two permutations can repeat a value. The LRM's own Figure 18-1 sequence (0 3 2 1, then 2 1 3 0) contains the run 1, 2, 1, 3. The rubric's "never repeats ever" trap sits right next to this sentence. | Write: "the first four calls on a new object (one full cycle) give each value exactly once; across a cycle boundary a value can repeat." | §18.4.2 and Figure 18-1 |
| 5 | S4 | `sv-display-strobe-monitor` (model answer, first paragraph, `:547`) | "From then on it prints at the end of any time step in which one of them changed" leaves out that `$monitor` also prints once at the end of the time step in which it is called. The LRM's `$time` example prints `0 set=x` from a monitor started at time 0 with no value change. So this code also prints an `M: t=0 ...` line before the edge. The prompt asks only for the lines at the edge, so the key is not wrong. A learner who runs the code will see one extra line. | Add one sentence: "It also prints once at the end of the time step in which `$monitor` is called, so this code prints an M line at time 0 as well." | §21.2.3; §20.3.1 (example output `0 set=x`) |
| 6 | S4 | `sv-static-automatic-lifetime` (code, `:484`) | The snippet is a complete `module tb; ... endmodule`, but `clk` and `bus_addr` are never declared. Identifiers in procedural code do not create implicit nets, so the module does not compile as shown. The brief requires complete units or explicit `// snippet` marking. | Declare them: `logic clk = 0; int bus_addr; always #5 clk = ~clk;`. Or mark the block `// snippet`. | §6.10 (implicit nets arise only in port expressions, instance port lists and continuous-assignment left-hand sides); README "Code in lessons" |
| 7 | S4 | `sv-generate-and-macros` (model answer, macro-bug paragraph, `:1325`) | "'disabled' prints whenever `x` equals `y`, not when `en` is 0." After expansion, the `else` belongs to the inner `if ((x) !== (y))`. "disabled" therefore prints only when `en` is 1 and `x === y`; when `en` is 0 nothing prints. "Equals" also blurs `===` with `==`, which matters when x or z is present. | Write: "'disabled' prints when `en` is 1 and `x === y`, and nothing prints when `en` is 0." | §12.4 (else binds to the nearest `if`); §11.4.5 |

## Statements I checked and confirmed (no change needed)

- **Round-1 fixes.** These are listed in the verdict above. The new mailbox text also matches the LRM on four points:
  - `new()` or `new(0)` is unbounded, and its `put` never blocks (§15.4.1).
  - A full bounded `put` suspends (§15.4.3).
  - A typeless-mailbox `get` of the wrong type is a run-time error (§15.4.5).
  - Semaphore waiters are FIFO, and `put` can exceed the initial key count (§15.3.1–§15.3.3).
- **New `sv-task-vs-function`:**
  - The rule-a list of time controls matches word for word.
  - Rule b: a function may not enable a task, "regardless of whether those tasks contain time-controlling statements".
  - Rule c covers the process-control exception.
  - §13.4.4 allows NBAs, event triggers, clocking drives and fork-join_none. The forked process may contain task-legal code. Such a function must be called from an `initial`/`always`/fork thread, so the variable-initializer follow-up is right.
  - Calling a nonvoid function as a statement "shall be legal, but shall issue a warning" (§13.4.1).
  - `build_phase`/`connect_phase` are functions and `run_phase` is a task (uvm-core).
- **New `sv-constructor-chaining-access`:**
  - Construction order and `size = tag + 10` = 12 match §8.7 and its C/D example.
  - `super.new(size)` passes an undefined value (§8.7).
  - The compiler-inserted `super.new()` fails with no default for `id` (§8.17, §13.5.3).
  - With arguments in `extends base(0)`, the constructor "shall not contain a super.new() call" (§8.17).
  - 2023 `new(default)` expands to the base argument list (§8.17).
  - `local` is invisible in subclasses; `protected` is visible to subclasses only (§8.18).
  - NOTE 1 (a local constructor makes the class inextensible) and NOTE 2 (virtual calls during construction) are in §8.17.
- **Other claims re-checked this round:**
  - `ref static` and the fork-join_none `ref` restriction (§9.3.2, §13.5.2).
  - `always_comb` runs "once at time zero, after all initial and always procedures have been started" (§9.2.2.2).
  - The `$cast` task and function forms (§6.24.2).
  - The ANSI port-kind defaults (§23.2.2.3).
  - Program contents and the implicit `$finish` (§24.3). `final` procedures run "in an arbitrary order" (§9.2.3), so the portability answer's wording is right.
  - Class-index associative arrays are "deterministic but arbitrary" (§7.8.3).
  - `$random` uses the Annex N algorithm (§20.14), and `$random % b` can be negative (§20.14.1).
  - The §20.3.1 rounding example.
  - The default-argument evaluation scope (§13.5.3) and §8.20's "presence of a default shall match", so the virtual-default item correctly calls the default unspecified.
  - `pure` call elimination (§35.5.2).
  - Plain-import side effects (§35.5.1.3).
  - The embedded covergroup rule: "If this assignment is not present ... no data will be sampled" (§19.4).
  - `merge_instances` gives a weighted average or a union, and `get_inst_coverage` applies only with merge (Table 19-1, Table 19-3).
  - The modport "as if inside the module" directions, plus §6.5's ban on assigning a variable input port.
