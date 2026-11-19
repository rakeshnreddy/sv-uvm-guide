# F1C — Why SystemVerilog

## Visual inventory and teaching intent

| Base MDX line | Visual | What the learner should see | Focal part and color |
| --- | --- | --- | --- |
| 25 | Language containment | Verilog is inside SystemVerilog, and UVM is a library written in that language. | The raised neutral Verilog base is the focus. Violet and amber label the design and verification halves. |
| 58 | Standards relationships | The language standards merged, while the UVM library follows its own standard. | Read the two converging merger arrows. Neutral branches keep standards and libraries in their own columns. |
| 128 | One compile | Both DUT and bench use the same interface and package in one compilation. | The two shared nodes connect both halves. The violet DUT and amber bench retain their distinct kit roles. |
| 213 | Request and grant | Count two rising edges forward from each request to see one passing attempt and one failing attempt. | The ✓ at edge 3 and ✕ at edge 6 anchor the two attempts. Emerald and rose carry their existing outcomes. |
| 250 | SVA sequence explorer | Editing the trace distinguishes a real pass or failure from a vacuous success. | The selected attempt’s start edge leads the view. Compact glyphs keep pass, fail and vacuity distinct. |
| 265 | Language comparison | A legacy design can remain Verilog while the bench uses SystemVerilog features. | Fuchsia rims identify the left-to-right order of the two neutral code plates. The existing controls select the feature. |
| 314 | Where UVM lives | The library runs inside the same SystemVerilog simulation as the DUT. | The library enclosure groups the base classes. Existing tags and the amber top module identify testbench roles. |
| 341 | Name sorter | A language keyword, a library identifier and a version macro have different owners. | The active sort card is the focus. Emerald and rose are reserved for checked findings. |
| 353 | Compile-triage sorter | Each diagnostic points to a particular layer of the compile stack. | The active diagnostic is the focus. Neutral trays identify the compile layers by position and text. |
| 375 | Recap stack | The library sits on the language, with the older Verilog language included below it. | The Verilog foundation spans the violet design and amber verification half-plates. The amber library is raised above the frame. |
| 457 | Legacy counter waveform | Starting at the reset edge, follow the sampled count through three increments. | The pass band follows the count check. Indigo labels the multi-bit bus. Rose retains the unknown starting sample. |
| 497 | Keyword regions, legacy counter | The active keyword set changes as each directive pushes or pops the stack. | The cyan top stack entry shows the set in force. Neutral plates retain the earlier levels. |
| 532 | Nested keyword directives | Reading the next file does not reset the open keyword stack. | The file divider and matching push/pop labels show the cross-file boundary and nested pair. |
| 579 | Standards lineage timeline | Step through the two standards lanes to see which documents define the language at each revision and which keyword table it added. | The cyan stop highlights the selected revision, and the aligned fuchsia bars compare table sizes. |
| 595 | Procedural block simulator | Time-zero output depends on initializer scheduling under the selected standard. | The cyan cursor marks the current event. Indigo data and the rose hatch distinguish settled values from X. |
| 792 | SystemVerilog feature sorter | Match each job to the language feature that implements it. | The active feature card is the focus. Tray position and labels distinguish the jobs. |
| 841 | Keyword checker | The same spelling can be an identifier or a reserved word depending on the active keyword set. | The cyan entry ring follows the selected word. Fuchsia rims order revisions without assigning a new meaning to their colors. |

The seven kit diagrams, one recap drawing and nine visual embeds make 17 visual instances. Four interview prompts are included separately in the default-state proof. The request/grant waveform uses the actual assertion attempts as its focal events. Its edge labels and pass/fail glyphs are part of the teaching content.

## Visual direction

F1C teaches which layer owns a language feature, a keyword or a library name. Use a restrained instrument panel with the same depth and title hierarchy as F1B. The recap has physical depth to make containment readable. Violet is the design half, amber identifies the verification half and library, and the Verilog foundation is neutral. The first kit diagram focuses on the Verilog base because the caption says “The whole Verilog base sits inside the IEEE 1800-2023 box, under a design half and a verification half.” The controls identify the active stop in cyan. Ordered keyword revisions use the fuchsia ramp. The assertion attempt keeps the kit’s pass, fail and vacuous glyphs. The time-zero simulator’s hatched unknown values stay rose.

## Gate output

```text
PASS G1 21 source instances, 21 rendered; 0 old
PASS G2 21 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 8 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 348 texts (min 5.77:1), 148 marks (min 3.37:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 6 changed component files
PASS G8 411 embeds across 33 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (19 files), ESLint 0/0 (13 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
PASS — every required gate passed
```

Both 17-visual comparison sheets are in `test-results/design-previews/codex/F1C_Why_SystemVerilog/`. The before and after crops open both lineage predictions and show the procedural simulator’s order view.

## Test expectations

No test expectation or height reserve changed. All 1066 targeted Vitest tests passed.

## Kit requests

- **Container focus.** At MDX line 315, the caption says “The inner box, uvm_pkg, is a library”. The kit currently applies focus only to non-container nodes at `src/components/visual-system/BlockDiagram.tsx:457`. A focus treatment for the whole enclosure would direct attention to the library.

The gate recorded 478 kit readings. Each row points to a line in `content/curriculum/T1_Foundational/F1C_Why_SystemVerilog/index.mdx`. The [gate JSON](F1C_Why_SystemVerilog.json) keeps the unrounded values.

<details>
<summary>Kit measurement details</summary>

| Gate | MDX line | Figure and element | Measurements |
| --- | --- | --- | --- |
| G5 | 25 | What contains what: Verilog, SystemVerilog and UVM · polyline stroke-foreground/75 | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.00:1, light 390 1.00:1 |
| G5 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · line stroke-border/70 | dark 1440 1.27:1, dark 1440 1.30:1, light 1440 1.15:1, dark 390 1.27:1, dark 390 1.28:1, light 390 1.15:1 |
| G5 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · rect fig-band fill-fig-cyan-fill stroke-fig-cyan/40 | dark 1440 2.55:1, light 1440 1.69:1, dark 390 2.55:1, light 390 1.69:1 |
| G5 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · rect fig-band fill-fig-rose-fill stroke-fig-rose/40 | dark 1440 1.84:1, light 1440 1.97:1, dark 390 1.85:1, light 390 1.97:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · →3 | dark 1440 3.10:1, light 1440 4.10:1, dark 390 3.10:1, light 390 4.10:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · line stroke-border/70 | dark 1440 1.26:1, light 1440 1.16:1, dark 390 1.26:1, light 390 1.16:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · rect fig-band fill-fig-cyan-fill stroke-fig-cyan/40 | dark 1440 2.55:1, light 1440 1.69:1, dark 390 2.55:1, light 390 1.69:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · rect fig-band fill-fig-emerald-fill stroke-fig-emerald/40 | dark 1440 2.12:1, light 1440 1.60:1, dark 390 2.12:1, light 390 1.60:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · line stroke-muted-foreground/25 | dark 1440 1.60:1, dark 1440 1.49:1, dark 1440 1.59:1, light 1440 1.45:1, light 1440 1.43:1, dark 390 1.61:1, dark 390 1.60:1, dark 390 1.49:1, dark 390 1.59:1, light 390 1.46:1, light 390 1.43:1, light 390 1.45:1 |
| G5 | 251 | SvaSequenceWaveformVisualizer · rect fill-transparent stroke-transparent hover:fill-fig-cyan/10 | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.00:1, light 390 1.00:1 |
| G5 | 315 | Where UVM lives in a SystemVerilog simulation · polyline stroke-muted-foreground | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.00:1, light 390 1.00:1 |
| G5 | 467 | legacy_cnt bench: reset at the first edge, then three increments · line stroke-border/70 | dark 1440 1.30:1, dark 1440 1.27:1, light 1440 1.16:1, dark 390 1.28:1, dark 390 1.26:1, light 390 1.16:1 |
| G5 | 467 | legacy_cnt bench: reset at the first edge, then three increments · rect fig-band fill-fig-emerald-fill stroke-fig-emerald/40 | dark 1440 2.35:1, light 1440 1.69:1, dark 390 2.35:1, light 390 1.69:1 |
| G5 | 542 | Nested begin_keywords pairs across a file boundary · line stroke-border | dark 1440 1.22:1, dark 1440 1.24:1, dark 1440 1.00:1, light 1440 1.13:1, light 1440 1.14:1, light 1440 1.00:1, dark 390 1.23:1, dark 390 1.24:1, dark 390 1.00:1, light 390 1.14:1, light 390 1.00:1 |
| G5 | 542 | Nested begin_keywords pairs across a file boundary · rect fill-muted stroke-border | dark 1440 1.33:1, dark 1440 1.32:1, light 1440 1.22:1, light 1440 1.21:1, dark 390 1.34:1, dark 390 1.32:1, light 390 1.24:1, light 390 1.21:1 |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · IEEE 1800-2023 SystemVerilog | dark 390 10.10 px, light 390 10.10 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · IEEE 1800.2-2020 | dark 390 10.56 px, light 390 10.56 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · UVM standard: the classes | dark 390 8.72 px, light 390 8.72 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · uvm_pkg | dark 390 10.56 px, light 390 10.56 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · uvm-core 2020.3.1 library | dark 390 8.72 px, light 390 8.72 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · design half | dark 390 10.56 px, light 390 10.56 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · logic, always_ff, enum | dark 390 8.72 px, light 390 8.72 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · verification half | dark 390 10.56 px, light 390 10.56 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · classes, assertions, coverage | dark 390 8.72 px, light 390 8.72 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · Verilog base | dark 390 10.56 px, light 390 10.56 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · IEEE 1364-2005, merged in 1800-2009 | dark 390 8.72 px, light 390 8.72 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · defines | dark 390 9.18 px, light 390 9.18 px |
| G6 | 25 | What contains what: Verilog, SystemVerilog and UVM · built on | dark 390 9.18 px, light 390 9.18 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1364-1995 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · Verilog | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · e (Specman) | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · later IEEE 1647, separate | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1364-2001 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · Verilog-2001 | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · SystemVerilog 3.1a | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · Accellera, precursor | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1364-2005 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · last Verilog standard | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800-2005 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · extensions only | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800-2009 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · merged: one language | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · OVM and VMM | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · methodology libraries | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800-2012 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · Accellera UVM | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · pre-IEEE class reference | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800-2017 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800.2-2017 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · first UVM standard | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800-2023 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · current SystemVerilog | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · IEEE 1800.2-2020 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · current UVM standard | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · uvm-core 2020.3.1 | dark 390 10.45 px, light 390 10.45 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · Accellera library | dark 390 8.64 px, light 390 8.64 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · revised | dark 390 9.09 px, light 390 9.09 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · precursor of | dark 390 9.09 px, light 390 9.09 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · merged into | dark 390 9.09 px, light 390 9.09 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · OVM basis, VMM concepts | dark 390 9.09 px, light 390 9.09 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · source for | dark 390 9.09 px, light 390 9.09 px |
| G6 | 59 | How Verilog, SystemVerilog and UVM standards relate · implemented by | dark 390 9.09 px, light 390 9.09 px |
| G6 | 129 | One compile serves design and testbench · one SystemVerilog compile | dark 390 9.90 px, light 390 9.90 px |
| G6 | 129 | One compile serves design and testbench · types_pkg | dark 390 10.35 px, light 390 10.35 px |
| G6 | 129 | One compile serves design and testbench · package: shared types | dark 390 8.55 px, light 390 8.55 px |
| G6 | 129 | One compile serves design and testbench · DUT | dark 390 8.10 px, light 390 8.10 px |
| G6 | 129 | One compile serves design and testbench · dut | dark 390 10.35 px, light 390 10.35 px |
| G6 | 129 | One compile serves design and testbench · design: always_ff, enum | dark 390 8.55 px, light 390 8.55 px |
| G6 | 129 | One compile serves design and testbench · tb_top | dark 390 10.35 px, light 390 10.35 px |
| G6 | 129 | One compile serves design and testbench · testbench: classes | dark 390 8.55 px, light 390 8.55 px |
| G6 | 129 | One compile serves design and testbench · IF | dark 390 8.10 px, light 390 8.10 px |
| G6 | 129 | One compile serves design and testbench · bus_if | dark 390 10.35 px, light 390 10.35 px |
| G6 | 129 | One compile serves design and testbench · interface: signal bundle | dark 390 8.55 px, light 390 8.55 px |
| G6 | 129 | One compile serves design and testbench · import | dark 390 9.00 px, light 390 9.00 px |
| G6 | 129 | One compile serves design and testbench · port | dark 390 9.00 px, light 390 9.00 px |
| G6 | 129 | One compile serves design and testbench · drives, samples | dark 390 9.00 px, light 390 9.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 0 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 5 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 6 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 214 | req \|-> ##2 gnt, one passing and one failing attempt · 7 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · →3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · →6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 0 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 5 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 6 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 251 | SvaSequenceWaveformVisualizer · 7 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · simulator (IEEE 1800-2023) | dark 390 9.91 px, light 390 9.91 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · uvm_pkg | dark 390 9.91 px, light 390 9.91 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · DUT | dark 390 8.11 px, light 390 8.11 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · dut | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · your RTL | dark 390 8.56 px, light 390 8.56 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · tb_top | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · your top module | dark 390 8.56 px, light 390 8.56 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · my_item | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · your class | dark 390 8.56 px, light 390 8.56 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · TEST | dark 390 8.11 px, light 390 8.11 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · my_test | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · uvm_sequence_item | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · IEEE 1800.2 §14.1 | dark 390 8.56 px, light 390 8.56 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · uvm_test | dark 390 10.37 px, light 390 10.37 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · IEEE 1800.2 §13.2 | dark 390 8.56 px, light 390 8.56 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · extends | dark 390 9.01 px, light 390 9.01 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · run_test() | dark 390 9.01 px, light 390 9.01 px |
| G6 | 315 | Where UVM lives in a SystemVerilog simulation · instantiates | dark 390 9.01 px, light 390 9.01 px |
| G6 | 467 | legacy_cnt bench: reset at the first edge, then three increments · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 467 | legacy_cnt bench: reset at the first edge, then three increments · 1 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 467 | legacy_cnt bench: reset at the first edge, then three increments · 2 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 467 | legacy_cnt bench: reset at the first edge, then three increments · 3 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 467 | legacy_cnt bench: reset at the first edge, then three increments · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · legacy_a.v | dark 390 8.07 px, light 390 8.07 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · legacy_b.v | dark 390 8.07 px, light 390 8.07 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · keyword stack | dark 390 8.07 px, light 390 8.07 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · kept by the tool | dark 390 6.61 px, light 390 6.61 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · Start: the implementation's default set is in effect (implementation | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · dependent, §22.14) | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 1 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · `begin_keywords "1364-2001": push | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 2 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · in effect: 1364-2001 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · end of legacy_a.v with no `end_keywords; legacy_b.v starts under 1364-2001 | dark 390 7.34 px, light 390 7.34 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 3 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · `begin_keywords | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · "1364-1995": push | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · (nested) | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 4 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · in effect: 1364-1995 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 5 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · `resetall: no effect | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · on the stack | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 6 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · `end_keywords: pop | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 7 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · again | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 8 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 9 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · in effect: the default | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · set again | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 10 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · "1364-2000" | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · 11 | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · error: unrecognized | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · version_specifier | dark 390 7.71 px, light 390 7.71 px |
| G6 | 542 | Nested begin_keywords pairs across a file boundary · (§22.14) | dark 390 7.71 px, light 390 7.71 px |

</details>

## Independent review

- **Design.** The recap’s full-width foundation makes containment readable. The first preview exposed a plate rim under the verification label, so the final plate leaves a clear gutter. The forced-colors crop also prompted a wider gap between the two right-hand outlines. Opaque ring surfaces keep each deeper keyword revision legible and the cyan outline identifies the entry ring.
- **What it teaches.** The shared kit request/grant waveform retains its attempt lengths and pass/fail markers. The procedural cursor holds the exact time coordinate and replaces the neutral gridline there, so it reads as the current position. Lists, timeline stops and process results stay in their original order.
- **Robustness.** Chromium passed at 1440, 1280, 768 and 390 px. Forced colors, print and reduced motion rendered without page overflow or errors. Tab selected the next comparison control and Enter activated it. Both lineage predictions could be revealed. A separate before and after comparison checked the fully revealed text and aria of all 13 interactive instances in both themes.
