# Curriculum Audit Feedback & Strategy

## Brutal Fresh Eyes Analysis

### 1. Architectural & Structural Issues
*   **Dangling Legacy Content:** The `F2_Data_Types_and_Structures` directory remains in `content/curriculum/T1_Foundational/` alongside the newly created `F2A`, `F2B`, and `F2C` folders. This creates redundant entries in the generated `curriculum-data.tsx` and confuses the learning path. It must be permanently removed and any lingering references fixed.
*   **Inconsistent Granularity:** While T1 (Foundational) has been nicely chunked into A/B/C sub-modules (e.g., F1A, F3C, F4B), the Intermediate (T2), Advanced (T3), and Expert (T4) tiers are still structured as massive, monolithic blocks (e.g., `I-SV-2_Constrained_Randomization` has 4 dense topics). This violates the micro-learning philosophy established in T1.

### 2. Pedagogy & "Interview/Workplace Readiness"
*   **Lack of Interview Focus:** Real-world verification engineers are tested heavily on edge cases (e.g., `fork-join_none` scoping bugs, soft constraint failures, polymorphism gotchas). While the text covers these, there is a lack of dedicated, interactive "Interview Prep" components. Every module needs a "Common Interview Pitfalls" interactive section.
*   **Too Much Reading, Not Enough Doing:** T2 and T3 cover complex topics like UVM Phasing and Factory overrides. Text is not enough. We need Framer Motion or interactive React playgrounds for:
    *   **Constraint Solver Visualizer:** Let the user tweak constraints in real-time and see valid solution spaces.
    *   **UVM Phase Flow Animator:** A visual, step-by-step executor showing how `build_phase` cascades top-down while `run_phase` executes in parallel.
    *   **Polymorphism/Factory Interactive Demo:** A sandbox to show how `set_type_override` changes what an agent instantiates.

### 3. Aesthetics & Performance
*   **Visual Monotony:** The current Markdown+MDX setup is clean but risks becoming a wall of text. We must inject high-quality, modern aesthetics:
    *   Use animated, interactive diagrams instead of static Mermaid blocks where possible.
    *   Ensure all interactive components (like `QueueOperationLab`) have premium styling, smooth transitions, and clear error states.
*   **Performance:** All new complex interactive components MUST use the `'use client'` directive to prevent the Next.js SSR crashes seen in recent rounds.

---

## Action Plan for the Next Agent

1.  **Immediate Cleanup:** Delete `F2_Data_Types_and_Structures` and `F5_Intro_to_OOP_in_SV` (if F5 is migrating to T2) from T1. Regenerate curriculum data and fix any broken links.
2.  **T2 & T3 Modernization:** Begin applying the A/B/C/D split methodology to `I-SV-1_OOP`, `I-SV-2_Constrained_Randomization`, and `I-UVM-1_UVM_Intro`.
3.  **Interview Prep Injection:** Create a new React component `InterviewQuestionPlayground.tsx` that presents tricky SV/UVM questions, allows the user to guess the output, and then visually explains the correct answer. Integrate this into every modernized chapter.
4.  **High-Fidelity Visualizations:** Build at least one "Hero" interactive component for the next modernized module (e.g., a visual Constraint Solver for `I-SV-2`).
