# Figure review queue

- Last finished lesson · F2A Structs, Unions, and Enums, released in checkpoint 32
- Lesson in progress · F2A Operators and Expressions paused after the first 20 of 28 visuals passed their focused gates
- Working tree · Clean at handoff. The Operators and Expressions patch and evidence are saved locally.
- Lessons finished in this window · 0

Checkpoint 32 is in `origin/curriculum-quality-program` at `669f7d7b`.

## Ready for review

The Addendum 3 gate corrections start at `66fe2d08`. Four released visual baselines are recorded. The F1A scratch proof reported exactly one new finding, a clipped label at 390 px in light mode. The Core Data Types baseline rerun was stopped at handoff and is the remaining capture.

The Operators and Expressions patch is available for an interim review in `test-results/design-previews/codex/F2A_Core_Data_Types--operators-and-expressions/wip/task-2-operators-and-expressions.patch`. The same folder has `task-2-report-draft.md`, `task-2-baselines/` and `task-2-gate-logs/`. The adjacent before and after folders contain the captures. The full lesson gate and commit remain pending. The conditional operator is the next visual.

## Found in released lessons

Each baseline comes from one full run with the calibrated gate. F1A is the approved reference. G3 and the G14 pixel comparison are skipped for F1A because it has no comparable historical capture. The G14 depth and focal declarations were still checked.

| Released lesson | Gate result | Baseline |
| --- | --- | --- |
| F1A The Cost of Bugs | PASS (25 baseline, 0 new) for visual findings. G9 failed in the capture run. | [Findings](reports/F1A_The_Cost_of_Bugs.released-baseline.json) |
| F1B The Verification Mindset | PASS (21 baseline, 0 new) | [Findings](reports/F1B_The_Verification_Mindset.released-baseline.json) |
| F1C Why SystemVerilog | PASS (8 baseline, 0 new) | [Findings](reports/F1C_Why_SystemVerilog.released-baseline.json) |
| F2A Core Data Types | Full rerun stopped at handoff | — |
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
- To finish the remaining calibration capture, run `node scripts/figure-gates.cjs content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx --base f671ae67 --write-released-baseline`. The Core Data Types priority crops already captured during the interrupted run are local evidence from that attempt. Use the completed run for the queue.

## Finished lessons

Task B has reached 20 focused passes in Operators and Expressions. The [run log](CODEX-RUN-LOG.md) contains the resume commands and the full acceptance command.
