# 6a author log: lab common-1 (structs, enums and arrays)

## What was built

Lab `common-1` v2, "Structs, Enums and Arrays in a Packet-Decoder Bench", status `available`, in its own folder
`content/curriculum/labs/common/lab1_packet_decoder/`. The old `content/curriculum/labs/common/lab.json` (v1, coming soon,
no steps, assets = the shared `rtl/*.sv` reference files) was removed; `rtl/` stays because `arbiter`, `dma` and `fifo`
compile units use it. basics-1 lives in `labs/basics/lab1_refactoring` and was not touched.

- DUT `work/pkt_decoder.sv`: a combinational 16-bit header decoder with flat ports (kind, dest, len, checksum; rules
  D1-D5 in the README) and `BUG` 1/2/3 (length limit off by one, wrong error priority, dest from wrong bits).
- `work/pkt_pkg.sv` (starter: placeholder vectors with TODO step 2) and `solution/pkt_pkg.sv`: `kind_e`
  (`enum logic [2:0]`, non-contiguous values, non-members 3/5/6/7), `err_e`, packed structs `hdr_t` and `dec_t`.
- `work/tb_top.sv` (starter, compiles and runs, checks nothing, TODO step 2-6) and `solution/tb_top.sv`: layout check
  (`$bits`, field order), model from the spec (`$cast` as a function for enum membership, assignment patterns by name,
  whole-struct vector write that bypasses the enum type check), dynamic-array stimulus grown with `new[N](stim)`,
  per-packet `!==` compare printed with `name()`, associative-array traffic tables (`exp_bytes`/`act_bytes` keyed by
  `bit [3:0]`, `count_by_kind` keyed by the enum, `seen_err` keyed by `err_e`) compared both ways after `exists()`,
  a plan check that walks `err_e` with `first()/last()/next()`, a vacuous-pass guard and one `PASS=<n> FAIL=<m>` line.
- README: spec, 7 steps with predict/answer details, plan table, captured expected log, prove-it-fails table with five
  planted bugs (three DUT `BUG` values, the learner's own IDLE-accepted DUT bug, and a bench bug: `new[N]` without
  `(stim)`, which only the plan check catches on a 2-state simulator), run commands, Verilator notes.
- lab.json: owningModule `F2A` (spine card: "Lab common-1 ... belongs here, not to F2C"; plan.md "re-owned toward F2A"),
  modulePrerequisites `["F2B"]` (the bench needs dynamic and associative arrays), labPrerequisites `[]` (was
  `basics-1`, an F2D lab that comes after F2A/F2B). Seven steps, all `self_attested`: no grader id was added because
  `src/lib/lab-graders.ts` is outside this item's files.

## Sources verified (IEEE 1800-2023, t1_lrm_clean.txt, read in place)

§3.14.2.2/§3.14.2.3 (timeunit in packages; mixed time units an error), §6.19.3 (enum strong typing, union exception),
§6.19.5.1-§6.19.5.6 (first/last/next/name; name() returns "" for a non-member), §6.24.2 ($cast as a function returns 0
and does not assign), §7.2.1 (packed struct is one vector, first member is MSB), §7.5.1 (new[N](old) copies and pads),
§7.8.4 (integral index ordering; enum is integral per §6.11.1 wording), §7.8.6 (missing-key read: default plus warning),
§7.8.7 (read-modify-write allocates the default before the read), §7.9.1/§7.9.3/§7.9.4/§7.9.6 (num, exists, first,
next), §12.7.3 (foreach). No external URLs or dates are cited.

## Verilator (5.052, installed)

Lint, from `content/curriculum/labs/common/lab1_packet_decoder/`:

- `verilator --lint-only -Wall --top-module pkt_decoder work/pkt_decoder.sv`: no warnings.
- `verilator --lint-only -Wall --timing -Wno-fatal --top-module tb_top solution/pkt_pkg.sv work/pkt_decoder.sv solution/tb_top.sv`:
  two expected warnings, `UNUSEDSIGNAL` for `k` in `kind_is_member` (only the `$cast` destination) and for bits
  `h[3:0]` in `hdr_chk` (the checksum covers bits 15:4). Both are explained in the README.
- `verilator --lint-only -Wall --timing -Wno-fatal --top-module tb_top work/pkt_pkg.sv work/pkt_decoder.sv work/tb_top.sv`:
  only `UNUSEDSIGNAL`/`UNUSEDPARAM` warnings for the TODO stubs' unused arguments.
- Starter tb with the solution package (learner state after step 2) also compiles with no errors.

Runs (`verilator --binary --timing -Wno-fatal --top-module tb_top <pkg> work/pkt_decoder.sv <tb>`, then
`./obj_dir/Vtb_top +verilator+error+limit+100`):

| Run | Summary |
|---|---|
| starter | `TEST 0 packets` / `PASS=0 FAIL=0` |
| solution, DUT_BUG=0 | `TEST 10 packets`, KIND READ 2 / WRITE 2 / RESP 1, DEST 3=20 / 5=8 / 9=16, `PASS=17 FAIL=0` |
| DUT_BUG=1 | `PASS=15 FAIL=2` (PKT 2, TABLE dest=5 got 25 expected 8) |
| DUT_BUG=2 | `PASS=16 FAIL=1` (PKT 8 only) |
| DUT_BUG=3 | `PASS=9 FAIL=12` (5 packets, 3 table mismatches, 4 unexpected destinations) |
| IDLE accepted (own bug) | `PASS=16 FAIL=2` (PKT 4, TABLE dest=0 unexpected) |
| list wiped (`new[...]` without `(stim)`) | `PASS=14 FAIL=1` (PLAN no packet produces E_LEN) |
| `dest`/`len` swapped in hdr_t | `TYPES` fatal: `51a5, want 5515` |

Without `+verilator+error+limit+N` Verilator stops at the first `$error`; the README says so. The 4-state behaviour of
the wiped-list case is not captured and is described without a count.

## Shared-file requests (Integrate step)

1. `content/curriculum/labs/compile-units.json`: add
   `"common/lab1_packet_decoder": [{"name": "solution", "files": ["solution/pkt_pkg.sv", "work/pkt_decoder.sv", "solution/tb_top.sv"]}, {"name": "starter", "files": ["work/pkt_pkg.sv", "work/pkt_decoder.sv", "work/tb_top.sv"]}]`.
   Leave the existing `"common"` (rtl reference) entry.
2. Regenerate `src/generated/lab-registry.ts`: common-1 is now v2, `available`, owner `F2A`, assetLocation
   `content/curriculum/labs/common/lab1_packet_decoder` (was `content/curriculum/labs/common`), modulePrerequisites
   `["F2B"]`, labPrerequisites `[]`. (Validated with the generator against a copy holding only this folder; the full
   run currently fails on fifo-1's in-progress assets, not on this lab.)
3. `tests/components/LabLink.test.tsx` line 119-120 pins `common-1` as `coming_soon`; switch it to another
   coming-soon lab or assert `available`.
4. `src/lib/practice-links.ts` `LAB_LESSON_OVERRIDES`: add
   `'common-1': ['F2A_Core_Data_Types/structs-unions-enums', 'F2B_Dynamic_Structures/index']` (default would be the
   F2A index only).
5. Lesson text that now reads as a placeholder: `F2A_Core_Data_Types/index.mdx` line ~1981 ("planned ... not available
   yet") and `F2A_Core_Data_Types/structs-unions-enums.mdx` line ~1334 ("is planned; until it is available"); replace
   with a `LabLink` to `common-1`. Consider a pointer from F2B's Make It Work as well.
6. Spine §lab table (`curriculum-spine.md` ~line 2753) and the F2A/F2C cards: mark common-1 available, owner F2A.
7. Optional: a structural grader for common-1 (steps are self-attested today).
