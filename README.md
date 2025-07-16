# sv-uvm-guide

Our mission is to build the definitive online platform for mastering SystemVerilog and the Universal Verification Methodology (UVM). We are charting a course for dedicated learners—from students to transitioning professionals—to move beyond surface-level tutorials toward deep, applicable expertise in the critical field of hardware verification.

The core philosophy of this platform is a layered approach rooted in understanding the fundamental rationale—the "why"—behind the language constructs and methodological rules—the "what". We reject rote memorization in favor of building robust mental models. To achieve this, our platform will be built on three pillars:

1.  **Authoritative, Structured Content:** Synthesizing knowledge from foundational texts and industry best practices into a unique three-layer structure (Analogy, Practice, Expert Context).
2.  **Practical Toolchain Proficiency:** Providing guidance on a complete, accessible open-source digital workbench.
3.  **Cognitive Learning Strategies:** Integrating techniques like Spaced Repetition (SRS) and the Feynman Technique directly into the platform to forge lasting knowledge.

## Project Structure

*   **/src**: Contains the main source code for the Next.js application.
    *   **/src/app**: The main application routes.
        *   **/src/app/api**: API routes.
        *   **/src/app/components**: UI components used throughout the application.
        *   **/src/app/curriculum**: The curriculum pages.
        *   **/src/app/dashboard**: The user dashboard.
    *   **/src/lib**: Utility functions and libraries.
*   **/content**: Contains the MDX content for the curriculum.
*   **/public**: Contains static assets like images and fonts.
*   **/tests**: Contains the tests for the application.
*   **next.config.mjs**: The configuration file for Next.js.
*   **package.json**: The project dependencies and scripts.
*   **tsconfig.json**: The TypeScript configuration file.
*   **prisma**: Contains the Prisma schema for the database.
*   **.env.example**: An example of the environment variables needed to run the application.

## Getting Started

1.  Install dependencies:

    ```bash
    npm install
    ```

2.  Generate the Prisma client:

    ```bash
    npx prisma generate
    ```

3.  Run the development server:

    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
