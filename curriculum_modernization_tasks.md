# Curriculum Modernization Tasks

This file contains a series of prompts for a coding agent to modernize the curriculum lessons based on the SystemVerilog and UVM Language Reference Manuals. The tasks are ordered logically: prerequisite split work comes first, followed by deprecation/merge clean-up, and finally content modernization.

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
| `CURR-A-UVM-4-SPLIT` | `complete ✅` | Split the RAL lesson into "Fundamentals" (4A) and "Advanced" (4B). | - The existing `A-UVM-4` directory is renamed to `A-UVM-4A_RAL_Fundamentals`.<br>- A new directory `A-UVM-4B_Advanced_RAL_Techniques` is created with a placeholder `index.mdx`.<br>- Content from the original lesson is moved and divided appropriately between the two new files. |
| `CURR-A-UVM-4A-LORE` | `todo` | Integrate LRM references and add the interactive visual to the Fundamentals lesson. | - The `RALHierarchy.tsx` component is built and embedded.<br>- All RAL classes mentioned are cross-referenced to UVM LRM Appendix F.<br>- `npm run lint` and `npm run test` pass. |
| `CURR-A-UVM-4B-LAB` | `todo` | Create the "Mirror Bug Lab" and write the Advanced RAL lesson content. | - The `labs/ral_advanced/lab1_mirror_bug` is created with a `README`, buggy code, and a solution.<br>- The `A-UVM-4B` `index.mdx` is written, focusing on prediction, backdoor access, and built-in sequences.<br>- The lesson embeds and explains the lab. |
| `CURR-A-UVM-4-REVIEW` | `todo` | Review both new RAL lessons and update navigation/linking. | - Both lessons are reviewed for accuracy and clarity.<br>- The curriculum's `_category_.json` is updated to reflect the new two-part lesson structure.<br>- **Unit Tests:** Add a Vitest unit test for the new `RALHierarchy` component.<br>- **E2E Tests:** Add a Playwright test for the new `A-UVM-4B` lesson page.<br>- All internal links are verified. |

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
| `CURR-A-UVM-3-MERGE` | `complete ✅` | Merge content from A-UVM-3 into other advanced lessons. | - RAL and virtual sequence examples from `A-UVM-3` are moved to the appropriate new lesson files (`A-UVM-4A/B`, `I-UVM-3B`).<br>- The `A-UVM-3` directory is deleted. |
| `CURR-A-UVM-3-REDIRECT` | `complete ✅` | Add a redirect from the old A-UVM-3 path. | - A redirect is added to `next.config.mjs` for the old path to an appropriate new lesson (e.g., the virtual sequences lesson). |
| `CURR-A-UVM-5-CREATE` | `todo` | Create a new lesson on UVM Callbacks. | - A new directory `A-UVM-5_UVM_Callbacks` is created with an `index.mdx` file.<br>- The lesson explains `uvm_callback`, the `uvm_register_cb` macro, and how to add/delete callbacks.<br>- The lesson includes a lab where a user adds a callback to a driver to inject an error without subclassing. |
| `CURR-A-UVM-3-REVIEW` | `todo` | Review all related lessons and navigation. | - The curriculum's `_category_.json` file is updated to remove `A-UVM-3` and add `A-UVM-5`.<br>- **Unit Tests:** N/A for this refactoring.<br>- **E2E Tests:** Verify that the old `A-UVM-3` URL correctly redirects.<br>- All internal links are verified. |

---

### Task: Modernize Intermediate Fill-Ins (I-SV-5, I-UVM-2C)

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the corresponding W6 rows and changing their status from `todo` to `complete`.

- **Status:** `todo`
- **Lessons:** I-SV-5: Synchronization and IPC, I-UVM-2C: Configuration and Resources

#### 1. Proposed Action & Objectives
While these modules have content, they lack the interactive depth of other T2 modules.

**I-SV-5:**
- `MailboxSemaphoreGame.tsx` is currently misfiled under the F2 tier. It should be moved and embedded deeply into `I-SV-5_Synchronization_and_IPC/index.mdx` or its subpages.
- Needs a dedicated lab dealing with deadlocks and race conditions.

**I-UVM-2C:**
- Needs strict LRM references added.
- Needs a new visualizer showing the tree structure of `uvm_config_db`.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-W6-ISV5` | `todo` | Complete modernization of I-SV-5. | - Move `MailboxSemaphoreGame.tsx` embed to 'I-SV-5'.<br>- Build a Synchronization Deadlock lab and embed it.<br>- LRM 1800-2023 anchoring. |
| `CURR-W6-IUVM2C` | `todo` | Complete modernization of I-UVM-2C. | - Build `ConfigDbExplorer.tsx`.<br>- Build a Null Virtual Interface debugging lab.<br>- UVM LRM Clause 23 anchoring. |

---

### Task: Modernize T4 Expert Modules

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the corresponding W6 rows and changing their status from `todo` to `complete`.

- **Status:** `todo`
- **Lessons:** E-CUST-1, E-DBG-1, E-INT-1, E-SOC-1

#### 1. Proposed Action & Objectives
Bring all Expert-tier lessons up to the new "Definition of Done". They currently read like conceptual brain-dumps rather than pedagogical tracks because they entirely lack interactive components, runnable labs, and interview pitfalls.

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-W6-ECUST1` | `todo` | Modernize Methodology Customization. | - Build `MethodologyPhaseVisualizer.tsx`.<br>- Create lab: Inject custom phase into UVM schedule. |
| `CURR-W6-EDBG1` | `todo` | Modernize Debug Methodologies. | - Build `TelemetryEventBusVisualizer.tsx`.<br>- Create lab: Waveform trigger via UVM event bus. |
| `CURR-W6-EINT1` | `todo` | Modernize Formal Integration. | - Build `FormalVsSimulationVisualizer.tsx`.<br>- Create lab: Constrained random sequence to formal assumption translation. |
| `CURR-W6-ESOC1` | `todo` | Modernize SoC Strategies. | - Build `VIPReuseVisualizer.tsx`.<br>- Create lab: SoC Bring-up with passive/active agents. |

---

### Task: Address Missing SV/UVM LRM Clauses (Wave 7)

**Agent Instructions:**
1.  Upon completing all sub-tasks in the `Task Backlog Entries` table, update the status of this task from `todo` to `complete ✅` in this file.
2.  You must also update the master `TASKS.md` file by finding the corresponding W7 rows and changing their status from `todo` to `complete`.

- **Status:** `todo`
- **Lessons:** New lessons for SV Clauses 17, 22, 27, 35-41 and UVM Clauses 7, 11, 16.

#### 1. Proposed Action & Objectives
The `comprehensive_lrm_audit_report.md` identified several critical SV and UVM clauses that are either entirely missing or too shallow for workplace readiness.

**SystemVerilog Additions:**
- Create `I-SV-4C` for SV Checkers (Clause 17).
- Create `I-SV-6` for Compiler Directives and Generates (Clauses 22, 27).
- Expand DPI/VPI coverage into a production-grade guide (Clauses 35-41).

**UVM Additions:**
- Create lessons for Policy Classes (Clause 16), Container Classes (Clause 11), and Recording Classes (Clause 7).

#### 3. Task Backlog Entries

| Task ID | Status | Summary | Acceptance Criteria |
|---|---|---|---|
| `CURR-W7-ISV-CHECKERS` | `todo` | Treat SV Checkers as a first-class topic. | - Build `I-SV-4C` with interactive SVA integration examples. |
| `CURR-W7-ISV-DIRECTIVES` | `todo` | Address Directives and Generates. | - Build interactive visualizer for `generate` vs runtime `if`. |
| `CURR-W7-ISV-API` | `todo` | Expand DPI/VPI coverage. | - Include C++ marshaling and memory boundary pitfalls. |
| `CURR-W7-IUVM-POLICY` | `todo` | Teach Policy Classes. | - Build `UvmPolicyVisualizer.tsx`. |
| `CURR-W7-IUVM-CONTAINER`| `todo` | Teach Container Classes. | - Lab contrasting UVM containers with native SV associative arrays. |
| `CURR-W7-IUVM-RECORDING`| `todo` | Teach Recording Classes. | - Integrate with `debug_event_bus` concept. |
