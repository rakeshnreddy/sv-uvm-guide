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
