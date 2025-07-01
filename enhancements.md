# Planned Enhancements

This file tracks planned enhancements and future improvements for the SystemVerilog & UVM Mastery Guide website.

## InteractiveCode Component (Task 3.5 Follow-ups)

*   **Robust Target Parsing:**
    *   Support for multiple comma-separated line numbers and ranges (e.g., "1,3,5-7,10").
    *   Consider regex-based or string-matcher-based block highlighting for targeting code sections that aren't just contiguous lines (e.g., highlighting a specific `always` block or `class` definition).
*   **Auto-Scrolling:** Implement auto-scrolling within the `CodeBlock` to ensure the currently highlighted lines are always in view. This might involve passing a ref to `CodeBlock` or using DOM manipulation.
*   **Highlight Styling:** Offer more sophisticated styling options for highlighted lines/blocks beyond a simple background color.
*   **CodeBlock Collaboration:** Investigate if `CodeBlock` component needs modifications to better support line-based props or styling from `InteractiveCode` (e.g., more granular control over line rendering, padding adjustments).
*   **Accessibility:** Ensure keyboard navigation for steps is fully accessible and ARIA attributes are appropriate.
*   **State Management:** For very long walkthroughs, consider if the state management for current step needs to be more robust (e.g., URL-based state for shareability).

## Additional Key Examples for InteractiveCode

*   **SystemVerilog Assertions (SVA):** Walk through a complex SVA property, explaining sequences, operators, and assertion directives. (e.g., from `sva/page.tsx`)
*   **Functional Coverage (`covergroup`):** Explain the parts of a `covergroup`, including `coverpoints`, `bins`, and `crosses`. (e.g., from `functional-coverage/page.tsx`)
*   **UVM Factory Override:** Demonstrate how `set_type_override_by_type` works with a base class and a derived class. (e.g., from `uvm-factory/page.tsx`)
*   **RAL (Register Abstraction Layer) Access:** Show an example of RAL model usage in a sequence for register read/write. (e.g., from `ral/page.tsx`)

## Gamified Learning Exercises (Task 3.3 Follow-ups)

*   **General:**
    *   Implement scoring logic for all exercises.
    *   Implement robust feedback mechanisms (correct/incorrect, hints).
    *   Implement "Retry" functionality.
    *   Full Firestore integration for saving and displaying scores/progress.
    *   Add "satisfying animations" and polish UI for all exercises.
*   **UVM Agent Builder:**
    *   Implement validation logic for correct component placement.
    *   Provide feedback on incorrect placements.
*   **UVM Phase Sorter:**
    *   Implement validation for correct phase order.
    *   Add more engaging animations for sorting and feedback.
*   **Scoreboard Connector:**
    *   Implement validation for correct port connections (e.g., `analysis_port` to `analysis_imp`).
    *   Handle different port types and connection rules.
    *   Improve line drawing visuals and interaction (e.g., drag to draw).

## FlashcardWidget (Task 3.2 Follow-ups)

*   **Full Firestore Integration:**
    *   Implement loading `initialCardIndex` from Firestore per user per topic.
    *   Ensure `onProgressUpdate` correctly saves to Firestore.
    *   Handle cases where user has no progress yet.
*   **Content Population:** Systematically extract and format flashcard data for all relevant topic pages from the `SYSTEMVERILOG_UVM_BLUEPRINT.md`.

## General UI/UX

*   **Responsiveness:** Thoroughly test and improve responsiveness across all new components and pages.
*   **Accessibility (a11y):** Conduct an accessibility audit and implement improvements.
*   **Theming:** Ensure all new components correctly adapt to light/dark themes.

## SEO & Metadata (Task 4.2 Follow-ups)

*   **Dynamic Data for Metadata:** Ensure all dynamic page titles and meta descriptions are correctly populated from the blueprint or content for *all* pages, not just topic pages.
*   **Structured Data:** Consider adding structured data (JSON-LD) for courses, articles, etc., to improve search engine understanding.

## Content Cross-Linking (Task 4.1 Follow-ups)

*   **Automated Suggestions:** Explore possibilities for tools or scripts to suggest potential internal links based on keywords in the blueprint.
*   **Visual Link Map:** Consider a visual tool to represent the link structure for review.

## Editorial and Visual Consistency (Task 4.3 Follow-ups)

*   **Automated Checks:** Where possible, implement automated checks for terminology (e.g., using a custom dictionary with linters).
*   **Comprehensive Review Process:** Establish a multi-pass review process for content and visuals before "launch".
