# Contributing to the SystemVerilog and UVM Learning Platform

First off, thank you for considering contributing. This project is a community effort, and we welcome any and all contributions.

## Project Vision & Pedagogy

Our vision is to be the world's leading open-source, curriculum-based guide for SystemVerilog and UVM. To achieve this, we adhere to five core pedagogical principles:

1.  **Progressive Disclosure:** Content is structured to reveal complexity gradually, preventing cognitive overload.
2.  **Context is King:** We explain *why* a feature exists before explaining *how* it works.
3.  **Code-First:** Every concept is illustrated with a minimal, complete, compilable, and executable code example.
4.  **Why before How:** We emphasize the design rationale behind language features and methodologies.
5.  **Active Learning:** We encourage active participation through labs, exercises, and quizzes.

## Content Structure

All new content should be created as `.mdx` files within the `content/curriculum/` directory. The content is organized into a three-level hierarchy:

1.  **Tier:** The top-level directory, representing a broad level of expertise (e.g., `T1_Foundational`, `T2_Intermediate`).
2.  **Module:** A subdirectory within a tier, representing a specific topic (e.g., `F1_Why_Verification`).
3.  **Topic:** An `.mdx` file within a module, representing a specific sub-topic (e.g., `index.mdx`).

All new content must follow this structure.

## Content Style Guide

*   **Tone:** Authoritative but accessible.
*   **Text Formatting:** Use Markdown for all content.
*   **Code Style:** Follow industry-standard SystemVerilog and UVM formatting conventions.

## Contribution Workflow

1.  **Fork the repository.**
2.  **Create a feature branch.**
3.  **Make your changes.**
4.  **Submit a pull request.**

All pull requests must be linked to an existing issue in the issue tracker.

## Definition of Done

For any new content to be merged, it must meet the following criteria:

*   Content is technically accurate.
*   Includes at least one minimal, complete, compilable, and executable code example.
*   Adheres to the "Why before How" principle.
*   Includes a "Key Takeaways" summary.
*   Has been reviewed and approved by at least one designated SME.
