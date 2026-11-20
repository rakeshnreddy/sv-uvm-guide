# F2A — Core Data Types

## Visual inventory and teaching intent

| Base MDX line | Visual | What the learner should see | Focal part and color |
| --- | --- | --- | --- |
| 24 | Declaration anatomy | Kind, data type, range and sign answer four independent questions about each declaration. | Ordered leaders and quiet raised plates connect each declaration token to its original explanation. |
| 83 | Compile, elaborate, simulate | The three steps run in order, and a driver conflict is normally detected when elaboration connects drivers. | The resolved-driver step is raised. Rose remains the reported error. |
| 129 | Four-value key | The neutral panels let the learner compare 0, 1, hatched X and dashed Z without relying on hue. | The four bit marks sit in one column. Slate, cyan, rose hatch and amber dash carry their existing meanings. |
| 158 | Four-state logic lab | Test which known bit can settle an operation despite an X or Z. | The selected truth-table cell uses cyan. The four value samples sit on neutral plates. |
| 184 | Unassigned values | A declaration’s state count and kind determine its default value before the first write. | The declaration and its default value share a recessed stage, with the prediction controls above the result. |
| 213 | Literal anatomy | Read a based literal in token order, then see how one X digit expands and pads the stored bits. | Raised token plates lead to the sized bits. The X cells keep a rose hatch with clear centers for their labels. |
| 336 | Literal decoder | Step from the original tokens to the exact sized bits and their numeric reading. | The active decoding step has a cyan edge. Inactive steps stay neutral and the bit strip preserves its value cues. |
| 357 | Equality explorer | A known mismatch can settle logical equality, while case and wildcard equality treat X differently. | The operator under test uses the existing comparison stage and the deciding bit remains marked. |
| 384 | Two roads for one X | The same unknown can disappear into branch selection or remain visible in the computed value. | Two neutral stages share one input. The lower result repeats the rose hatch, and the upper result is a plain chip. |
| 475 | Driver legality | Writing rules follow net or variable kind, even when both declarations use a four-state data type. | Compare the paired legal and illegal driver paths. The error nodes carry rose and their existing marks. |
| 517 | Net resolution | Drivers and their strengths determine the value the net resolves to. | The active strength row is cyan. The driver values retain the state chips. |
| 540 | Unknown recap | Follow the same X through an operation, a branch and a two-state assignment. | The single hatched X feeds all three paths. A dashed neutral outline distinguishes the branch that hides it. |
| 603 | Type widths | Equal bar widths can represent distinct state counts and signs; ranged types have no fixed width. | The longest bar sets the scale. Single and double outlines and the labels keep the value systems distinct. |
| 620 | Data type sandbox | Writing one 4-state pattern to different declarations shows which values are retained, coerced or undriven. | The stored or resolved bits are the focus. A quiet companion plate lists the type properties. |
| 634 | Width and sign steps | A wider context admits the carry; on the narrower path the carry never exists. | The cyan carry stands beside the five ordered fuchsia caps. The dashed out-of-context cell keeps the absent-carry mark. |
| 797 | Lost-carry lab | Move the size cast and observe which expression step gets to use nine bits. | Follow the ordered evaluation plates. The deciding step is cyan and the trap is rose. |
| 821 | Packed and unpacked arrays | Packed lanes form one indexed vector, while unpacked elements are independent. | The cyan w[2] lane sits in the continuous indigo strip. Separate unpacked elements are neutral and spaced apart. |
| 874 | Packed and unpacked selects | Selections highlight packed lanes or separate elements according to the expression. | The cyan read highlight follows the active element. Neutral plates make the unpacked elements separate. |
| 886 | Indexed part-select | The selected width stays fixed while the base and range direction determine the touched bits. | The selected range remains on the same bit strip as the source value. The stage is a recessed well. |
| 896 | Mixed-dimension memory | Select the unpacked word first, then its packed byte and bit. | A raised word leads to one packed byte and one bit. Indigo carries the packed data and cyan follows the selected path. |
| 956 | 3D memory explorer | Track the selected word, byte and bit through the three indexing levels. | The selected drawer, lane and bit use the existing 3D layout, semantic bit colors and the same 2D table selection. |
| 962 | Mixed-dimension selects | Existing selection cues show each successive word, byte and bit of the chosen expression. | The cyan selection follows the choose-and-reveal flow from drawer to lane to bit. |
| 978 | Named and anonymous types | A package defines one shared type; two independent anonymous enum declarations stay distinct. | The two declarations use violet and amber for their explicitly named DUT and testbench locations. The shared package is neutral. |
| 1019 | Enum methods | The methods step through declared members and return values defined by the enum. | The cyan current member is easy to locate on the line. The returned marker preserves its existing cue. |
| 1039 | Packed cmd_t field map | Field lengths are to scale; the first member sits in the most significant bits. | One indigo vector spans the three proportional widths. Neutral separators retain all field boundaries. |
| 1085 | Packed struct explorer | Editing one field changes its exact slice in the single packed storage vector. | The bit strip is the visual focus. Its well leaves the declaration and controls outside the stored-value display. |
| 1098 | String operations | The result panel shows the returned value or the updated string, including an out-of-range default. | The result appears on a raised neutral plate next to the unchanged method controls. |
| 1117 | Cast explorer | A size cast can change width while a sign cast changes how the existing bits are read. | The fuchsia evaluation order stays readable while the cyan deciding step follows the selected cast. |
| 1128 | Cast decision | The two questions distinguish bit manipulation from checked value conversion. | Follow the existing neutral yes/no branches and their checked-return destination. |
| 1437 | Four-state boundary | Keeping unknowns at the pins until the monitor checks them prevents a false pass in two-state arithmetic. | The monitor conversion point is the focal node. Existing design, testbench and data-flow roles remain. |
| 1482 | Per-bit driver legality | The verdict follows which continuous and procedural writers overlap on each individual bit. | Each bit has its own raised result card. Rose means compile error and amber dashes retain the open outcome. |
| 1513 | Charge retention | With all drivers at Z a trireg keeps charge, while the comparison wire floats. | The release step is cyan. The compared charge and wire results keep their separate value cues. |
| 1534 | Open-drain wiring | Both devices can pull SDA low or release it, with the pull-up setting the released value. | The shared SDA line is the raised node. Both device inputs stay neutral. |
| 1553 | Open-drain resolution | A strong drive overrides the pull-up and an undriven line reads the pull-strength value. | The selected combination is cyan and the value chips retain the strength result. |
| 1620 | Literal sizing edge cases | A sizing run exposes when an unsized or fill literal pads, needs extra width or truncates. | The active sizing step is highlighted where the existing trace retains, extends or truncates the bits. |
| 1629 | Vector condition | A known high bit can make the vector nonzero even when the other bits are unknown. | The known-1 output remains visible beside the active condition path. The stage groups the compared values. |
| 1722 | Declaration scenario quiz | The selected declaration and its feedback connect the outcome to the writing or value rule. | The fuchsia progress line follows completed scenarios. Feedback keeps its ✓ and ✕ cues. |
| 1856 | Reset bug trace | The monitor samples on edges 2–4 while the unassigned internal bit remains X. | The kit waveform keeps the observer’s sample edges and the rose unknown. |
| 1929 | X-check debugger | Moving the check before the two-state conversion exposes the false passes. | The code and trace show where the conversion hides the bug. The revealed output sits on its own stage. |
| 1940 | Reset bug comparison | The same sample is X at the DUT, zero in the two-state copy and a failure in the four-state check. | The false-pass and failure marks distinguish the different checks over the same source value. |

The inventory has nine hand-drawn figures, eight kit diagrams and 23 embedded visual instances. Four interview prompts supply controls and are captured in the baseline separately.

## Visual direction

Use quiet glass for declaration kinds and containers. Preserve slate and cyan for known low and high, rose hatching for X, amber dashes for Z, indigo for multi-bit data and cyan for a selected cell. For the five width-and-sign steps, use fuchsia caps on the steps and retain the amber extension badges and cyan carry named in the caption. Keep the sizes in the packed layouts proportional to their bit counts.

## Kit focus and roles

- **Compile, elaborate, simulate.** Focus on `elab`. The caption says “A driver error, such as two continuous assignments on one logic variable y, is usually found when elaboration connects the drivers.”
- **Named and anonymous types.** The anonymous declarations already say “anonymous, in dut” and “anonymous, in tb_top”. Apply design and testbench roles to those respective nodes. The shared package stays neutral.
- **Four-state boundary.** Focus on `mon`. The caption says “The monitor is the one conversion point, guarded by $isunknown”.
- **Open-drain wiring.** Focus on `sda`. The caption says “With both devices letting go, only the tri1 pull-up is left, so sda reads 1 at pull strength”.

## Gate output

```text
PASS G1 44 source instances, 44 rendered; 0 old
PASS G2 44 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 13 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 3784 texts (min 4.98:1), 1760 marks (min 3.51:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 14 changed component files
PASS G8 372 embeds across 27 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (36 files), ESLint 0/0 (23 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
PASS — every required gate passed
```

Both 40-visual before and after sheets are in `test-results/design-previews/codex/F2A_Core_Data_Types/`.

## Test expectations

The measured PacketSorterGame reserve on the shared F2B route moved from 364/364/552 to 380/380/568 px for desktop, mid and phone. The height test now pins these measured values. The packet sorter’s drawing and controls are unchanged.

The existing net-resolution test still requires the amber tool-dependent result. The redesigned result uses the semantic amber tokens and a dashed border.

The four-state badge was colliding with its own double outline. The revised badge keeps the outline and prevents the label from wrapping inside it. The DataTypeComparisonChart widths view’s pinned mid reserve moved from 1354 to 1370 px.

All 1335 targeted Vitest tests passed.

## Kit requests

- **Bit strip labels.** The shared `src/components/visual-system/BitStrip.tsx` draws the 9 px bit indices and sign marker. The table identifies their F2A embed lines and the affected themes. Overlapping kit strip labels and marker colors also appear below.
- **Value chips.** The existing shared X chip failed the light-theme text ratio in the four-state lab. The individual measurements are below.
- **Timing and architecture diagrams.** The table records the small phone labels, timing bands and muted strokes reported by the kit.

The gate recorded 588 kit readings. Each row points to a line in `content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx`. The [gate JSON](F2A_Core_Data_Types.json) keeps the unrounded values.

<details>
<summary>Kit measurement details</summary>

| Gate | MDX line | Figure and element | Measurements |
| --- | --- | --- | --- |
| G7 | 188 | LogicStateDiagram | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200 |
| G7 | 870 | SignednessVisualizer | dark 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, ring-violet-500, bg-sky-500, light 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, ring-violet-500, bg-sky-500, dark 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, ring-violet-500, bg-sky-500, light 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, ring-violet-500, bg-sky-500 |
| G7 | 956 | ArraySelectExplorer | dark 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, dark 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200 |
| G7 | 968 | ArraySelectExplorer | dark 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-violet-500, text-violet-800, text-violet-200, bg-sky-500, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-violet-500, text-violet-800, text-violet-200, bg-sky-500, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, dark 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-violet-500, text-violet-800, text-violet-200, bg-sky-500, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-violet-500, text-violet-800, text-violet-200, bg-sky-500, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200 |
| G7 | 1050 | SystemVerilog3DVisualizer | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, bg-sky-500, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200 |
| G7 | 1056 | ArraySelectExplorer | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200 |
| G7 | 1188 | PackedLayoutExplorer | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200 |
| G7 | 1220 | SignednessVisualizer | dark 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, light 1440 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, dark 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200, light 390 border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-slate-400, bg-slate-500, text-slate-700, text-slate-200 |
| G7 | 1734 | LogicStateDiagram | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, bg-sky-500, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, bg-sky-500, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, bg-sky-500, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-rose-500, text-rose-700, text-rose-200, rgba(2, border-amber-500, bg-amber-500, text-amber-800, text-amber-200, bg-sky-500 |
| G5 | 102 | Compile, elaborate, simulate: where errors appear · polyline stroke-foreground/75 | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.00:1, light 390 1.00:1 |
| G5 | 870 | SignednessVisualizer · S | dark 1440 1.83:1, light 1440 1.66:1, dark 390 1.83:1, light 390 1.66:1 |
| G5 | 870 | SignednessVisualizer · 0 | dark 1440 3.96:1, light 1440 2.40:1, dark 390 3.96:1, light 390 2.42:1 |
| G5 | 1072 | One typedef in a package, two anonymous enums that never match · polyline stroke-fig-indigo | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.00:1, light 390 1.00:1 |
| G5 | 1072 | One typedef in a package, two anonymous enums that never match · polyline stroke-muted-foreground | dark 1440 1.00:1, light 1440 1.00:1, dark 390 1.23:1, light 390 1.16:1 |
| G5 | 1220 | SignednessVisualizer · 1 | dark 1440 3.86:1, light 1440 2.15:1, dark 390 3.79:1, light 390 2.16:1 |
| G5 | 1220 | SignednessVisualizer · 0 | dark 1440 3.98:1, light 1440 2.40:1, dark 390 3.95:1, light 390 2.42:1 |
| G5 | 1961 | The reset bug nobody saw · line stroke-border/70 | dark 1440 1.25:1, light 1440 1.16:1, dark 390 1.25:1, light 390 1.16:1 |
| G5 | 2045 | The reset bug, explained · line stroke-border/70 | dark 1440 1.26:1, dark 1440 1.25:1, light 1440 1.15:1, light 1440 1.16:1, dark 390 1.26:1, dark 390 1.25:1, light 390 1.15:1, light 390 1.16:1 |
| G5 | 2045 | The reset bug, explained · rect fig-band fill-fig-rose-fill stroke-fig-rose/40 | dark 1440 1.84:1, light 1440 1.96:1, dark 390 1.84:1, light 390 1.96:1 |
| G5 | 188 | LogicStateDiagram · X | light 1440 4.35:1, light 390 4.15:1 |
| G5 | 956 | ArraySelectExplorer · 31:24 | light 1440 4.36:1, light 390 4.36:1 |
| G5 | 968 | ArraySelectExplorer · 31:24 | light 1440 4.31:1, light 390 4.31:1 |
| G5 | 1050 | SystemVerilog3DVisualizer · 31:24 | light 1440 4.34:1, light 390 4.38:1 |
| G5 | 1188 | PackedLayoutExplorer · 31:28 | light 1440 4.35:1, light 390 4.32:1 |
| G5 | 1734 | LogicStateDiagram · X | light 1440 4.32:1, light 390 4.17:1 |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · reads and checks source | dark 390 9.10 px, light 390 9.10 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · connects every driver | dark 390 9.10 px, light 390 9.10 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · runs the processes | dark 390 9.10 px, light 390 9.10 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · two drivers on logic y | dark 390 9.10 px, light 390 9.10 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · error | dark 390 8.62 px, light 390 8.62 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · then | dark 390 9.57 px, light 390 9.57 px |
| G6 | 102 | Compile, elaborate, simulate: where errors appear · reports | dark 390 9.57 px, light 390 9.57 px |
| G6 | 533 | One net, one variable: who may write them · wire y (a net) | dark 390 9.90 px, light 390 9.90 px |
| G6 | 533 | One net, one variable: who may write them · logic v (a variable) | dark 390 9.90 px, light 390 9.90 px |
| G6 | 533 | One net, one variable: who may write them · assign y = a | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · continuous driver 1 | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · assign y = b | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · continuous driver 2 | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · y | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · strongest wins, tie gives x | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · initial y = 0 | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · procedural write on a net | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · error | dark 390 8.10 px, light 390 8.10 px |
| G6 | 533 | One net, one variable: who may write them · initial v = 1 | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · procedural write 1 | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · always @(c) v = 0 | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · procedural write 2 | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · v | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · last write wins | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · two assign on v | dark 390 10.35 px, light 390 10.35 px |
| G6 | 533 | One net, one variable: who may write them · two continuous drivers | dark 390 8.55 px, light 390 8.55 px |
| G6 | 533 | One net, one variable: who may write them · a | dark 390 9.00 px, light 390 9.00 px |
| G6 | 533 | One net, one variable: who may write them · b | dark 390 9.00 px, light 390 9.00 px |
| G6 | 533 | One net, one variable: who may write them · ✕ illegal | dark 390 9.00 px, light 390 9.00 px |
| G6 | 533 | One net, one variable: who may write them · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 533 | One net, one variable: who may write them · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 533 | One net, one variable: who may write them · ✕ error | dark 390 9.00 px, light 390 9.00 px |
| G6 | 870 | SignednessVisualizer · S | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 956 | ArraySelectExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 968 | ArraySelectExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1050 | SystemVerilog3DVisualizer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · types_pkg | dark 390 10.84 px, light 390 10.84 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · typedef cmd_t and state_t | dark 390 8.95 px, light 390 8.95 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · DUT | dark 390 8.48 px, light 390 8.48 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · dut | dark 390 10.84 px, light 390 10.84 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · cmd_t c (imported) | dark 390 8.95 px, light 390 8.95 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · tb_top | dark 390 10.84 px, light 390 10.84 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · cmd_t t (imported) | dark 390 8.95 px, light 390 8.95 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · enum {A, B} e1; | dark 390 10.84 px, light 390 10.84 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · anonymous, in dut | dark 390 8.95 px, light 390 8.95 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · enum {A, B} e2; | dark 390 10.84 px, light 390 10.84 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · anonymous, in tb_top | dark 390 8.95 px, light 390 8.95 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · import | dark 390 9.42 px, light 390 9.42 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · same type ✓ | dark 390 9.42 px, light 390 9.42 px |
| G6 | 1072 | One typedef in a package, two anonymous enums that never match · ✕ no match | dark 390 9.42 px, light 390 9.42 px |
| G6 | 1188 | PackedLayoutExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 1188 | PackedLayoutExplorer · 14 | dark 390 1.00:1, light 390 1.00:1 |
| G6 | 1188 | PackedLayoutExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 1188 | PackedLayoutExplorer · 0 | dark 390 1.87:1, light 390 1.47:1 |
| G6 | 1188 | PackedLayoutExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1188 | PackedLayoutExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1231 | Which cast? Two questions · width or sign only? | dark 390 10.45 px, light 390 10.45 px |
| G6 | 1231 | Which cast? Two questions · same bits, re-sized or re-signed | dark 390 8.64 px, light 390 8.64 px |
| G6 | 1231 | Which cast? Two questions · N'(x), signed'(x) | dark 390 10.45 px, light 390 10.45 px |
| G6 | 1231 | Which cast? Two questions · size or sign cast (§6.24.1) | dark 390 8.64 px, light 390 8.64 px |
| G6 | 1231 | Which cast? Two questions · value always valid? | dark 390 10.45 px, light 390 10.45 px |
| G6 | 1231 | Which cast? Two questions · for example a member | dark 390 8.64 px, light 390 8.64 px |
| G6 | 1231 | Which cast? Two questions · type'(x) | dark 390 10.45 px, light 390 10.45 px |
| G6 | 1231 | Which cast? Two questions · static cast, unchecked | dark 390 8.64 px, light 390 8.64 px |
| G6 | 1231 | Which cast? Two questions · if (!$cast(d, s)) | dark 390 10.45 px, light 390 10.45 px |
| G6 | 1231 | Which cast? Two questions · checked; 0 means invalid | dark 390 8.64 px, light 390 8.64 px |
| G6 | 1231 | Which cast? Two questions · yes | dark 390 9.09 px, light 390 9.09 px |
| G6 | 1231 | Which cast? Two questions · no | dark 390 9.09 px, light 390 9.09 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · SEQ | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · rand bit fields: 2-state | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · DRV | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · drives logic pins | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · DUT | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · logic registers | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · IF | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · logic signals: 4-state | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · SCB | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · int arithmetic, !== check | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · MON | dark 390 8.90 px, light 390 8.90 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · logic fields, $isunknown | dark 390 9.40 px, light 390 9.40 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · item | dark 390 9.89 px, light 390 9.89 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · pin values | dark 390 9.89 px, light 390 9.89 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · pins | dark 390 9.89 px, light 390 9.89 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · sampled pins | dark 390 9.89 px, light 390 9.89 px |
| G6 | 1540 | 4-state at the boundary, 2-state in the arithmetic · txn | dark 390 9.89 px, light 390 9.89 px |
| G6 | 1638 | Two open-drain devices on one pulled-up line · (strong0, highz1) | dark 390 9.19 px, light 390 9.19 px |
| G6 | 1638 | Two open-drain devices on one pulled-up line · tri1: reads 1 when idle | dark 390 9.19 px, light 390 9.19 px |
| G6 | 1638 | Two open-drain devices on one pulled-up line · 0 or z | dark 390 9.68 px, light 390 9.68 px |
| G6 | 1734 | LogicStateDiagram · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1734 | LogicStateDiagram · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1734 | LogicStateDiagram · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1734 | LogicStateDiagram · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1961 | The reset bug nobody saw · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 1961 | The reset bug nobody saw · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 1961 | The reset bug nobody saw · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 1961 | The reset bug nobody saw · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 1961 | The reset bug nobody saw · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 2045 | The reset bug, explained · 0 | dark 390 10.50 px, dark 390 10.00 px, light 390 10.50 px, light 390 10.00 px |
| G6 | 2045 | The reset bug, explained · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 2045 | The reset bug, explained · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 2045 | The reset bug, explained · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 2045 | The reset bug, explained · 4 | dark 390 10.00 px, light 390 10.00 px |

</details>

## Independent review

- **Design.** The 390 px drawing pass exposed colliding labels in the value key and the width-and-sign diagram. The final baselines leave room for each label, and the missing-carry strike sits clear of the digit. The comparison sheet shows the same plate and well treatments across both themes.
- **What it teaches.** The declaration leaders connect each token to its own explanation. The packed memory diagrams keep the selected word, byte and bit in order. The 32-bit struct fields retain proportional widths, and the two-state and four-state outcomes preserve their glyphs, hatches and dashes.
- **WebGL.** A supplemental browser pass enabled software WebGL, revealed the selected drawer, and drew the 365 × 418 px scene in both themes without page errors. The ordinary gate and contact sheets show the equivalent 2D view.
- **Robustness.** Chromium passed all seven configurations across 1440, 1280, 768 and 390 px, including print, forced colors and reduced motion. Tab moved to the next bit with visible focus and Enter cycled its value. The print and forced-colors crops keep the unknown hatch and high-impedance dash distinct. The smallest hand-drawn phone label was 11.36 px.
