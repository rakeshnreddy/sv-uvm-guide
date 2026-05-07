# Foundational Curriculum Implementation Spec

_for T1_Foundational in `sv-uvm-guide`_

> This document is written for an AI coding agent or human engineer to **directly implement** all recommended upgrades. It assumes full access to the repo. Directory names and example files are based on current structure under `content/curriculum/T1_Foundational/` and existing components in `@/components/visuals` and `@/components/ui`.

---

## Module → File Map

| Module Code | Description                        | MDX Path                                                              |
|------------|------------------------------------|------------------------------------------------------------------------|
| F1A        | The Cost of Bugs                   | content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx      |
| F1B        | The Verification Mindset           | content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx |
| F1C        | Why SystemVerilog                  | content/curriculum/T1_Foundational/F1C_Why_SystemVerilog/index.mdx     |
| F2A        | Core Data Types                    | content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx       |
| F2B        | Dynamic Structures                 | content/curriculum/T1_Foundational/F2B_Dynamic_Structures/index.mdx    |
| F2C        | Procedural Code and Flow Control   | content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx |
| F2D        | Reusable Code and Parallelism      | content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index.mdx |
| F3A        | Simulation Semantics               | content/curriculum/T1_Foundational/F3A_Simulation_Semantics/index.mdx  |
| F3B        | Scheduling Regions                 | content/curriculum/T1_Foundational/F3B_Scheduling_Regions/index.mdx    |
| F3C        | Delta Cycles and Race Conditions   | content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx |
| F4A        | Modules and Packages               | content/curriculum/T1_Foundational/F4A_Modules_and_Packages/index.mdx  |
| F4B        | Interfaces and Modports            | content/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index.mdx |
| F4C        | Clocking Blocks                    | content/curriculum/T1_Foundational/F4C_Clocking_Blocks/index.mdx       |

---

## 1. Global Implementation Principles

### 1.1 LRM Citation Discipline

**Goal:** Every technical statement about SystemVerilog/UVM semantics in T1 modules should be tied to a specific IEEE 1800‑2023 clause wherever feasible.

**Actions:**

1. For each `index.mdx` in `content/curriculum/T1_Foundational/*/`:
   - Scan for declarative technical statements about:
     - Data types, value systems, nets vs variables.
     - Scheduling regions, delta cycles, blocking vs non-blocking.
     - Arrays, dynamic structures, classes, casting.
   - At the end of each such sentence or bullet, add a parenthetical reference like:
     - `_(IEEE 1800‑2023 §6.11)_`
     - `_(IEEE 1800‑2023 §7.4.1)_`
   - Keep references **concise** and avoid over-citation on repeated points in the same paragraph.

2. Enforce a style pattern:
   - Use `§` for clause.
   - Use a **range** for large topics: `§6–7 (Data & Aggregates)`.
   - When referring to a very specific rule, include subsections: `§11.4.5 (Logical equality)`.

### 1.2 Code Style Consistency

**Goal:** Make all examples and katas look like code written by a senior DV engineer at a top-tier company.

**Standard:**

- Indentation: 2 spaces.
- Use `logic` instead of `reg` except where explicitly demonstrating legacy Verilog.
- Use `always_comb`, `always_ff`, `always_latch` in RTL-style examples.
- Ports and declarations:
  - Prefer ANSI-style module headers.
  - Always specify signedness where relevant.
- Comments:
  - Use `//` for short inline comments.
  - Use `/* ... */` only when demonstrating multi-line comments explicitly.

**Actions:**

1. For each MDX module:
   - Normalize all fenced code blocks to use ` ```systemverilog `.
   - Re-indent code to 2 spaces.
   - Replace `reg` with `logic` where not explicitly teaching `reg` vs `logic`.
   - Ensure examples mixing signed & unsigned types **explicitly declare signedness**:
     ```systemverilog
     logic signed [7:0] data_s;
     logic       [7:0] data_u;
     ```

2. Add a small "Code Style Note" block in one foundational module (e.g., `F2A_Core_Data_Types/index.mdx`) describing the style and linking to a future global style guide.

### 1.3 Interview Question Bank Integration

**Goal:** Centralize all "Ready for the Interview?" questions in a JSON schema that can be reused across the site.

**File:** `content/interview-questions/foundational_systemverilog.json`

**Schema for each entry:**

```json
{
  "id": "F2A_Q1",
  "module": "F2A_Core_Data_Types",
  "topic": "nets_vs_variables",
  "difficulty": "senior",
  "question": "What is the difference between logic, reg, and wire? When do you use each?",
  "answer_type": "long_form",
  "key_points": [
    "wire is a net used for continuous assignments with resolution functions",
    "reg is legacy; procedural variable in pre-SV",
    "logic replaces both for single-driver signals; can be used in ports and procedural blocks",
    "logic allows modeling X/Z in 4-state"
  ]
}
```

**Migration instructions:**

- Parse all existing `<details>`-based "Ready for the Interview?" questions in all T1 modules.
- For each, create a corresponding JSON entry in `foundational_systemverilog.json`.
- Do NOT remove the MDX Q&A yet; we will later drive those from JSON in a separate refactor.
- Add new senior-level questions (described module-by-module below) into the same file with unique IDs.

### 1.4 Visual Component Naming and Placement

All new visual components should be placed under `@/components/visuals/` and follow existing patterns.

New component naming convention: `PascalCase` with a descriptive suffix, e.g., `DeltaQueue3DVisualizer`, `NetResolutionSimulator`, etc.

### 1.5 Standard Kata Template

Every kata section should follow this format:

```mdx
### Kata: [Short, interview-style name]

**Objective:** One sentence stating what the learner should accomplish.

**Requirements:**
- Bullet list of explicit coding tasks.
- Include at least one observable artifact (waveform, assertion failure, coverage metric, etc.).

**What to Reflect On:**
- Bullet list of 2–4 questions prompting reasoning or "how would you explain this in an interview?".
```

**Minimum kata requirements per module:**

- F1A: At least 1 kata (quantifying bug cost escalation).
- F2A: At least 2 katas (force/release trap, X-prop trap).
- F2B: At least 2 katas (bounded queue, associative cache).
- F2C, F2D, F3A–F3C, F4A–F4C: At least 1 kata each.

---

## 2. Module-Specific Implementation Specs

### 2.1 F1A — The Cost of Bugs

**File:** `content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx`

#### Content Enhancements

1. **Mask Set Cost Clarification:** Update to `$5–10M _(varies by foundry and node; non-LRM industry data)_`.
2. **Add "Yield and Volume Impact" subsection** after "Understanding Respins" — explain how even 1% yield loss translates to millions at volume.
3. **Add "NRE Amortization Thought Experiment"** — show how a $10M respin amortizes over 5M shipped units.

#### New Visual: `FabRespinsVisualizer`

- **File:** `@/components/visuals/FabRespinsVisualizer.tsx`
- **Export:** `export default function FabRespinsVisualizer(): JSX.Element`
- **Props:** none
- **Behavior:** 2D flow diagram: Spec → RTL → Verification → Tapeout → Masks → Fab → Test → Ship. Hover/click on "ECO", "Metal Spin", "Full Respin" badges to see cost range, time range, and which artifacts are regenerated.

#### Interview Questions to Add

- `F1A_Q_ECO_vs_Respins`: Explain ECO vs metal spin vs full respin.
- `F1A_Q_BugCostEscalation`: Quantitative bug cost escalation from RTL to field.
- `F1A_Q_BringupDecision`: Scenario — bug at bring-up, walk through ECO vs next revision decision.

---

### 2.2 F2A — Core Data Types

**File:** `content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx`

#### Content Enhancements

1. **Net Resolution and Legal Assignments:** Add `wand`/`wor` resolution explanations with LRM refs (§6.7, §23.7). Add warning about procedural assignments to `wire` (§10.6).
2. **Add `trireg` Explanation:** Charge-storage node semantics (§6.7.3).
3. **Expand `$cast` and Enum Corner Cases:** Warning about illegal enum values without `$cast` guard (§6.19, §6.24.3).
4. **Add "Force/Release Trap" Kata.**

#### New Visual: `NetResolutionSimulator`

- **File:** `@/components/visuals/NetResolutionSimulator.tsx`
- **Export:** `export default function NetResolutionSimulator(): JSX.Element`
- **Props:** none
- **Behavior:** Two dropdowns for Driver A and Driver B (`"0" | "1" | "X" | "Z"`), a dropdown for net type (`"wire" | "tri" | "wand" | "wor" | "trireg"`), and a computed "Resolved Value" display. Hard-code resolution rules in a small lookup function.

#### Interview Questions to Add

- `F2A_Q_NetResolution`: How wire, wand, wor resolve multiple drivers.
- `F2A_Q_Trireg`: What is trireg and where might you encounter it.

---

### 2.3 F2B — Dynamic Structures

**File:** `content/curriculum/T1_Foundational/F2B_Dynamic_Structures/index.mdx`

#### Content Enhancements

1. Ensure comparison table covers reallocation behaviors, methods, and complexity hints.
2. Add explicit mention of dynamic array reallocation cost and queue/assoc semantics (§7.8–§7.10).

#### New Visual: `DynamicMemoryVisualizer`

- **File:** `@/components/visuals/DynamicMemoryVisualizer.tsx`
- **Export:** `export default function DynamicMemoryVisualizer(): JSX.Element`
- **Props:** none
- **Behavior:** Abstract "heap bar." User selects operations like `new[10]`, `delete`, `push_back` to see conceptual memory growth/shrink.

#### Senior-Level Katas

1. **Bounded Queue Implementation:** Implement queue-like structure with max size using dynamic array.
2. **Associative Array Cache:** Implement a cache mapping 32-bit addresses to data with `insert`, `invalidate`, `lookup`, and hit/miss statistics.

#### Interview Questions to Add

- Focus on queue vs dynamic array tradeoffs, safe `foreach` during `delete`, and complexity reasoning.

---

### 2.4 F2C — Procedural Code and Flow Control

**File:** `content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx`

#### Content Enhancements

1. **X-Optimism/X-Pessimism with Control Flow:** Add dedicated subsection explaining how `if (x_signal)` evaluates as FALSE when X (§11.4.5). Link back to F2A's X-propagation section.
2. **Blocking vs. Non-Blocking Races Kata:** Two always blocks updating the same logic — observe scheduling-dependent behavior.

---

### 2.5 F2D — Reusable Code and Parallelism

**File:** `content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index.mdx`

#### Content Enhancements

1. **Tasks vs Functions Deep Dive:** Add detailed comparison table — side effects, blocking time, void return, automatic vs static (§13.4).
2. **Fork-Join Gotchas:** Add subsection on `fork...join_any` + `disable fork` timeout pattern.
3. **Kata:** Parallel sequence with timeout using `fork` and `disable`.

---

### 2.6 F3A — Simulation Semantics

**File:** `content/curriculum/T1_Foundational/F3A_Simulation_Semantics/index.mdx`

#### Content Enhancements

1. **Delta Queue Introduction:** Add section describing time slots vs delta cycles, order of evaluation (§9.3).
2. **Senior-Level Discussion Prompts:** Multiple NBA to same variable source-order resolution, `#0` interactions, cross-block race conditions.

#### New Visual: `DeltaQueue3DVisualizer`

- **File:** `@/components/visuals/DeltaQueue3DVisualizer.tsx`
- **Export:** `export default function DeltaQueue3DVisualizer(): JSX.Element`
- **Props:** none
- **Behavior:** Show one clock edge with example always blocks (blocking, non-blocking, #0). Use colored boxes for regions (Preponed, Active, Inactive, NBA, Postponed). Animate event movement through regions in a loop.

---

### 2.7 F3B — Scheduling Regions

**File:** `content/curriculum/T1_Foundational/F3B_Scheduling_Regions/index.mdx`

#### Content Enhancements

1. **Preponed vs. Postponed:** Add section on sampling vs checking regions (§14.8).
2. **Integration with `DeltaQueue3DVisualizer`:** Link to F3A's visualizer contextually rather than duplicating.

---

### 2.8 F3C — Delta Cycles and Race Conditions

**File:** `content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx`

#### New Visual: `RaceConditionDebugger`

- **File:** `@/components/visuals/RaceConditionDebugger.tsx`
- **Export:** `export default function RaceConditionDebugger(): JSX.Element`
- **Props:** none
- **Behavior:** Toggle Block A (always_ff with blocking/non-blocking) and Block B (always_comb or always_ff). Simulate a tiny example and show when signal values change and why.

#### Kata: Fix the Race Condition

Start from design with two always blocks writing same signal, identify the race, refactor to clean separation.

---

### 2.9 F4A — Modules and Packages

**File:** `content/curriculum/T1_Foundational/F4A_Modules_and_Packages/index.mdx`

#### Content Enhancements

1. **Package Visibility and Namespace Conflicts:** Add section on `import pkg::*` collision traps. Include example showing collision with `typedef struct` named same in two packages.

---

### 2.10 F4B — Interfaces and Modports

**File:** `content/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index.mdx`

#### Content Enhancements

1. **Modport Direction Pitfalls:** Add section on what happens when you drive an input-declared signal in a modport. Explain static checking aid vs simulator behavior.

---

### 2.11 F4C — Clocking Blocks

**File:** `content/curriculum/T1_Foundational/F4C_Clocking_Blocks/index.mdx`

#### New Visual: `ClockingBlockSkewVisualizer`

- **File:** `@/components/visuals/ClockingBlockSkewVisualizer.tsx`
- **Export:** `export default function ClockingBlockSkewVisualizer(): JSX.Element`
- **Props:** none
- **Behavior:** Adjustable input and output skew values. Show when signals are sampled and driven relative to clock edge. Illustrate how skew helps avoid races.

#### Kata: Race-Free Driver Using Clocking Blocks

Implement interface with clocking block, write driver class using it, create buggy version without clocking block, compare waveforms.

---

## 3. New Global Visual Components (Summary)

| # | Component | Target Module | File |
|---|---|---|---|
| 1 | `FabRespinsVisualizer` | F1A | `@/components/visuals/FabRespinsVisualizer.tsx` |
| 2 | `NetResolutionSimulator` | F2A | `@/components/visuals/NetResolutionSimulator.tsx` |
| 3 | `DynamicMemoryVisualizer` | F2B | `@/components/visuals/DynamicMemoryVisualizer.tsx` |
| 4 | `DeltaQueue3DVisualizer` | F3A/F3B | `@/components/visuals/DeltaQueue3DVisualizer.tsx` |
| 5 | `RaceConditionDebugger` | F3C | `@/components/visuals/RaceConditionDebugger.tsx` |
| 6 | `ClockingBlockSkewVisualizer` | F4C | `@/components/visuals/ClockingBlockSkewVisualizer.tsx` |

Each should:
- Be a functional React component with no props (self-contained).
- Use existing styling conventions (Tailwind classes as seen in other visuals).
- Handle dark theme appropriately.

---

## 4. Guardrails for the Coding Agent

- Do NOT change frontmatter keys (`title`, `description`, `flashcards`) in existing MDX files.
- Do NOT remove or rename existing import statements for visuals and UI components unless explicitly instructed.
- Do NOT change navigation links (`Next:` / `Previous:`) at the bottom of modules.
- Do NOT alter existing component filenames in `@/components/visuals`; only add new ones as specified.
- Do NOT modify any non-T1 curriculum content in this pass.

---

## 5. Recommended Implementation Order

1. Create `content/interview-questions/foundational_systemverilog.json` and populate with migrated + new questions for F1A and F2A.
2. Implement `NetResolutionSimulator` and update `F2A_Core_Data_Types/index.mdx` to embed it.
3. Implement `DeltaQueue3DVisualizer` and integrate into `F3A_Simulation_Semantics/index.mdx`.
4. Implement `ClockingBlockSkewVisualizer` and integrate into `F4C_Clocking_Blocks/index.mdx`.
5. Add kata sections to all modules using the standard template.
6. Implement remaining visuals (`FabRespinsVisualizer`, `DynamicMemoryVisualizer`, `RaceConditionDebugger`) and integrate into their modules.
7. Perform a final pass to add missing LRM citations and normalize code style in all SystemVerilog snippets.

---

## 6. Definition of Done (Foundational Tier)

- [ ] Every T1_Foundational module has at least 3 senior-level interview questions in `foundational_systemverilog.json`.
- [ ] All new visuals compile and render and are imported in their target MDX.
- [ ] All code examples in T1_Foundational use 2-space indentation, `logic` over `reg` (unless teaching legacy), and `always_*` constructs consistently.
- [ ] At least one LRM clause reference is present in each technical subsection of every module.
- [ ] Each "Practice & Reinforce" section includes at least one clearly structured kata following the common template.

## 7. Senior-Level Gotcha Coverage Checklist

Ensure the following topics are covered explicitly in at least one T1 module (with examples and/or interview questions):

- [ ] 2-state vs 4-state assignment masking X/Z, and use of `$isunknown()` and `===`.
- [ ] Net resolution for `wire`, `wand`, `wor`, and the semantics of `trireg`.
- [ ] `$cast` vs plain casting for enums and classes, and illegal enum values.
- [ ] X-optimism in `if` and `case`, and mitigation via `unique case` and X-prop options.
- [ ] Delta cycle and region ordering (Preponed, Active, Inactive, NBA, Postponed).
- [ ] Races from mixing blocking and non-blocking assignments, and single-driver guidelines.
- [ ] Clocking block skew and race-free TB driver/monitor patterns.
- [ ] Modport direction semantics and common misuse patterns.
- [ ] Dynamic array/queue/associative array performance and iteration/deletion traps.
