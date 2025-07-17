# SV/UVM Guide

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

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18 or later)
*   npm

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/your_username_/sv-uvm-guide.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```
3.  Set up the database
    ```sh
    npx prisma generate
    npx prisma db push
    ```
4.  Run the development server
    ```sh
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Running the tests

To run the tests, use the following command:

```bash
npm test
```

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
