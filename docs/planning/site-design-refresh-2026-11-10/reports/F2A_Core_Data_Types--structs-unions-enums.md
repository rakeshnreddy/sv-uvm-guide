# F2A — Structs, Unions, and Enums

## Visual inventory and teaching intent

| Base MDX line | Visual | What the learner should see | Focal part and color |
| --- | --- | --- | --- |
| 17 | Three storage shapes | A struct partitions one strip, a union exposes several views of one strip, and an enum gives names to values. | The indigo storage strip links the first two panels. The rose hatch identifies the X cell, and the neutral dotted row sets off the unlisted enum value. |
| 98 | Packed and unpacked structs | Packed fields share one vector while unpacked members stay separate with no shared bit numbering. | The continuous indigo packed strip sits over separate neutral member plates. |
| 231 | Packed cmd_t | The first field owns the most significant bits and the hex digits fall on the shown field boundaries. | Indigo unifies the 32 bits. Aligned labels on neutral plates tie the example digits to their field bounds. |
| 283 | Packed struct explorer | Writing a packed field changes its matching slice in storage. | The selected field is the anchor for reading the existing kit’s bit strip. Indigo carries the multi-bit value. |
| 343 | Hard and soft packed unions | All hard-union views span one store, while a shorter soft member covers only the rightmost portion. | The aligned indigo rows share the same storage edges. The dashed region marks the preserved part of the soft union. |
| 395 | Packed union explorer | Compare how different member names read the same storage, including the bits a narrower write leaves alone. | The indigo raw storage is the reference for each member view. Shapes and labels still identify the fields. |
| 420 | Tagged union explorer | The active tag determines which reads are legal. | The cyan tag pinpoints the active member. A dashed region sets apart the undefined read. |
| 514 | Unreset enum base types | The four-state base can retain X where a two-state base reads zero. | The kit keeps its distinct four-state and two-state traces so the X/zero contrast stays visible. |
| 603 | Declaration ring and value line | next() and prev() walk declaration order and jump over values with no member. | The cyan wrap is the focal path. Fuchsia ramps across the declaration sequence and hollow marks keep the holes on the number line visible. |
| 661 | Enum declaration explorer | The value line shows which values follow from the declaration, where it leaves gaps and which declarations clash. | The current computed entry stays anchored to the value line. Ring and outline identify the highlighted entry and rose is reserved for errors. |
| 677 | Enum method explorer | The current member and the method’s returned value can be different until the result is assigned. | The cyan current and returned member outlines make their relationship visible. The existing arrow labels identify each role. |
| 712 | Choosing an enum cast | The origin and validity of a value determine whether a checked cast is needed. | The branching path carries the decision. Kit colors and branch labels retain their original meanings. |
| 736 | Enum casts lab | The enum readout and cast result expose when an assignment produces a named member. | The live outcome remains the focal element on neutral lit statement plates. The existing state cues remain on the result. |
| 742 | Shared package | The same package defines the DUT and testbench types once. | The package node is the focus between the two sides. Its caption explicitly says “bus_pkg holds the single definition of opcode_e, cmd_t, cmd_u and cmd_rec_t.” |
| 809 | Swapped-fields debugging clinic | Field-order changes move the bit slices that a packed value maps to. | The field slice is visually tied to the failing check. Active cyan, expected teal and the existing mismatch cue keep the roles separate. |
| 825 | Positions, views and names | The recap aligns one struct strip with its union view and keeps enum names in declaration order. | The indigo packed strip anchors the three rows. A neutral raw plate and three individual enum plates distinguish the other two rows. |
| 990 | Mutation board | Each check catches a particular changed behavior even when other checks pass. | The shared board’s rose failures bring the check that catches the mutation into focus. |
| 1051 | Struct assignment decision | Matching types, equivalent packed types and explicit casts answer different assignment cases. | The decision path runs through neutral kit nodes with the original branch captions. |
| 1084 | Packed tagged union labels | The tag sits at the most significant end and the active member is right-justified. | The cyan tag is the common starting point. Indigo identifies the right-justified member and dashed neutral outlines identify undefined bits. |
| 1150 | Empty enum name debugging clinic | A value without a matching named member produces the empty name symptom. | The empty-name symptom and failing check share one stage. Rose is reserved for the failing result. |
| 1269 | Packet header layout explorer | The field order and type determine the header’s exact occupied ranges. | The indigo packed value connects named fields with exact ranges, with the selected field emphasized by the existing kit. |

Seven hand drawings, four diagram-kit figures and ten visual embeds make 21 visuals. Three interview controls are included in the interactive baseline separately.

## Visual direction

Use one indigo strip for packed storage, neutral trays for independent members and dashed templates for union views. A quiet hatch or wireframe retains the original empty or absent cue. Cyan identifies the current enum member, active cast or selected tag. Fuchsia follows declaration order and stays separate from the meaning of the numeric values. The phone puts the three opening shapes in separate rows so their original labels can stay legible.

## Gate output

```text
PASS G1 24 source instances, 24 rendered; 0 old
PASS G2 24 source instances, default and revealed interactive figure strings, 0 differences
PASS G3 5 model/data dependencies, 0 changed; 0 capture discrepancies
PASS G4 render exit 0; Checked 1 file(s): 0 error(s), 0 warning(s).
PASS G5 812 texts (min 5.84:1), 468 marks (min 3.42:1), 0 below floor, 0 unmeasured
PASS G6 0 phone text samples under 11 px
PASS G7 0 new literal paints in lesson visuals and 2 changed component files
PASS G8 120 embeds across 6 pages, 0 outside ±4 px, 0 missing/failed
PASS G9 tsc 0, Vitest 0 (25 files), ESLint 0/0 (9 files)
PASS G10 4 theme/width pairs, 0 page errors or overflows
PASS — every required gate passed
```

Both 21-visual before and after sheets are in `test-results/design-previews/codex/F2A_Core_Data_Types--structs-unions-enums/`. Baseline `815e425e` captured 13 embed defaults.

## Test expectations

Chromium verified all 120 reserves across six shared routes. The existing height expectations remained within 4 px. The lesson commit changes no test expectations. The separate capture correction at `72d3385d` added a regression test for an embed inside a closed lesson disclosure.

All 1004 targeted Vitest tests passed.

## Kit requests

The gate recorded 404 kit readings. Each row points to a line in `content/curriculum/T1_Foundational/F2A_Core_Data_Types/structs-unions-enums.mdx`. The [gate JSON](F2A_Core_Data_Types--structs-unions-enums.json) keeps the unrounded values.

The requests cover shared BitStrip and ValueChip palette and phone-size readings, MutationMatrix palette and contrast, and diagram-kit contrast. The measured values and the specific rendered elements are below.

<details>
<summary>Kit measurement details</summary>

| Gate | MDX line | Figure and element | Measurements |
| --- | --- | --- | --- |
| G7 | 377 | PackedLayoutExplorer | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200 |
| G7 | 497 | PackedLayoutExplorer | dark 1440 border-rose-500, text-rose-700, text-rose-200, rgba(2, light 1440 border-rose-500, text-rose-700, text-rose-200, rgba(2, dark 390 border-rose-500, text-rose-700, text-rose-200, rgba(2, light 390 border-rose-500, text-rose-700, text-rose-200, rgba(2 |
| G7 | 522 | PackedLayoutExplorer | dark 1440 border-indigo-400, bg-indigo-500, text-indigo-800, text-indigo-100, light 1440 border-indigo-400, bg-indigo-500, text-indigo-800, text-indigo-100, dark 390 border-indigo-400, bg-indigo-500, text-indigo-800, text-indigo-100, light 390 border-indigo-400, bg-indigo-500, text-indigo-800, text-indigo-100 |
| G7 | 1390 | PackedLayoutExplorer | dark 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 1440 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, dark 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200, light 390 border-slate-400, bg-slate-500, text-slate-700, text-slate-200, border-cyan-500, bg-cyan-500, text-cyan-800, text-cyan-200, border-violet-500, text-violet-800, text-violet-200, border-amber-500, text-amber-900, text-amber-200, border-emerald-500, text-emerald-800, text-emerald-200 |
| G5 | 616 | An unreset state variable with two base types · x, no name | dark 1440 2.39:1, light 1440 3.72:1, dark 390 2.36:1, light 390 3.68:1 |
| G5 | 616 | An unreset state variable with two base types · 0 = IDLE | dark 1440 3.02:1, light 1440 4.04:1, dark 390 2.94:1, light 390 4.04:1 |
| G5 | 616 | An unreset state variable with two base types · IDLE | dark 1440 4.27:1, dark 1440 4.32:1, light 1440 4.05:1, light 1440 4.04:1, dark 390 4.26:1, light 390 4.08:1, light 390 4.05:1 |
| G5 | 616 | An unreset state variable with two base types · line stroke-border/70 | dark 1440 1.27:1, dark 1440 1.30:1, light 1440 1.16:1, light 1440 1.15:1, dark 390 1.27:1, dark 390 1.28:1, light 390 1.17:1, light 390 1.15:1, light 390 1.14:1 |
| G5 | 616 | An unreset state variable with two base types · rect fig-band fill-fig-cyan-fill stroke-fig-cyan/40 | dark 1440 2.55:1, light 1440 1.69:1, dark 390 2.55:1, light 390 1.69:1 |
| G5 | 848 | One package, shared by both sides of the bus · opcode_e, cmd_t, cmd_u, cmd_rec_t | dark 1440 1.73:1, light 1440 2.13:1, dark 390 1.73:1, light 390 2.13:1 |
| G5 | 1162 | Is x = y legal? Three questions, asked in order · e.g. two unpacked structs declared apart | dark 1440 2.27:1, light 1440 2.93:1, dark 390 2.27:1, light 390 2.93:1 |
| G5 | 377 | PackedLayoutExplorer · 31:28 | light 1440 4.35:1, light 390 4.35:1 |
| G5 | 1390 | PackedLayoutExplorer · 31:30 | light 1440 4.32:1, light 390 4.36:1 |
| G6 | 377 | PackedLayoutExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 377 | PackedLayoutExplorer · 14 | dark 390 1.00:1, light 390 1.00:1 |
| G6 | 377 | PackedLayoutExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 377 | PackedLayoutExplorer · 0 | dark 390 1.87:1, light 390 1.47:1 |
| G6 | 377 | PackedLayoutExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 377 | PackedLayoutExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 497 | PackedLayoutExplorer · 17 | dark 390 1.00:1, light 390 1.00:1 |
| G6 | 497 | PackedLayoutExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 497 | PackedLayoutExplorer · x | dark 390 1.64:1, light 390 1.12:1 |
| G6 | 497 | PackedLayoutExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 497 | PackedLayoutExplorer · 14 | dark 390 1.00:1, light 390 1.00:1 |
| G6 | 497 | PackedLayoutExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 497 | PackedLayoutExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 616 | An unreset state variable with two base types · x, no name | dark 390 9.00 px, light 390 9.00 px |
| G6 | 616 | An unreset state variable with two base types · 0 = IDLE | dark 390 9.00 px, light 390 9.00 px |
| G6 | 616 | An unreset state variable with two base types · reset seen | dark 390 9.00 px, light 390 9.00 px |
| G6 | 616 | An unreset state variable with two base types · IDLE | dark 390 10.50 px, light 390 10.50 px |
| G6 | 616 | An unreset state variable with two base types · 0 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 616 | An unreset state variable with two base types · 1 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 616 | An unreset state variable with two base types · 2 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 616 | An unreset state variable with two base types · 3 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 616 | An unreset state variable with two base types · 4 | dark 390 10.00 px, light 390 10.00 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · a guaranteed member | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · e.g. a loop first() to last() | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · from outside | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · the DUT, a file, a plusarg | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · a struct/union field | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · written as one vector | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · static cast | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · opcode_e'(raw): no check | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · $cast as a function | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · if (!$cast(op, raw)) ... | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · check the field | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · name() == "" or $cast | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · op = raw; | dark 390 10.35 px, light 390 10.35 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · compile error, never an option (§6.19.3) | dark 390 8.55 px, light 390 8.55 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · value known | dark 390 9.00 px, light 390 9.00 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · might not fit | dark 390 9.00 px, light 390 9.00 px |
| G6 | 818 | Putting a number into an enum: choose by where the value comes from · never checked | dark 390 9.00 px, light 390 9.00 px |
| G6 | 848 | One package, shared by both sides of the bus · bus_pkg | dark 390 10.35 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · opcode_e, cmd_t, cmd_u, cmd_rec_t | dark 390 8.55 px, light 390 8.55 px |
| G6 | 848 | One package, shared by both sides of the bus · DRV | dark 390 8.10 px, light 390 8.10 px |
| G6 | 848 | One package, shared by both sides of the bus · driver | dark 390 10.35 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · item → cmd_t → vif.bus | dark 390 8.55 px, light 390 8.55 px |
| G6 | 848 | One package, shared by both sides of the bus · SCB | dark 390 8.10 px, light 390 8.10 px |
| G6 | 848 | One package, shared by both sides of the bus · scoreboard | dark 390 10.35 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · stores cmd_rec_t | dark 390 8.55 px, light 390 8.55 px |
| G6 | 848 | One package, shared by both sides of the bus · MON | dark 390 8.10 px, light 390 8.10 px |
| G6 | 848 | One package, shared by both sides of the bus · monitor | dark 390 10.35 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · vif.bus → cmd_t, check op | dark 390 8.55 px, light 390 8.55 px |
| G6 | 848 | One package, shared by both sides of the bus · IF | dark 390 8.10 px, light 390 8.10 px |
| G6 | 848 | One package, shared by both sides of the bus · vif.bus | dark 390 10.35 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · logic [31:0]: one cmd_t per beat | dark 390 8.55 px, light 390 8.55 px |
| G6 | 848 | One package, shared by both sides of the bus · DUT | dark 390 8.10 px, dark 390 10.35 px, light 390 8.10 px, light 390 10.35 px |
| G6 | 848 | One package, shared by both sides of the bus · import | dark 390 9.00 px, light 390 9.00 px |
| G6 | 848 | One package, shared by both sides of the bus · cmd_t | dark 390 9.00 px, light 390 9.00 px |
| G6 | 848 | One package, shared by both sides of the bus · cmd | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · matching? | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · §6.22.1: the same declaration | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · legal | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · the same type | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · equivalent? | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · §6.22.2: same bits, states, sign | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · unpacked struct: last legal rung | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · assignment compatible? | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · §6.22.3: any integral type | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · legal, with conversion | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · silent extension or truncation | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · compile error | dark 390 10.37 px, light 390 10.37 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · e.g. two unpacked structs declared apart | dark 390 8.57 px, light 390 8.57 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · yes | dark 390 9.02 px, light 390 9.02 px |
| G6 | 1162 | Is x = y legal? Three questions, asked in order · no | dark 390 9.02 px, light 390 9.02 px |
| G6 | 1390 | PackedLayoutExplorer · 31 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 30 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 29 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 28 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 27 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 26 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 25 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 24 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 23 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 22 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 21 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 20 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 19 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 18 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 17 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 16 | dark 390 9.00 px, light 390 9.00 px |
| G5 | 1390 | PackedLayoutExplorer · ] | dark 390 1.65:1, light 390 1.26:1 |
| G6 | 1390 | PackedLayoutExplorer · 15 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 14 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 13 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 12 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 11 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 10 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 9 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 8 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 7 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 6 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 5 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 4 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 3 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 2 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 1 | dark 390 9.00 px, light 390 9.00 px |
| G6 | 1390 | PackedLayoutExplorer · 0 | dark 390 9.00 px, light 390 9.00 px |

</details>

## Independent review

- **Design.** The opening drawing has three trays at wide widths and one tray per row on phones. The shared outline and separators keep the enum member list clear in both themes. The packed union’s aligned rows read as alternate views of one store.
- **Teaching.** The wrap path follows declaration order and leaves 5 and 6 hollow on the number line. The tagged layout gives the tag and right-justified member separate treatments. Dashed neutral outlines show undefined bits, while the rose hatch in the opening sketch still represents X.
- **Robustness.** The four widths, forced colors, print and reduced motion all showed seven static figures and no horizontal overflow or browser errors. The keyboard pass found visible Tab focus, confirmed Enter executes the enum method and opened the packet explorer inside Worked solution. The smallest static phone label measured 11.85 px.
