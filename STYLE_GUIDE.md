# Style Guide

This document provides the authoring conventions for the SystemVerilog & UVM Guide. Follow these guidelines to deliver a consistent, high-quality learning experience.

## Content Formatting

### Topic Structure (required order)
Each curriculum topic must use the following `##` sections in this exact sequence:
1. **Quick Take** – A concise definition, the reason it matters, and where it appears in practice. Embed the analogy (prepend with **The Analogy:**) inside this section.
2. **Build Your Mental Model** – Core mechanics, diagrams, and conceptual framing. Break it down with `###` sub-headings such as `Core Concepts`, `Minimal Example`, and `Common Pitfalls`.
3. **Make It Work** – Step-by-step, runnable walkthrough that applies the concept. Include code or labs plus a short “Before you move on” checklist.
4. **Push Further** – Advanced patterns, performance considerations, or methodology insights that extend the concept.
5. **Practice & Reinforce** – Links to quizzes, flashcards, exercises, labs, or AI prompts. Keep this as bulleted actions.
6. **References & Next Topics** – Cite authoritative resources and point to prerequisite/related modules.

Do not skip sections. If content is not yet available, leave a short placeholder such as `*Coming soon – content under review.*` so learners understand the status.

### Headings
- **H1 (`#`)** is auto-generated; do not add an explicit H1 in MDX files.
- **H2 (`##`)** hosts the template sections above. Avoid custom H2 titles unless explicitly approved.
- **H3 (`###`)** divide a section into logical chunks (e.g., `Simulation Timeline`, `Checklist`).
- **H4 (`####`)** highlight specific examples or edge cases inside an H3 block.

### Text Formatting
- **Bold (`**text**`)** the first occurrence of key terms and all UI labels (e.g., **Run Simulation**).
- **Italics (`*text*`)** for emphasis or when introducing a new term before it becomes a key concept.
- **Inline code (``code``)** for SystemVerilog keywords, file names, CLI commands, and method names.

### Analogies & Examples
- Start analogies with **The Analogy:** in the Quick Take section.
- Introduce runnable examples with **A Simple Example:** or **Deep-Dive Example:** and ensure they compile.
- Pair lengthy explanations with a visual—diagram, chart, animation, or interactive component. Avoid more than four consecutive sentences without a visual break.

### Visual Balance
- Reference `docs/visual-design-guide.md` for glassmorphism cards, color tokens, and motion patterns.
- Use callout components or images to keep sections from feeling text-heavy; aim for one visual per major subsection.
- Clarity comes first—write as many words as needed for full understanding, then break text into digestible chunks with headings, callouts, and visuals so the page stays inviting.
- When visuals are pending, mark the spot with a short placeholder (e.g., `*Visual walkthrough coming soon*`) so designers know what to build.

## Interactive Components
- **`<Quiz>`** – Place after the main explanation (typically in *Practice & Reinforce*).
- **`<Flashcard>` / Flashcard widgets** – Reference the deck ID in front matter and link here.
- **`<DragAndDropExercise>` / bespoke exercises** – Embed when reinforcing procedural knowledge; mention controls and accessibility shortcuts.

## Code Blocks
- Use fenced code blocks with language identifiers (e.g., ```systemverilog, ```bash).
- Provide complete, runnable examples or clearly mark snippets with a comment like `// snippet`.
- For multi-step walkthroughs, pair code with numbered explanations.

## Call-out Components
- **`<Note>`** – Helpful but non-critical context.
- **`<Warning>`** – Misuse will likely cause confusion or errors.
- **`<Danger>`** – Critical guidance to prevent data loss, simulation failure, or misbehavior.

## Accessibility & Tone
- Keep sentences active and direct. Use short paragraphs and lists to reduce cognitive load.
- Provide descriptive link text (avoid “click here”).
- Ensure images/diagrams include alt text describing the information conveyed.

## Front Matter Requirements
- `title`, `description`, and `flashcards` keys are mandatory.
- Include `tags` when relevant to aid future discovery.

## Definition of Done (Content)
Before submitting a topic:
- Follow the section template above in order.
- Include at least one runnable example and one practice element (quiz, flashcards, or exercise).
- Provide key takeaways or checklist in *Make It Work*.
- Cite references that map back to entries in `SYSTEMVERILOG_UVM_BLUEPRINT.md`.
- Run linting/tests and request SME review.
