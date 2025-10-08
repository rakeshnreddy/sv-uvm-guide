# Curriculum Modernization Tasks

This file contains a series of prompts for a coding agent to modernize the curriculum lessons based on the SystemVerilog and UVM Language Reference Manuals. The tasks are ordered logically: prerequisite split work comes first, followed by deprecation/merge clean-up, and finally content modernization.

---

### Task: Modernize "F2: SystemVerilog Language Basics"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-F2` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** F2: SystemVerilog Language Basics
- **Path:** `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics/index.mdx`
- **SystemVerilog LRM clauses:** 6 (Data types), 7 (Aggregate data types), 9 (Procedural blocks), 10 (Assignments), 11 (Operators), 12 (Flow control), 13 (Tasks and functions)

#### 1. Proposed Split & Objectives
This monolithic lesson must be split into four focused micro-lessons:

**A) F2A: Core Data Types**
- **Objectives:**
  - Differentiate between 4-state (`logic`) and 2-state (`bit`, `int`) types (LRM Clause 6.3, 6.4).
  - Declare and use vectors and packed/unpacked arrays (LRM Clause 7.2, 7.4).
  - Use `struct` and `enum` to create user-defined types (LRM Clause 7.3, 6.19).

**B) F2B: Dynamic Data Structures**
- **Objectives:**
  - Use dynamic arrays, queues, and associative arrays for flexible data storage (LRM Clause 7.5, 7.8, 7.10).
  - Apply built-in methods like `size()`, `push_back()`, `pop_front()`, and `exists()`.

**C) F2C: Procedural Code and Flow Control**
- **Objectives:**
  - Author `initial` and `always_*` blocks (LRM Clause 9.2).
  - Differentiate blocking (`=`) vs. non-blocking (`<=`) assignments (LRM Clause 10.4).
  - Use `if/else`, `case`, and loop statements for algorithmic control (LRM Clause 12).

**D) F2D: Reusable Code and Parallelism**
- **Objectives:**
  - Create reusable code with `task`s and `function`s (LRM Clause 13).
  - Launch parallel threads with `fork-join`, `fork-join_any`, and `fork-join_none` (LRM Clause 9.3).

#### 2. Content Accuracy Gaps (LRM References)
- **Inject LRM References:** Each new micro-lesson must be heavily grounded in the LRM, citing the specific clauses for every concept introduced. The current lesson has no LRM references.
- **Clarify `logic` vs. `wire`:** The explanation is good, but should be strengthened with LRM citations about `logic` being a single-driver type, while `wire` can have multiple drivers (LRM Clause 6.6).

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for F2B):** Create a `DataTypeExplorer.tsx` component. It will have tabs for `Dynamic Array`, `Queue`, and `Associative Array`. Each tab will have buttons to trigger methods (e.g., `push_back`, `delete`, `add key`) and an animated visualization of the data structure changing, along with the printed output.
- **Interactive Visual (for F2C):** Create a `BlockingSimulator.tsx` component. It will show two parallel `always` blocks trying to update the same variables. The user can switch between blocking and non-blocking assignments and see a timeline visualization of how the execution order changes and how race conditions can occur.
- **Gamified Lab (for F2D):**
    - **Title:** "The Refactoring Challenge"
    - **Goal:** Create a new lab `labs/basics/lab1_refactoring`.
    - **Setup:** The lab provides a testbench with repetitive, copy-pasted code in an `initial` block.
    - **Challenge:** The user must refactor the repetitive code into a `task` that takes arguments, making the testbench shorter, more readable, and more maintainable.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-F2-SPLIT` | `todo` | Split the F2 lesson into four parts (Data Types, Dynamic Structures, Procedural Code, Reusable/Parallel Code). | - The existing `F2` directory is renamed to `F2A_Core_Data_Types`.<br>- New directories `F2B`, `F2C`, and `F2D` are created.<br>- Content is refactored and moved to the appropriate new lessons. |
| `CURR-F2A-LORE` | `todo` | Modernize the Data Types lesson with LRM references. | - All concepts are cross-referenced to IEEE 1800-2023 (Clauses 6, 7).<br>- `npm run lint` and `npm run test` pass. |
| `CURR-F2B-VISUAL` | `todo` | Create the `DataTypeExplorer` visual and write the Dynamic Structures lesson. | - The `DataTypeExplorer.tsx` component is built and embedded in the `F2B` lesson.<br>- The lesson content is written, referencing LRM Clause 7. |
| `CURR-F2C-VISUAL` | `todo` | Create the `BlockingSimulator` visual and write the Procedural Code lesson. | - The `BlockingSimulator.tsx` component is built and embedded in the `F2C` lesson.<br>- The lesson content is written, referencing LRM Clauses 9, 10, 12. |
| `CURR-F2D-LAB` | `todo` | Create the "Refactoring Challenge" lab and write the Reusable/Parallel Code lesson. | - The `labs/basics/lab1_refactoring` is created.<br>- The `F2D` lesson is written, explaining tasks, functions, and fork-join, and embedding the lab. |
| `CURR-F2-REVIEW` | `todo` | Review all four new lessons and update site navigation. | - All four lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new structure.<br>- **Unit Tests:** Add Vitest unit tests for the new `DataTypeExplorer` and `BlockingSimulator` components.<br>- **E2E Tests:** Add Playwright tests for the new lesson pages to ensure interactive components load and are usable.<br>- All internal links are verified. |

---

### Task: Modernize "F4: RTL and Testbench Constructs"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-F4` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** F4: RTL and Testbench Constructs
- **Path:** `content/curriculum/T1_Foundational/F4_RTL_and_Testbench_Constructs/index.mdx`
- **SystemVerilog LRM clauses:** 14 (Clocking Blocks), 23 (Modules), 25 (Interfaces), 26 (Packages)

#### 1. Proposed Split & Objectives
The lesson covers too many distinct topics and must be split into three focused lessons:

**A) F4A: Structuring Designs with Modules and Packages**
- **Objectives:**
  - Define a `module` as the fundamental building block of RTL design (LRM Clause 23).
  - Instantiate modules to create a design hierarchy.
  - Define a `package` to centralize shared parameters, `typedef`s, and functions (LRM Clause 26).
  - Use the `import` keyword to make package contents available within a module.

**B) F4B: Bundling Signals with Interfaces and Modports**
- **Objectives:**
  - Define an `interface` to group related signals into a single, reusable connection (LRM Clause 25).
  - Instantiate an interface and connect it to modules.
  - Create `modport`s to define directional views (e.g., for a driver vs. a monitor) on the interface signals (LRM Clause 25.5).

**C) F4C: Synchronizing with Clocking and Program Blocks**
- **Objectives:**
  - Explain how a `clocking block` solves testbench race conditions by defining synchronous drive and sample points (LRM Clause 14).
  - Author a `clocking block` with input and output skews.
  - Explain the original purpose of a `program` block and why it is often omitted in modern UVM environments (LRM Clause 24).

#### 2. Content Accuracy Gaps (LRM References)
- **Update LRM References:** All references must be updated to **IEEE 1800-2023** and point to the specific clauses (14, 23, 24, 25, 26).
- **Emphasize Modports:** The new `F4B` lesson must have a dedicated section on `modport`s, explaining them as the primary mechanism for enforcing signal direction within an interface, which is critical for connecting to UVM components.

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for F4B):** Create a `ModportExplorer.tsx` component. It will display an interface with a set of signals. The UI will have buttons for different modports (e.g., `driver_mp`, `monitor_mp`). Clicking a button will visually update the interface diagram, greying out or changing the direction of signals to show how the modport provides a specific "view" of the interface.
- **Gamified Lab (for F4C):**
    - **Title:** "The Race Condition Lab"
    - **Goal:** Create a new lab `labs/constructs/lab1_race_condition`.
    - **Setup:** The lab provides a simple testbench where a driver and monitor use standard non-blocking assignments (`<=`) scheduled at the same clock edge, causing intermittent test failures.
    - **Challenge:** The user must first run the test and observe the non-deterministic failures. They will then add a `clocking block` to the testbench interface, update the driver and monitor to use it, and verify that the test now passes 100% of the time.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-F4-SPLIT` | `todo` | Split the F4 lesson into three parts: Modules/Packages, Interfaces/Modports, and Clocking/Program Blocks. | - The existing `F4` directory is renamed to `F4A_Modules_and_Packages`.<br>- New directories `F4B_Interfaces_and_Modports` and `F4C_Clocking_Blocks` are created.<br>- Content is refactored and moved to the appropriate new lesson. |
| `CURR-F4A-LORE` | `todo` | Modernize the Modules and Packages lesson with specific LRM references. | - All concepts are cross-referenced to IEEE 1800-2023 (Clauses 23, 26).<br>- The footer LRM reference is updated. `npm run lint` and `npm run test` pass. |
| `CURR-F4B-VISUAL` | `todo` | Create the `ModportExplorer` visual and write the Interfaces lesson. | - The `ModportExplorer.tsx` component is built and embedded in the `F4B` lesson.<br>- The lesson content provides a deep dive into interfaces and modports, referencing LRM Clause 25. |
| `CURR-F4C-LAB` | `todo` | Create the "Race Condition Lab" and write the Clocking Blocks lesson. | - The `labs/constructs/lab1_race_condition` is created with a `README`, a failing testbench, and a solution.<br>- The `F4C` lesson is written, explaining clocking blocks and embedding the lab. |
| `CURR-F4-REVIEW` | `todo` | Review all three new lessons and update site navigation. | - All three lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new three-part structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `ModportExplorer` component.<br>- **E2E Tests:** Add Playwright tests for the new lesson pages.<br>- All internal links are verified. |

---

### Task: Modernize "I-UVM-1: UVM Introduction"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-UVM-1` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-UVM-1: UVM Introduction
- **Path:** `content/curriculum/T2_Intermediate/I-UVM-1_UVM_Intro/index.mdx`
- **UVM LRM clauses:** 8 (Component), 9 (Phasing), 11 (Factory)

#### 1. Proposed Split & Objectives
This lesson is overloaded and must be split into three focused lessons:

**A) I-UVM-1A: UVM Components and Objects**
- **Objectives:**
  - Differentiate between `uvm_component` and `uvm_object` (LRM Clause 8.1, 10.1).
  - Explain the UVM testbench hierarchy and the parent-child relationship.
  - Use the `uvm_component_utils` and `uvm_object_utils` macros.

**B) I-UVM-1B: The UVM Factory**
- **Objectives:**
  - Explain the purpose of the factory for creating configurable components (LRM Clause 11).
  - Register a class with the factory using the `*_utils` macros.
  - Create objects and components using `::type_id::create()`.
  - Override types using `set_type_override_by_type` and `set_inst_override_by_type`.

**C) I-UVM-1C: UVM Phasing**
- **Objectives:**
  - List the main UVM phase groups (build, run-time, clean-up) (LRM Clause 9.2).
  - Explain the execution order of the build phases (`build`, `connect`, etc.).
  - Use objections (`raise_objection`, `drop_objection`) to control the duration of the `run_phase` (LRM Clause 9.5).

#### 2. Content Accuracy Gaps (LRM References)
- **Inject LRM References:** Each new lesson must be grounded in the UVM LRM, citing specific clauses for all concepts.
- **Clarify `new()` vs. `create()`:** The explanation must be very clear that `new()` is the SystemVerilog constructor, while `create()` is the factory method. The `uvm_component` constructor signature (`new(string name, uvm_component parent)`) must also be explained.

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for 1A):** Create a `UVMTreeExplorer.tsx` component that renders a collapsible tree view of a typical UVM environment (`uvm_test_top`, `env`, `agent`, `driver`, `monitor`).
- **Interactive Visual (for 1B):** Create a `FactoryOverrideVisualizer.tsx` component. It will show a `create` call for a `base_packet`. The user can click a button to "apply an override," and the animation will show the call being intercepted by the factory and returning an `error_packet` instead.
- **Gamified Lab (for 1B):**
    - **Title:** "The Error Injection Override"
    - **Goal:** Create a new lab `labs/uvm_factory/lab1_override`.
    - **Setup:** The lab provides a simple UVM environment with a `my_driver` that sends standard packets.
    - **Challenge:** The user must create a new `error_driver` that inherits from `my_driver` but occasionally corrupts a packet. They will then write a test that uses a factory override to replace `my_driver` with `error_driver` and a scoreboard that detects the corrupted packets.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-UVM-1-SPLIT` | `todo` | Split the I-UVM-1 lesson into three parts (Components/Objects, Factory, Phasing). | - The existing `I-UVM-1` directory is renamed to `I-UVM-1A_Components_and_Objects`.<br>- New directories `I-UVM-1B_The_UVM_Factory` and `I-UVM-1C_UVM_Phasing` are created.<br>- Content is refactored and moved to the appropriate new lessons. |
| `CURR-I-UVM-1A-VISUAL` | `todo` | Create the `UVMTreeExplorer` visual and write the Components/Objects lesson. | - The `UVMTreeExplorer.tsx` component is built and embedded in the `I-UVM-1A` lesson.<br>- The lesson content is written, referencing LRM Clauses 8 and 10. |
| `CURR-I-UVM-1B-LAB` | `todo` | Create the "Error Injection Override" lab and write the Factory lesson. | - The `labs/uvm_factory/lab1_override` is created.<br>- The `I-UVM-1B` lesson is written, explaining the factory and embedding the lab and `FactoryOverrideVisualizer` visual. |
| `CURR-I-UVM-1C-LORE` | `todo` | Write the Phasing lesson, moving the existing diagram. | - The `UvmPhasingDiagram` is moved to the `I-UVM-1C` lesson.<br>- The lesson content is written, explaining phasing and objections with references to LRM Clause 9. |
| `CURR-I-UVM-1-REVIEW` | `todo` | Review all three new lessons and update site navigation. | - All three lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new structure.<br>- **Unit Tests:** Add Vitest unit tests for the new `UVMTreeExplorer` and `FactoryOverrideVisualizer` components.<br>- **E2E Tests:** Add Playwright tests for the new lesson pages.<br>- All internal links are verified. |

---

### Task: Modernize "I-UVM-2: Building a UVM Testbench"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-UVM-2` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-UVM-2: Building a UVM Testbench
- **Path:** `content/curriculum/T2_Intermediate/I-UVM-2_Building_TB/index.mdx`
- **UVM LRM clauses:** 8 (Components), 12 (TLM), 13 (Driver/Sequencer), 14 (Monitor)

#### 1. Proposed Split & Objectives
This lesson should be split to separate component roles from their communication mechanisms:

**A) I-UVM-2A: UVM Component Roles and Hierarchy**
- **Objectives:**
  - Describe the role of the `uvm_test`, `uvm_env`, and `uvm_agent` (LRM Clause 8).
  - Explain the purpose of the `uvm_driver`, `uvm_sequencer`, and `uvm_monitor`.
  - Differentiate between an `active` and `passive` agent.
  - Sketch the standard UVM component hierarchy.

**B) I-UVM-2B: Connecting Components with TLM**
- **Objectives:**
  - Explain the purpose of Transaction-Level Modeling (TLM) (LRM Clause 12).
  - Differentiate between `put`/`get` ports, `analysis` ports, and the sequencer port.
  - Connect components in the `connect_phase`.
  - Describe the `get_next_item`/`item_done` handshake between a driver and sequencer (LRM Clause 13.3).

#### 2. Content Accuracy Gaps (LRM References)
- **Inject LRM References:** Each new lesson must cite the specific UVM LRM clauses for all components and TLM ports.
- **TLM Deep Dive:** The `I-UVM-2B` lesson must provide a clear, LRM-backed explanation of the different TLM interfaces (blocking, non-blocking, analysis) and why each is used in a specific context.

#### 3. Visual & Gamification Enhancements
- **Move Existing Visuals:** The `AnimatedUvmTestbenchDiagram` should be the centerpiece of `I-UVM-2A`. The `AnimatedUvmSequenceDriverHandshakeDiagram` should be moved to `I-UVM-2B`.
- **New Interactive Visual (for 2B):** Create a `TLMPortConnector.tsx` component. This tool will present a `uvm_monitor` with an `uvm_analysis_port` and a `uvm_scoreboard` with a `uvm_analysis_imp`. The user will have to write the `connect()` call. The tool will provide feedback on whether the connection is valid, and could be expanded to show other port/export/imp combinations.
- **Gamified Lab (for 2B):**
    - **Title:** "Wire It Up!"
    - **Goal:** Create a new lab `labs/uvm_connections/lab1_wire_it_up`.
    - **Setup:** The lab provides a UVM environment where all components are created in the `build_phase`, but the `connect_phase` is empty.
    - **Challenge:** The user must add the correct `connect()` calls to wire the driver to the sequencer and the monitor's analysis port to the scoreboard's analysis export. The test will only pass when all connections are made correctly and a transaction flows through the entire system.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-UVM-2-SPLIT` | `todo` | Split the I-UVM-2 lesson into "Component Roles" (2A) and "Connecting with TLM" (2B). | - The existing `I-UVM-2` directory is renamed to `I-UVM-2A_Component_Roles`.<br>- A new directory `I-UVM-2B_Connecting_with_TLM` is created.<br>- Content and visuals are refactored and moved to the appropriate new lessons. |
| `CURR-I-UVM-2A-LORE` | `todo` | Modernize the Component Roles lesson with specific LRM references. | - All components are cross-referenced to UVM LRM Clause 8.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-I-UVM-2B-VISUAL` | `todo` | Create the `TLMPortConnector` visual and write the TLM lesson. | - The `TLMPortConnector.tsx` component is built and embedded in the `I-UVM-2B` lesson.<br>- The lesson content provides a deep dive into TLM, referencing LRM Clause 12. |
| `CURR-I-UVM-2B-LAB` | `todo` | Create the "Wire It Up!" lab. | - The `labs/uvm_connections/lab1_wire_it_up` is created with a `README` and a testbench with an empty `connect_phase`.<br>- The lab is embedded and explained in the `I-UVM-2B` lesson. |
| `CURR-I-UVM-2-REVIEW` | `todo` | Review both new lessons and update site navigation. | - Both lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `TLMPortConnector` component.<br>- **E2E Tests:** Add Playwright tests for the new lesson pages.<br>- All internal links are verified. |

---

### Task: Modernize "I-UVM-3: UVM Sequences"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-UVM-3` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-UVM-3: Basic UVM Sequences and Stimulus Generation
- **Path:** `content/curriculum/T2_Intermediate/I-UVM-3_Sequences/index.mdx`
- **UVM LRM clauses:** 10 (Sequence Items), 13 (Sequences)

#### 1. Proposed Split & Objectives
The lesson should be split to separate basic sequence execution from advanced layering and arbitration:

**A) I-UVM-3A: Sequence Fundamentals**
- **Objectives:**
  - Differentiate between a `uvm_sequence_item` (the data) and a `uvm_sequence` (the generator) (LRM Clause 10, 13).
  - Author a basic sequence by extending `uvm_sequence` and implementing the `body()` task.
  - Use the `uvm_do`, `uvm_do_with`, and `uvm_create` macros to generate and send items.
  - Start a sequence on a sequencer from a test.

**B) I-UVM-3B: Advanced Sequencing and Layering**
- **Objectives:**
  - Control sequencer arbitration using `lock()` and `grab()` (LRM Clause 13.5).
  - Define a `uvm_virtual_sequence` to coordinate stimulus across multiple agents/sequencers.
  - Explain the purpose of the UVM sequence library for managing regression stimulus.

#### 2. Content Accuracy Gaps (LRM References)
- **Inject LRM References:** Each new lesson must cite the specific UVM LRM clauses for all concepts.
- **Macros vs. Manual:** The `I-UVM-3A` lesson should explicitly show the code that the `uvm_do` macro expands to (`start_item`, `item.randomize()`, `finish_item`) to demystify the process.
- **Virtual Sequence Deep Dive:** The `I-UVM-3B` lesson must provide a concrete example of a virtual sequencer containing handles to sub-sequencers and coordinating them.

#### 3. Visual & Gamification Enhancements
- **Move Existing Visual:** The `AnimatedUvmSequenceDriverHandshakeDiagram` is excellent and should be the centerpiece of the `I-UVM-3A` lesson.
- **New Interactive Visual (for 3B):** Create a `VirtualSequencerExplorer.tsx` component. It will show a virtual sequence with two child sequencer handles (e.g., `p_sequencer_ahb`, `p_sequencer_gpio`). The user can click a button in the sequence's `body()` to see a sub-sequence being created and started on the appropriate target sequencer, visualizing the layered stimulus flow.
- **Gamified Lab (for 3B):**
    - **Title:** "The Coordinated Attack"
    - **Goal:** Create a new lab `labs/uvm_sequences/lab1_virtual_sequence`.
    - **Setup:** The lab provides a simple environment with two agents: a bus agent and a GPIO agent.
    - **Challenge:** The user must write a virtual sequence that first uses the bus agent to write a configuration register, then uses the GPIO agent to send a trigger signal, and finally uses the bus agent again to read a status register to verify the outcome.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-UVM-3-SPLIT` | `todo` | Split the I-UVM-3 lesson into "Fundamentals" (3A) and "Advanced" (3B). | - The existing `I-UVM-3` directory is renamed to `I-UVM-3A_Sequence_Fundamentals`.<br>- A new directory `I-UVM-3B_Advanced_Sequencing` is created.<br>- Content and visuals are refactored and moved to the appropriate new lessons. |
| `CURR-I-UVM-3A-LORE` | `todo` | Modernize the Sequence Fundamentals lesson with LRM references and macro expansion. | - All concepts are cross-referenced to UVM LRM Clauses 10 and 13.<br>- A new section is added to explain what the `uvm_do` macro expands to.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-I-UVM-3B-VISUAL` | `todo` | Create the `VirtualSequencerExplorer` visual and write the Advanced Sequencing lesson. | - The `VirtualSequencerExplorer.tsx` component is built and embedded in the `I-UVM-3B` lesson.<br>- The lesson content for advanced topics is written. |
| `CURR-I-UVM-3B-LAB` | `todo` | Create the "Coordinated Attack" lab. | - The `labs/uvm_sequences/lab1_virtual_sequence` is created with a `README` and a testbench.<br>- The lab is embedded and explained in the `I-UVM-3B` lesson. |
| `CURR-I-UVM-3-REVIEW` | `todo` | Review both new sequence lessons and update site navigation. | - Both lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `VirtualSequencerExplorer` component.<br>- **E2E Tests:** Add a Playwright test for the new `I-UVM-3B` lesson page.<br>- All internal links are verified. |

---

### Task: Modernize "I-SV-2: Constrained Randomization"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-SV-2` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-SV-2: Constrained Randomization
- **Path:** `content/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization/index.mdx`
- **SystemVerilog LRM clauses:** 18 (Randomization)

#### 1. Proposed Split & Objectives
The lesson should be split to separate foundational concepts from advanced techniques:

**A) I-SV-2A: Randomization Fundamentals**
- **Objectives:**
  - Declare random variables using `rand` and `randc`, citing LRM Clause 18.3.
  - Author basic constraint blocks to define the legal value space for random variables.
  - Call the `randomize()` method and correctly check its return value to handle solver failures.
  - Use `randomize() with` for inline, single-shot constraints.

**B) I-SV-2B: Advanced Constraint Techniques**
- **Objectives:**
  - Control value probability using `dist` (LRM Clause 18.5.4).
  - Create overridable defaults using `soft` constraints (LRM Clause 18.5.10).
  - Guide the solver's decision-making process with `solve...before` (LRM Clause 18.5.11).
  - Enable and disable constraints with `constraint_mode()`.
  - Use functions within constraints to model complex, dynamic relationships.

#### 2. Content Accuracy Gaps (LRM References)
- **Update LRM Version:** All references must be updated to **IEEE 1800-2023, Clause 18**.
- **Deeper Explanations:** The new lessons must provide deeper, LRM-backed explanations for:
  - **`randc`:** Explain its use for permutation coverage and the limitations on the variable size (LRM Clause 18.3.2).
  - **Solver Behavior:** Add a conceptual explanation of the constraint-solving process, including how `solve...before` prunes the solution space early.
  - **Functions in Constraints:** Add a dedicated example showing how a function (e.g., `calculate_crc()`) can be used within a constraint block to define complex relationships that are otherwise difficult to express declaratively.

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for 2B):** Create a `ConstraintSolverExplorer.tsx` component. This tool will visualize a 2D solution space (e.g., for two `rand` variables). The user can write and toggle different constraints (`soft`, `dist`, `solve...before`) and see how the cloud of possible solutions shrinks, shifts, or becomes ordered, providing intuitive feedback on how constraints guide the solver.
- **Gamified Lab (for 2B):**
    - **Title:** "The Dependent Fields Challenge"
    - **Goal:** Create a new lab `labs/randomization_advanced/lab1_dependent_fields`.
    - **Setup:** The lab provides a `Packet` class where a `crc` field must be correctly calculated based on other random fields (`length`, `payload`). A simple constraint will fail.
    - **Challenge:** The user must first try and fail to constrain the `crc` field directly. They will then learn to use `solve...before` to ensure `length` and `payload` are generated first, followed by a call to a calculation function in `post_randomize()` to set the `crc` correctly.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-SV-2-SPLIT` | `todo` | Split the Randomization lesson into "Fundamentals" (2A) and "Advanced" (2B). | - The existing `I-SV-2` directory is renamed to `I-SV-2A_Randomization_Fundamentals`.<br>- A new directory `I-SV-2B_Advanced_Constraint_Techniques` is created.<br>- Content is divided and moved to the new lesson structures. |
| `CURR-I-SV-2A-LORE` | `todo` | Modernize the Fundamentals lesson with updated LRM references. | - All concepts are cross-referenced to IEEE 1800-2023, Clause 18.<br>- The footer LRM reference is updated.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-I-SV-2B-VISUAL` | `todo` | Create the `ConstraintSolverExplorer` visual and write the Advanced lesson. | - The `ConstraintSolverExplorer.tsx` component is built and embedded in the `I-SV-2B` lesson.<br>- The lesson content for advanced topics is written and explains the visual. |
| `CURR-I-SV-2B-LAB` | `todo` | Create the "Dependent Fields Challenge" lab. | - The `labs/randomization_advanced/lab1_dependent_fields` is created with a `README`, a testbench, and a solution.<br>- The lab is embedded and explained in the `I-SV-2B` lesson. |
| `CURR-I-SV-2-REVIEW` | `todo` | Review both new randomization lessons and update site navigation. | - Both lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new two-part lesson.<br>- **Unit Tests:** Add a Vitest unit test for the new `ConstraintSolverExplorer` component.<br>- **E2E Tests:** Add a Playwright test for the new `I-SV-2B` lesson page.<br>- All internal links are verified. |

---

### Task: Modernize "I-SV-3: Functional Coverage"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-SV-3` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-SV-3: Functional Coverage
- **Path:** `content/curriculum/T2_Intermediate/I-SV-3_Functional_Coverage/index.mdx`
- **SystemVerilog LRM clauses:** 19 (Functional Coverage)

#### 1. Proposed Split & Objectives
The lesson should be split to create a more gradual learning path:

**A) I-SV-3A: Functional Coverage Fundamentals**
- **Objectives:**
  - Define functional coverage and contrast it with code coverage, referencing IEEE 1800-2023, Clause 19.
  - Author a `covergroup` containing `coverpoint`s with simple `bins`.
  - Control sampling using event triggers and the `sample()` method.
  - Interpret a basic coverage report to identify holes.

**B) I-SV-3B: Advanced Coverage Modeling**
- **Objectives:**
  - Implement `cross` coverage to measure feature interactions.
  - Use `illegal_bins` to detect forbidden states and `ignore_bins` to filter irrelevant scenarios.
  - Model sequential behavior using transition bins (e.g., `(a => b)`).
  - Parameterize `covergroup`s using the `with` clause for reusability.
  - Control coverage collection with options like `option.per_instance`.

#### 2. Content Accuracy Gaps (LRM References)
- **Update LRM Version:** All references should be updated from IEEE 1800-2017 to **IEEE 1800-2023, Clause 19**.
- **Deeper Explanations:** The modernized lessons should add depth by citing specific LRM clauses for:
  - **Transition Bins:** Explain how to cover state machine paths or sequential behavior (Clause 19.5.3).
  - **Coverage Options:** Detail `option.per_instance`, `option.goal`, and `type_option.weight` to show how collection can be fine-tuned (Clause 19.7).
  - **`with` clause:** Explicitly show how to create parameterized covergroups for reuse, a powerful feature mentioned in Clause 19.3.

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for 3A):** Create a `CovergroupBuilder.tsx` component. This tool would provide a simple form where users can define a coverpoint and its bins. The UI would then render a visual representation of the coverage model and allow the user to "sample" values, showing the bins filling up in real-time.
- **Gamified Lab (for 3B):**
    - **Title:** "The State Machine Bug Hunt"
    - **Goal:** Create a new lab `labs/coverage_advanced/lab1_state_machine`.
    - **Setup:** The lab provides a simple state machine DUT with a bug that only triggers on a specific three-state transition (e.g., `IDLE` -> `BUSY` -> `ERROR`).
    - **Challenge:** The user must write a `covergroup` with transition bins to discover that this path is not being tested. They will then write a directed sequence to force the transition, expose the bug, and achieve 100% coverage.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-SV-3-SPLIT` | `todo` | Split the Functional Coverage lesson into "Fundamentals" (3A) and "Advanced" (3B). | - The existing `I-SV-3` directory is renamed to `I-SV-3A_Coverage_Fundamentals`.<br>- A new directory `I-SV-3B_Advanced_Coverage_Modeling` is created.<br>- Content is divided and moved to the new lesson structures. |
| `CURR-I-SV-3A-LORE` | `todo` | Modernize the Fundamentals lesson with LRM refs and the interactive builder. | - The `CovergroupBuilder.tsx` component is built and embedded.<br>- All concepts are cross-referenced to IEEE 1800-2023, Clause 19.<br>- LRM reference in footer is updated. |
| `CURR-I-SV-3B-LAB` | `todo` | Create the "State Machine Bug Hunt" lab and write the Advanced Coverage lesson. | - The `labs/coverage_advanced/lab1_state_machine` is created with a `README`, DUT, and testbench.<br>- The `I-SV-3B` `index.mdx` is written, focusing on advanced topics and the lab.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-I-SV-3-REVIEW` | `todo` | Review both new coverage lessons and update site navigation. | - Both lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated to reflect the new two-part lesson.<br>- **Unit Tests:** Add a Vitest unit test for the new `CovergroupBuilder` component.<br>- **E2E Tests:** Add a Playwright test for the new `I-SV-3B` lesson page.<br>- All internal links are verified. |

---

### Task: Modernize "I-SV-4: SystemVerilog Assertions (SVA)"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-I-SV-4` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-SV-4: SystemVerilog Assertions (SVA)
- **Path:** `content/curriculum/T2_Intermediate/I-SV-4_Assertions_SVA/index.mdx`
- **SystemVerilog LRM clauses:** 16 (Assertions), 17 (Sequences)

#### 1. Proposed Split & Objectives
The lesson should be split to separate the fundamentals from advanced temporal logic:

**A) I-SV-4A: SVA Fundamentals**
- **Objectives:**
  - Differentiate between immediate and concurrent assertions (LRM Clause 16.3, 16.4).
  - Author a simple `sequence` to describe a pattern of events over time (LRM Clause 17.3).
  - Write a `property` using the overlapping implication operator (`|->`) (LRM Clause 16.12.3).
  - Instantiate a property with `assert` and `cover` statements.

**B) I-SV-4B: Advanced Temporal Logic and Sequences**
- **Objectives:**
  - Use sequence repetition operators (`[*]`, `[+]`, `[=]`) and `goto` repetition (`[->]`) (LRM Clause 17.6).
  - Combine sequences with `and` and `or` operators (LRM Clause 17.9, 17.10).
  - Use local variables in sequences to capture values for later evaluation (LRM Clause 17.13).
  - Apply advanced property operators like non-overlapping implication (`|=>`) and `s_eventually`.

#### 2. Content Accuracy Gaps (LRM References)
- **Update LRM Version:** All references must be updated to **IEEE 1800-2023, Clauses 16 and 17**.
- **Deeper Explanations:** The new lessons must provide deeper, LRM-backed explanations for:
  - **Implication Operators:** Clearly contrast `|->` and `|=>` with timing diagrams showing when the antecedent and consequent are evaluated for each.
  - **Local Variables:** Provide a dedicated example showing how to declare a local variable inside a sequence, capture a value (e.g., an address), and use that captured value in a subsequent part of the sequence.

#### 3. Visual & Gamification Enhancements
- **Enhanced Visual (for 4B):** Enhance the `AssertionBuilder` or create a new `TemporalLogicExplorer.tsx`. This component should allow users to construct a sequence with local variables and repetitions. The UI would then show an interactive waveform and highlight the matching windows, with annotations showing the values of the local variables at each step.
- **Gamified Lab (for 4B):**
    - **Title:** "The Data Integrity Challenge"
    - **Goal:** Create a new lab `labs/sva_advanced/lab1_data_integrity`.
    - **Setup:** The lab provides a simple memory model DUT. The testbench issues a write followed by a read.
    - **Challenge:** The user must write a single concurrent assertion that verifies that the data returned by the `read` operation is the same as the data sent in the preceding `write` operation to the same address. This will require using local variables in a sequence to store the address and data from the write cycle.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-SV-4-SPLIT` | `todo` | Split the SVA lesson into "Fundamentals" (4A) and "Advanced" (4B). | - The existing `I-SV-4` directory is renamed to `I-SV-4A_SVA_Fundamentals`.<br>- A new directory `I-SV-4B_Advanced_Temporal_Logic` is created.<br>- Content is refactored and moved to the new lesson structures. |
| `CURR-I-SV-4A-LORE` | `todo` | Modernize the SVA Fundamentals lesson with specific LRM references. | - All concepts are cross-referenced to IEEE 1800-2023 (Clauses 16, 17).<br>- The footer LRM reference is updated.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-I-SV-4B-VISUAL` | `todo` | Create/enhance the temporal logic visual and write the Advanced SVA lesson. | - The `TemporalLogicExplorer.tsx` component is built/enhanced and embedded in the `I-SV-4B` lesson.<br>- The lesson content for advanced SVA topics is written and explains the visual. |
| `CURR-I-SV-4B-LAB` | `todo` | Create the "Data Integrity Challenge" lab. | - The `labs/sva_advanced/lab1_data_integrity` is created with a `README`, DUT, and testbench.<br>- The lab is embedded and explained in the `I-SV-4B` lesson. |
| `CURR-I-SV-4-REVIEW` | `todo` | Review both new SVA lessons and update site navigation. | - Both lessons are reviewed for accuracy.<br>- The curriculum's `_category_.json` is updated for the new two-part structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `TemporalLogicExplorer` component.<br>- **E2E Tests:** Add a Playwright test for the new `I-SV-4B` lesson page.<br>- All internal links are verified. |

---

### Task: Modernize "A-UVM-4: The UVM Register Abstraction Layer (RAL)"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-SPLIT-A-UVM-4` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** A-UVM-4: The UVM Register Abstraction Layer (RAL)
- **Path:** `content/curriculum/T3_Advanced/A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL/index.mdx`
- **UVM LRM clauses:** Appendix F (Register Layer)

#### 1. Proposed Split & Objectives
The topic is substantial and should be split into two lessons:

**A) A-UVM-4A: RAL Fundamentals**
- **Objectives:**
  - Describe the roles of `uvm_reg_block`, `uvm_reg`, `uvm_reg_field`, and `uvm_reg_map` (per UVM LRM Appendix F).
  - Implement a `uvm_reg_adapter` to connect a RAL model to a bus agent.
  - Execute basic front-door `read()` and `write()` operations from a `uvm_sequence`.
  - Generate a RAL model from a simple specification file.

**B) A-UVM-4B: Advanced RAL Techniques**
- **Objectives:**
  - Explain the register prediction mechanism and the roles of the `uvm_reg_predictor` and bus monitor.
  - Implement both front-door and backdoor register accesses and describe the trade-offs.
  - Use built-in RAL sequences like `uvm_reg_bit_bash_seq`.
  - Debug a failing test where the RAL model's mirrored value is out of sync with the DUT.

#### 2. Content Accuracy Gaps (LRM References)
- **LRM Grounding:** Explicitly cite clauses from UVM LRM Appendix F for all RAL classes (`uvm_reg`, `uvm_reg_adapter`, etc.) to give the definitions authority.
- **Prediction Deep Dive:** The concept of "mirroring" should be expanded into a detailed explanation of the prediction flow: the bus monitor captures a transaction, the predictor uses the adapter to convert it to a `uvm_reg_bus_op`, and the register model is updated. This is a critical and often misunderstood concept.

#### 3. Visual & Gamification Enhancements
- **Interactive Visual (for 4A):** Create a new component `RALHierarchy.tsx`. It will be a clickable diagram showing the RAL object hierarchy. When a user clicks `uvm_reg_block`, `uvm_reg_map`, or `uvm_reg_adapter`, it highlights the component and displays a tooltip with its role and a link to the relevant LRM section.
- **Gamified Lab (for 4B):**
    - **Title:** "The Mirror Bug Lab"
    - **Goal:** Create a new lab `labs/ral_advanced/lab1_mirror_bug`.
    - **Setup:** The lab provides a UVM environment where the bus monitor has a bug (e.g., it incorrectly captures read data).
    - **Challenge:** The user runs a test that fails a `ral_model.mirror()` check. They must use their knowledge of the prediction path to debug the monitor, fix it, and make the test pass.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-A-UVM-4-SPLIT` | `todo` | Split the RAL lesson into "Fundamentals" (4A) and "Advanced" (4B). | - The existing `A-UVM-4` directory is renamed to `A-UVM-4A_RAL_Fundamentals`.<br>- A new directory `A-UVM-4B_Advanced_RAL_Techniques` is created with a placeholder `index.mdx`.<br>- Content from the original lesson is moved and divided appropriately between the two new files. |
| `CURR-A-UVM-4A-LORE` | `todo` | Integrate LRM references and add the interactive visual to the Fundamentals lesson. | - The `RALHierarchy.tsx` component is built and embedded.<br>- All RAL classes mentioned are cross-referenced to UVM LRM Appendix F.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-A-UVM-4B-LAB` | `todo` | Create the "Mirror Bug Lab" and write the Advanced RAL lesson content. | - The `labs/ral_advanced/lab1_mirror_bug` is created with a `README`, buggy code, and a solution.<br>- The `A-UVM-4B` `index.mdx` is written, focusing on prediction, backdoor access, and built-in sequences.<br>- The lesson embeds and explains the lab. |
| `CURR-A-UVM-4-REVIEW` | `todo` | Review both new RAL lessons and update navigation/linking. | - Both lessons are reviewed for accuracy and clarity.<br>- The curriculum's `_category_.json` is updated to reflect the new two-part lesson structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `RALHierarchy` component.<br>- **E2E Tests:** Add a Playwright test for the new `A-UVM-4B` lesson page.<br>- All internal links are verified. |

---

### Task: Deprecate "F3: Procedural Constructs" and Merge Content

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-F3` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** F3: Procedural Constructs
- **Path:** `content/curriculum/T1_Foundational/F3_Procedural_Constructs/index.mdx`
- **SystemVerilog LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate and Merge

The content in this lesson is highly redundant with the material in `F2: SystemVerilog Language Basics`. As part of the modernization of `F2`, it was proposed to split it into four new, focused lessons. This `F3` lesson should be deprecated, and its unique assets and explanations merged into those new lessons.

**Merge Plan:**
- The core concepts (`initial`, `always`, blocking/non-blocking, flow control) will be covered by the new **`F2C: Procedural Code and Flow Control`** lesson.
- The `fork-join` content will be moved to the new **`F2D: Reusable Code and Parallelism`** lesson.
- The excellent `ProceduralBlocksSimulator` component should be moved from `F3` and embedded into the new `F2C` lesson to explain blocking vs. non-blocking assignments.
- The `F3_Behavioral_RTL_Modeling` file, which already redirects here, should be updated to point to the new `F2C` lesson.

#### 2. Rationale
- **Reduces Redundancy:** Eliminates significant content overlap between `F2` and `F3`.
- **Improves Learning Flow:** Creates a more logical and granular learning path where students learn about data types first, then how to manipulate them with procedural code.
- **Consolidates Assets:** Moves the high-value `ProceduralBlocksSimulator` visual to the most relevant new lesson.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-F3-MERGE` | `todo` | Merge content from F3 into the new F2A-F2D lessons. | - The `ProceduralBlocksSimulator` component is moved from the `F3` directory/lesson and integrated into the new `F2C` lesson.<br>- Any unique explanations or examples from `F3` are migrated into the appropriate `F2C` or `F2D` lesson files.<br>- The `F3_Procedural_Constructs` directory and its `index.mdx` file are deleted. |
| `CURR-F3-REDIRECT` | `todo` | Update redirects to point to the new consolidated lesson. | - The redirect in `content/curriculum/T1_Foundational/F3_Behavioral_RTL_Modeling/index.mdx` is updated to point to `/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/`.<br>- A new redirect is added from the old `F3` path to the new `F2C` path in `next.config.mjs` to preserve any external links. |
| `CURR-F3-REVIEW` | `todo` | Review all related lessons and navigation. | - The curriculum's `_category_.json` file is updated to remove the `F3` lesson.<br>- The `F2` lessons are reviewed to ensure the merged content is well-integrated.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `F3` URL correctly redirects to the new `F2C` URL.<br>- All internal links are verified. |

---

### Task: Deprecate "I-UVM-4: UVM Factory and Overrides" and Merge Content

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-I-UVM-4` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-UVM-4: UVM Factory and Overrides
- **Path:** `content/curriculum/T2_Intermediate/I-UVM-4_Factory_and_Overrides/index.mdx`
- **UVM LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate and Merge

The content in this lesson is entirely redundant with the factory-related material in `I-UVM-1: UVM Introduction`. As part of the modernization of `I-UVM-1`, it was proposed to create a new, dedicated lesson: **`I-UVM-1B: The UVM Factory`**. This `I-UVM-4` lesson should be deprecated, and its content merged into that new lesson.

**Merge Plan:**
- Any unique examples, explanations, or quiz questions from `I-UVM-4` should be migrated into the new `I-UVM-1B` lesson file.
- The `I-UVM-4_Factory_and_Overrides` directory and its `index.mdx` file should be deleted.
- A redirect should be added from the old `I-UVM-4` path to the new `I-UVM-1B` path to preserve any external links.

#### 2. Rationale
- **Eliminates Redundancy:** Prevents having two separate lessons on the exact same topic (the UVM factory).
- **Improves Learning Path:** Creates a single, clear, authoritative lesson on the factory within the introductory UVM module, which is the most logical place for it.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-UVM-4-MERGE` | `todo` | Merge content from I-UVM-4 into the new I-UVM-1B lesson. | - Unique examples and quiz questions from `I-UVM-4` are identified and moved into the `I-UVM-1B` lesson file.<br>- The `I-UVM-4_Factory_and_Overrides` directory is deleted. |
| `CURR-I-UVM-4-REDIRECT` | `todo` | Add a redirect from the old I-UVM-4 path to the new I-UVM-1B path. | - A redirect is added to `next.config.mjs` for the old path.<br>- The curriculum's `_category_.json` file is updated to remove the `I-UVM-4` lesson. |
| `CURR-I-UVM-4-REVIEW` | `todo` | Review the consolidated factory lesson (I-UVM-1B). | - The `I-UVM-1B` lesson is reviewed to ensure the merged content is well-integrated and there are no contradictions.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `I-UVM-4` URL correctly redirects to the new `I-UVM-1B` URL.<br>- All internal links are verified. |

---

### Task: Deprecate "I-UVM-5: UVM Phasing and Synchronization" and Merge Content

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-I-UVM-5` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** I-UVM-5: UVM Phasing and Synchronization
- **Path:** `content/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization/index.mdx`
- **UVM LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate and Merge

The content in this lesson is entirely redundant with the phasing-related material in `I-UVM-1: UVM Introduction`. As part of the modernization of `I-UVM-1`, it was proposed to create a new, dedicated lesson: **`I-UVM-1C: UVM Phasing`**. This `I-UVM-5` lesson should be deprecated, and its content merged into that new lesson.

**Merge Plan:**
- Any unique examples, explanations, or quiz questions from `I-UVM-5` should be migrated into the new `I-UVM-1C` lesson file.
- The `UvmPhasingDiagram` component from this lesson should be used as the primary visual for the new `I-UVM-1C` lesson.
- The `I-UVM-5_Phasing_and_Synchronization` directory and its `index.mdx` file should be deleted.
- A redirect should be added from the old `I-UVM-5` path to the new `I-UVM-1C` path to preserve any external links.

#### 2. Rationale
- **Eliminates Redundancy:** Prevents having two separate lessons on the exact same topic (UVM phasing).
- **Improves Learning Path:** Creates a single, clear, authoritative lesson on phasing within the introductory UVM module.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-I-UVM-5-MERGE` | `todo` | Merge content from I-UVM-5 into the new I-UVM-1C lesson. | - Unique examples and quiz questions from `I-UVM-5` are identified and moved into the `I-UVM-1C` lesson file.<br>- The `I-UVM-5_Phasing_and_Synchronization` directory is deleted. |
| `CURR-I-UVM-5-REDIRECT` | `todo` | Add a redirect from the old I-UVM-5 path to the new I-UVM-1C path. | - A redirect is added to `next.config.mjs` for the old path.<br>- The curriculum's `_category_.json` file is updated to remove the `I-UVM-5` lesson. |
| `CURR-I-UVM-5-REVIEW` | `todo` | Review the consolidated phasing lesson (I-UVM-1C). | - The `I-UVM-1C` lesson is reviewed to ensure the merged content is well-integrated and there are no contradictions.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `I-UVM-5` URL correctly redirects to the new `I-UVM-1C` URL.<br>- All internal links are verified. |

---

### Task: Deprecate "A-UVM-1: Advanced UVM Sequencing" and Merge Content

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-A-UVM-1` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** A-UVM-1: Advanced UVM Sequencing
- **Path:** `content/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index.mdx`
- **UVM LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate and Merge

The content in this lesson directly covers the topics planned for the proposed **`I-UVM-3B: Advanced Sequencing and Layering`** lesson, which was created by splitting the basic `I-UVM-3` sequences lesson. This `A-UVM-1` lesson should be deprecated, and its content used as the primary source material for the new `I-UVM-3B` lesson.

**Merge Plan:**
- The content on virtual sequences, arbitration (`lock`/`grab`), and sequence layering from `A-UVM-1` will form the body of the new `I-UVM-3B` lesson.
- The `A-UVM-1_Advanced_Sequencing` directory and its `index.mdx` file should be deleted.
- A redirect should be added from the old `A-UVM-1` path to the new `I-UVM-3B` path to preserve any external links.

#### 2. Rationale
- **Consolidates Learning Path:** Creates a single, two-part module for UVM sequences (`I-UVM-3A` and `I-UVM-3B`), taking the learner from fundamentals to advanced topics in a logical progression.
- **Reduces Fragmentation:** Avoids having introductory and advanced topics for the same feature in different tiers of the curriculum (Intermediate vs. Advanced).

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-A-UVM-1-MERGE` | `todo` | Merge content from A-UVM-1 into the new I-UVM-3B lesson. | - The content from `A-UVM-1/index.mdx` is moved to `I-UVM-3B_Advanced_Sequencing/index.mdx`.<br>- The `A-UVM-1_Advanced_Sequencing` directory is deleted. |
| `CURR-A-UVM-1-REDIRECT` | `todo` | Add a redirect from the old A-UVM-1 path to the new I-UVM-3B path. | - A redirect is added to `next.config.mjs` for the old path.<br>- The curriculum's `_category_.json` file for the T3_Advanced tier is updated to remove the `A-UVM-1` lesson. |
| `CURR-A-UVM-1-REVIEW` | `todo` | Review the consolidated advanced sequencing lesson (I-UVM-3B). | - The `I-UVM-3B` lesson is reviewed to ensure the merged content is well-integrated with the `I-UVM-3A` lesson and that all enhancement tasks (visuals, lab) are still applicable.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `A-UVM-1` URL correctly redirects to the new `I-UVM-3B` URL.<br>- All internal links are verified. |

---

### Task: Deprecate "A-UVM-2: The UVM Factory In-Depth" and Merge Content

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-A-UVM-2` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** A-UVM-2: The UVM Factory In-Depth
- **Path:** `content/curriculum/T3_Advanced/A-UVM-2_The_UVM_Factory_In-Depth/index.mdx`
- **UVM LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate and Merge

This is the third lesson covering the UVM Factory, creating a fragmented and redundant learning path. The content in this lesson should be merged into the single, authoritative factory lesson proposed earlier: **`I-UVM-1B: The UVM Factory`**. 

**Merge Plan:**
- The more advanced examples, the "accuracy toolkit" table, and any unique explanations from `A-UVM-2` should be migrated into the new `I-UVM-1B` lesson file to enrich it.
- The `A-UVM-2_The_UVM_Factory_In-Depth` directory and its `index.mdx` file should be deleted.
- A redirect should be added from the old `A-UVM-2` path to the new `I-UVM-1B` path.

#### 2. Rationale
- **Consolidates Learning:** Creates a single, comprehensive lesson on the UVM factory, preventing student confusion and improving the curriculum structure.
- **Enriches Content:** Uses the "in-depth" material from this lesson to make the single, consolidated lesson more valuable.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-A-UVM-2-MERGE` | `todo` | Merge content from A-UVM-2 into the new I-UVM-1B lesson. | - Unique examples and the "accuracy toolkit" from `A-UVM-2` are identified and moved into the `I-UVM-1B` lesson file.<br>- The `A-UVM-2_The_UVM_Factory_In-Depth` directory is deleted. |
| `CURR-A-UVM-2-REDIRECT` | `todo` | Add a redirect from the old A-UVM-2 path to the new I-UVM-1B path. | - A redirect is added to `next.config.mjs` for the old path.<br>- The curriculum's `_category_.json` file for the T3_Advanced tier is updated to remove the `A-UVM-2` lesson. |
| `CURR-A-UVM-2-REVIEW` | `todo` | Review the consolidated factory lesson (I-UVM-1B). | - The `I-UVM-1B` lesson is reviewed to ensure the merged "in-depth" content is well-integrated.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `A-UVM-2` URL correctly redirects to the new `I-UVM-1B` URL.<br>- All internal links are verified. |

---

### Task: Deprecate "A-UVM-3: Advanced UVM Techniques" and Create New Callbacks Lesson

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-REFACTOR-A-UVM-3` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** A-UVM-3: Advanced UVM Techniques & Strategy
- **Path:** `content/curriculum/T3_Advanced/A-UVM-3_Advanced_UVM_Techniques/index.mdx`
- **UVM LRM clauses:** N/A (This is a refactoring task)

#### 1. Proposed Action: Deprecate, Merge, and Create

This lesson is a high-level summary of other advanced topics, creating redundancy. It should be deprecated. Its content on RAL and virtual sequences should be merged into the already-proposed lessons (`A-UVM-4A/B` and `I-UVM-3B`). The brief mention of **callbacks** should be expanded into its own new, dedicated lesson, as it's a critical advanced UVM topic.

**Merge & Create Plan:**
- The RAL and virtual sequence examples from `A-UVM-3` will be used as source material for the new `A-UVM-4A/B` and `I-UVM-3B` lessons.
- A new lesson, **`A-UVM-5: UVM Callbacks`**, will be created to provide a deep dive into the callback mechanism.
- The `A-UVM-3` directory will be deleted and a redirect added.

#### 2. Rationale
- **Reduces Redundancy:** Eliminates a summary lesson in favor of detailed, focused lessons on each topic.
- **Fills a Gap:** Creates a much-needed, dedicated lesson on UVM callbacks, a powerful and often misunderstood feature.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-A-UVM-3-MERGE` | `todo` | Merge content from A-UVM-3 into other advanced lessons. | - RAL and virtual sequence examples from `A-UVM-3` are moved to the appropriate new lesson files (`A-UVM-4A/B`, `I-UVM-3B`).<br>- The `A-UVM-3` directory is deleted. |
| `CURR-A-UVM-3-REDIRECT` | `todo` | Add a redirect from the old A-UVM-3 path. | - A redirect is added to `next.config.mjs` for the old path to an appropriate new lesson (e.g., the virtual sequences lesson). |
| `CURR-A-UVM-5-CREATE` | `todo` | Create a new lesson on UVM Callbacks. | - A new directory `A-UVM-5_UVM_Callbacks` is created with an `index.mdx` file.<br>- The lesson explains `uvm_callback`, the `uvm_register_cb` macro, and how to add/delete callbacks.<br>- The lesson includes a lab where a user adds a callback to a driver to inject an error without subclassing. |
| `CURR-A-UVM-3-REVIEW` | `todo` | Review all related lessons and navigation. | - The curriculum's `_category_.json` file is updated to remove `A-UVM-3` and add `A-UVM-5`.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `A-UVM-3` URL correctly redirects.<br>- All internal links are verified. |

---

### Task: Modernize "E-PERF-1: UVM Performance"

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the row with the Task ID `CURR-MODERNIZE-E-PERF-1` and changing its status from `todo` to `complete`.

- **Status:** `todo`
- **Lesson:** E-PERF-1: UVM Performance
- **Path:** `content/curriculum/T4_Expert/E-PERF-1_UVM_Performance/index.mdx`
- **SystemVerilog LRM clauses:** 4 (Scheduling semantics), 9 (Events), 15 (Processes), 21.2 (dumpvars)
- **UVM LRM clauses:** 4.4 (Phasing), 6 (Reporting), 9 (TLM), Annex C.2 (uvm_tlm_analysis_fifo)

#### 1. Proposed Split & Objectives
No split is required. The existing structure is logical. The learning objectives should be updated to include grounding the techniques in LRM principles.

**New Learning Objectives:**
- Profile a UVM testbench to identify performance hotspots in component communication, data processing, and reporting.
- Apply architectural patterns like TLM FIFOs and configuration modes to improve simulation throughput, referencing relevant UVM LRM clauses.
- Explain how SystemVerilog's scheduling and process execution (per IEEE 1800-2023) influence UVM performance.
- Implement a hands-on lab to refactor a slow testbench and validate performance gains.

#### 2. Content Accuracy Gaps (LRM References)
- **Inject LRM References:** The lesson should be updated to include formal definitions for key terms, establishing a precedent for LRM-backed learning.
  - When introducing the DUT, add a note defining a "design" as per **IEEE 1800-2023, Clause 3.6**.
  - When introducing the testbench, add a note defining a "testbench" (or test program) as per **IEEE 1800-2023, Clause 3.13**.

#### 3. Visual & Gamification Enhancements
- **New Interactive Visual:** Create a D3-based component (`SVEventScheduler.tsx`) that visualizes the SystemVerilog event regions (Active, Inactive, NBA, etc.). Animate how a blocking call stalls a process versus how a non-blocking call allows other processes to proceed, demonstrating the core principle behind decoupling with FIFOs.
- **New Gamified Lab:**
    - **Title:** "The Bottleneck Lab"
    - **Goal:** Provide a new lab (`labs/uvm_performance/lab1_bottleneck`) containing a simple UVM testbench with an intentionally slow scoreboard (e.g., using a nested loop search).
    - **Challenge:** The user must profile the testbench, identify the scoreboard as the hotspot, and refactor it using an associative array or queue for faster lookups. A second step will be to decouple the monitor and scoreboard with a `uvm_tlm_analysis_fifo`.
    - **Success Metric:** The lab will include a simple script to measure simulation time. The user "wins" by reducing the runtime by at least 50%.

#### 4. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-E-PERF-1-LORE` | `todo` | Integrate LRM references into the E-PERF-1 lesson content. | - MDX is updated to cite relevant IEEE 1800-2023 and UVM LRM clauses for key performance recommendations.<br>- Text explains *why* techniques work based on scheduler and TLM behavior.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-E-PERF-1-VISUAL` | `todo` | Create and embed an interactive SV Event Scheduler visualization. | - A new React component `SVEventScheduler.tsx` is created in `src/components/visuals`.<br>- The component is embedded in the E-PERF-1 `index.mdx` file.<br>- The visualization is keyboard-navigable and has appropriate ARIA labels. |
| `CURR-E-PERF-1-LAB` | `todo` | Create the new "Bottleneck Lab" for UVM performance. | - A new lab is created at `labs/uvm_performance/lab1_bottleneck`.<br>- The lab includes a `README.md` with instructions, a slow testbench, and a solution.<br>- A simple `make profile` or `run.sh --profile` target is included to demonstrate the bottleneck. |
| `CURR-E-PERF-1-REVIEW` | `todo` | Update learning objectives and review the modernized lesson. | - The lesson's frontmatter and intro are updated with the new objectives.<br>- All changes are reviewed for technical accuracy and adherence to the site's tone.<br>- **Unit Tests:** Add a Vitest unit test for the new `SVEventScheduler` component.<br>- **E2E Tests:** Add a Playwright test for the E-PERF-1 page that verifies the interactive component loads.<br>- All internal links are checked. |
