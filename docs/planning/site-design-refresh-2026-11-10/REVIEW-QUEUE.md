# Figure review queue

- Last finished lesson · F2A Structs, Unions, and Enums, released in checkpoint 32
- Lesson in progress · F2A Operators and Expressions · taken by Claude on the local branch `figures/operators` (head `d7f48c1d`, not pushed). All 28 visuals are drawn, independently reviewed, fixed and checked. Not released: the full gate passes 16 of 17, and G1 still counts five visuals as old look (`DecisionLab` line 402, the hand-drawn figure at line 695, and three `StreamPackLab` embeds). The causes are mechanical and are listed in the update of 2026-11-22 below. Work paused on 2026-11-22 at the weekly usage line; do not start this lesson again, finish it from that branch
- Working tree · Clean. The Operators and Expressions work is on the local branch `figures/operators`, not pushed.
- Lessons finished in this window · 0

Checkpoint 32 is in `origin/curriculum-quality-program` at `669f7d7b`.

## Reviewer's verdict (2026-11-21)

The gate tooling and these planning files are released to `main` with this commit. No lesson and no site code
changed, so nothing a learner sees is different. No lesson was finished in this round.

- **Checked.** The diff since checkpoint 32 touches only `docs/planning`, `scripts/figure-gates*` and
  `tests/scripts`. The exceptions file is unchanged. `--write-released-baseline` works for the five frozen
  lessons only. The 3:1 state threshold is unchanged. The gate's 12 unit tests pass and every script parses.
- **Not checked.** The gate's logic was not read line by line, and no gate run was repeated.
- **"Look at these first".** The crops of the cost graph (@265) and `OperatorExplorer` (@984) at 390 light were
  inspected. Both selected controls read as selected: a tinted fill, a coloured border and heavier text, and the
  cost graph adds the ▶ mark. G15 compares fill with fill only. These are not faults and stay in the baseline.
  The methodologies diagram (@532) uses the same chip as the cost graph and was not viewed.
- **Gate note for later.** G15 should accept a border in another colour together with a glyph or a heavier
  weight as a state cue. Do not change it now.
- **One thing seen in the crop.** In `OperatorExplorer` at 390 wide, the sentence above the §20.9 table runs past
  the right edge of the card. Check in the Operators and Expressions lesson that it wraps or scrolls.
- **Local paths.** The ten gate reports held this machine's folder paths. They are replaced by `<repo>` and
  `node`, and the gate now writes reports that way.
- **G9 timeouts.** The two tests pass alone and in CI. Run G9 with nothing else running on the machine.

Next, in this order: the Core Data Types baseline; Operators and Expressions visuals 21 to 28 from the saved
patch; then `F2B` onward as in the brief.

**Update, 2026-11-22, evening.** Operators and Expressions is not released yet. State of `figures/operators`
at `d7f48c1d`: 28 visuals drawn; five reviewers found 19 faults, 16 minor items and 8 kit notes; 36 findings
were sent to fixers and all are fixed and independently checked except three that a rule blocks (a button label
that differs from the prose, also on the live page; and two kit-drawn figures, visual 11 cut off at 390 and
visual 28 unchanged, which wait for the kit step). The full gate passes 16 of 17. G1 fails on five visuals, for
three mechanical reasons that no `--only` run can see, because G1 runs only in a full lesson run:
`DecisionLab` has a class-less wrapper between its slot and `section.fig-panel`; `StreamPackLab` has no
`fig-panel` on its outer section; and the figure at line 695 reads as stale because its rendered words no longer
match the source after a `tspan` edit. The released Verification Mindset lesson passes with 0 new. One visible
change reaches released lessons: the pressed preset chip in `OperatorExplorer` is a solid cyan fill in light
theme, which clears the 1.97:1 finding. Lesson for the loop: run one full lesson gate before the review, not
only `--only` runs.

**Update, 2026-11-22.** The Core Data Types baseline is recorded (see the table below). Claude has taken
Operators and Expressions and, after it, `F2B` index, `F2C` index and `F2C` flow-control, in that order. Codex
works from the end of Tier 1 upward (section 8 of its brief).

## Ready for review

The Addendum 3 gate corrections start at `66fe2d08`. All five released visual baselines are recorded; the Core Data Types one was added on 2026-11-22. The F1A scratch proof reported exactly one new finding, a clipped label at 390 px in light mode.

The Operators and Expressions patch is available for an interim review in `test-results/design-previews/codex/F2A_Core_Data_Types--operators-and-expressions/wip/task-2-operators-and-expressions.patch`. The same folder has `task-2-report-draft.md`, `task-2-baselines/` and `task-2-gate-logs/`. The adjacent before and after folders contain the captures. The full lesson gate and commit remain pending. The conditional operator is the next visual.

## Found in released lessons

Each baseline comes from one full run with the calibrated gate. F1A is the approved reference. G3 and the G14 pixel comparison are skipped for F1A because it has no comparable historical capture. The G14 depth and focal declarations were still checked.

| Released lesson | Gate result | Baseline |
| --- | --- | --- |
| F1A The Cost of Bugs | PASS (25 baseline, 0 new) for visual findings. G9 failed in the capture run. | [Findings](reports/F1A_The_Cost_of_Bugs.released-baseline.json) |
| F1B The Verification Mindset | PASS (21 baseline, 0 new) | [Findings](reports/F1B_The_Verification_Mindset.released-baseline.json) |
| F1C Why SystemVerilog | PASS (8 baseline, 0 new) | [Findings](reports/F1C_Why_SystemVerilog.released-baseline.json) |
| F2A Core Data Types | PASS (27 baseline, 0 new); G9 passed | [Findings](reports/F2A_Core_Data_Types.released-baseline.json) |
| F2A Structs, Unions, and Enums | PASS (6 baseline, 0 new) for visual findings. G9 failed in the capture run. | [Findings](reports/F2A_Core_Data_Types--structs-unions-enums.released-baseline.json) |

### Look at these first

#### F1A The Cost of Bugs

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G15 | InteractiveCostOfBugGraph@265 | 390 light | ▶ RTL simulation · 2.45:1 against an inactive sibling | [After reveal](../../../test-results/design-previews/codex/released/F1A_The_Cost_of_Bugs/265-390-light-revealed.png) |

#### F1B The Verification Mindset

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G15 | VerificationMethodologiesDiagram@532 | 390 light | ▶ Formal property verification · 2.45:1 against an inactive sibling | [After reveal](../../../test-results/design-previews/codex/released/F1B_The_Verification_Mindset/532-390-light-revealed.png) |
| G15 | OperatorExplorer@984 | 390 light | 0100 (legal one-hot) · 1.97:1 against an inactive sibling | [After reveal](../../../test-results/design-previews/codex/released/F1B_The_Verification_Mindset/984-390-light-revealed.png) |
| G15 | OperatorExplorer@984 | 768 light | 0100 (legal one-hot) · 1.97:1 against an inactive sibling | [After reveal](../../../test-results/design-previews/codex/released/F1B_The_Verification_Mindset/984-768-light-revealed.png) |

### Then check legend and drawing declarations

#### F1A The Cost of Bugs

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 light | 149,24,112 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 light | 149,24,112 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 light | 149,24,112 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 light | 161,43,130 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 light | 161,43,130 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 light | 161,43,130 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 light | 171,63,146 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 light | 171,63,146 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 light | 171,63,146 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 dark | 173,103,159 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 dark | 173,103,159 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 dark | 173,103,159 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 light | 174,91,158 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 light | 174,91,158 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 light | 174,91,158 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 dark | 198,108,177 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 dark | 198,108,177 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 dark | 198,108,177 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 dark | 223,119,195 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 dark | 223,119,195 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 dark | 223,119,195 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 768 dark | 241,131,208 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1280 dark | 241,131,208 / none · meaningful mark has no matching swatch or direct label | — |
| G13 | The DV career ladder: four rungs and what each one owns@905 | 1440 dark | 241,131,208 / none · meaningful mark has no matching swatch or direct label | — |

#### F1B The Verification Mindset

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G14 | CounterBenchLab@249 | 1440 dark | first drawing pixels · 0.00% changed (floor 5.5%) | — |
| G14 | CounterBenchLab@249 | 1440 light | first drawing pixels · 0.00% changed (floor 5.5%) | — |
| G14 | VerificationMethodsExplorer@528 | 1440 dark | design declaration · missing a stage with depth | — |
| G14 | VerificationMethodsExplorer@528 | 1440 light | design declaration · missing a stage with depth | — |
| G14 | CounterBenchLab@606 | 1440 dark | design declaration · missing a stage with depth | — |
| G14 | CounterBenchLab@606 | 1440 light | design declaration · missing a stage with depth | — |
| G14 | Expected coverage against the number of random samples, for 16 common bins and one rare bin@664 | 1440 dark | design declaration · missing a stage with depth | — |
| G14 | Expected coverage against the number of random samples, for 16 common bins and one rare bin@664 | 1440 light | design declaration · missing a stage with depth | — |
| G14 | ClosureBudgetLab@712 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | ClosureBudgetLab@712 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | ScenarioSorter@754 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | ScenarioSorter@754 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | OperatorExplorer@984 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | OperatorExplorer@984 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | VerificationMethodsExplorer@1013 | 1440 dark | design declaration · missing a stage with depth | — |
| G14 | VerificationMethodsExplorer@1013 | 1440 light | design declaration · missing a stage with depth | — |
| G14 | CounterBenchLab@1033 | 1440 dark | first drawing pixels · 0.06% changed (floor 5.5%) | — |
| G14 | CounterBenchLab@1033 | 1440 light | first drawing pixels · 2.78% changed (floor 5.5%) | — |

#### F1C Why SystemVerilog

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G14 | VerilogVsSystemVerilog@268 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | VerilogVsSystemVerilog@268 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | uvm_pkg, the UVM library whose API IEEE 1800.2-2020 defines, sits on top of IEEE 1800-2023 SystemVerilog. The SystemVerilog box contains a design half, a verification half and the whole Verilog base, IEEE 1364-2005, merged in 2009.@379 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | uvm_pkg, the UVM library whose API IEEE 1800.2-2020 defines, sits on top of IEEE 1800-2023 SystemVerilog. The SystemVerilog box contains a design half, a verification half and the whole Verilog base, IEEE 1364-2005, merged in 2009.@379 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | ProceduralBlocksSimulator@608 | 1440 dark | design declaration · missing a stage with depth | — |
| G14 | ProceduralBlocksSimulator@608 | 1440 light | design declaration · missing a stage with depth | — |
| G14 | ProceduralBlocksSimulator@608 | 1440 dark | first drawing pixels · 0.41% changed (floor 5.5%) | — |
| G14 | ProceduralBlocksSimulator@608 | 1440 light | first drawing pixels · 0.12% changed (floor 5.5%) | — |

#### F2A Structs, Unions, and Enums

| Gate | Visual | Setting | Finding | Crop |
| --- | --- | --- | --- | --- |
| G14 | A packed struct is one vector; an unpacked struct is separate members@241 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | A packed struct is one vector; an unpacked struct is separate members@241 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | cmd_t layout: op in bits 31 to 28, addr in 27 to 16, data in 15 to 0@406 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | cmd_t layout: op in bits 31 to 28, addr in 27 to 16, data in 15 to 0@406 | 1440 light | design declaration · missing a declared focal part or a report reason | — |
| G14 | cmd_u: three names for the same 32 bits; word_u: members right-justified@567 | 1440 dark | design declaration · missing a declared focal part or a report reason | — |
| G14 | cmd_u: three names for the same 32 bits; word_u: members right-justified@567 | 1440 light | design declaration · missing a declared focal part or a report reason | — |

### Kit observations

| Released lesson | Count |
| --- | ---: |
| F1A The Cost of Bugs | 265 |
| F1B The Verification Mindset | 532 |
| F1C Why SystemVerilog | 654 |
| F2A Structs, Unions, and Enums | 528 |
| F2A Core Data Types | 796 |

The Core Data Types baseline holds 27 findings and none of the "look at these first" kind (no G15): eight G12 rows
on the bit strips of the five width-and-sign steps (@759, a label meets a painted mark), 18 G14 declaration rows
across nine visuals, and one G16 row on the anatomy of two declarations (@24). The rows are in the baseline file.

## Kit requests

The released lesson reports retain the kit requests. The full gate reports in the local released evidence folders include the current per-visual kit readings.

## Needs a reviewer decision

The released lesson records supply the focal declarations where available. The entries below identify the visuals for which the gate needs a design decision.

### F1B The Verification Mindset

- Reading same-edge and next-edge implication, disable iff and cover on the counter @130 · No focal part named in the released lesson records.
- The load-priority bug: ld and en together at count 7 @267 · No focal part named in the released lesson records.
- ClosureBudgetLab @712 · No focal part named in the released lesson records.
- ScenarioSorter @754 · No focal part named in the released lesson records.
- CounterBenchLab @949 · No drawing isolated in the default state or after the first reveal. [dark](../../../test-results/design-previews/codex/released/F1B_The_Verification_Mindset/949-1440-dark-revealed.png), [light](../../../test-results/design-previews/codex/released/F1B_The_Verification_Mindset/949-1440-light-revealed.png)
- OperatorExplorer @984 · No focal part named in the released lesson records.

### F1C Why SystemVerilog

- VerilogVsSystemVerilog @268 · No focal part named in the released lesson records.
- uvm_pkg, the UVM library whose API IEEE 1800.2-2020 defines, sits on top of IEEE 1800-2023 SystemVerilog. The SystemVerilog box contains a design half, a verification half and the whole Verilog base, IEEE 1364-2005, merged in 2009. @379 · No focal part named in the released lesson records.
- Nested begin_keywords pairs across a file boundary @545 · No focal part named in the released lesson records.
- KeywordSetExplorer @592 · No drawing isolated in the default state or after the first reveal. [dark](../../../test-results/design-previews/codex/released/F1C_Why_SystemVerilog/592-1440-dark-revealed.png), [light](../../../test-results/design-previews/codex/released/F1C_Why_SystemVerilog/592-1440-light-revealed.png)

### F2A Structs, Unions, and Enums

- A packed struct is one vector; an unpacked struct is separate members @241 · No focal part named in the released lesson records.
- cmd_t layout: op in bits 31 to 28, addr in 27 to 16, data in 15 to 0 @406 · No focal part named in the released lesson records.
- cmd_u: three names for the same 32 bits; word_u: members right-justified @567 · No focal part named in the released lesson records.
- An unreset state variable with two base types @767 · No focal part named in the released lesson records.
- Putting a number into an enum: choose by where the value comes from @992 · No focal part named in the released lesson records.
- PackedLayoutExplorer @1090 · No drawing isolated in the default state or after the first reveal. [dark](../../../test-results/design-previews/codex/released/F2A_Core_Data_Types--structs-unions-enums/1090-1440-dark-revealed.png), [light](../../../test-results/design-previews/codex/released/F2A_Core_Data_Types--structs-unions-enums/1090-1440-light-revealed.png)
- Is x = y legal? Three questions, asked in order @1363 · No focal part named in the released lesson records.
- PackedLayoutExplorer @1491 · No drawing isolated in the default state or after the first reveal. [dark](../../../test-results/design-previews/codex/released/F2A_Core_Data_Types--structs-unions-enums/1491-1440-dark-revealed.png), [light](../../../test-results/design-previews/codex/released/F2A_Core_Data_Types--structs-unions-enums/1491-1440-light-revealed.png)

## Gate notes

The released baseline files record finding identities. Future reports surface added findings and print cleared entries without updating those files.

- F1A's expert-index test and the Structs run's root-metadata test timed out on their serial retries. G9 remains failed for those runs. Their complete visual readings are recorded separately from G9.
- The F1A scratch run failed with exactly one `NEW` line. The added SVG clip cut `timing reveal?` at 390 px in light mode. [Mutation proof](../../../test-results/design-previews/codex/released/F1A_The_Cost_of_Bugs/mutation-proof.log)
- The Core Data Types baseline was recorded on 2026-11-22 with `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx --base f671ae67 --write-released-baseline`. All seventeen gates passed, G9 included (tsc, 36 test files, ESLint).

## Finished lessons

Task B has reached 20 focused passes in Operators and Expressions. The [run log](CODEX-RUN-LOG.md) contains the resume commands and the full acceptance command.
