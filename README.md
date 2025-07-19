# SV/UVM Guide

Our mission is to build the definitive online platform for mastering SystemVerilog and the Universal Verification Methodology (UVM). We are charting a course for dedicated learners—from students to transitioning professionals—to move beyond surface-level tutorials toward deep, applicable expertise in the critical field of hardware verification.

The core philosophy of this platform is a layered approach rooted in understanding the fundamental rationale—the "why"—behind the language constructs and methodological rules—the "what". We reject rote memorization in favor of building robust mental models. To achieve this, our platform will be built on three pillars:

1.  **Authoritative, Structured Content:** Synthesizing knowledge from foundational texts and industry best practices into a unique three-layer structure (Analogy, Practice, Expert Context).
2.  **Practical Toolchain Proficiency:** Providing guidance on a complete, accessible open-source digital workbench.
3.  **Cognitive Learning Strategies:** Integrating techniques like Spaced Repetition (SRS) and the Feynman Technique directly into the platform to forge lasting knowledge.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18 or later)
*   npm
*   Docker

### Environment Variables

Before you can run the application, you need to create a `.env` file and set the following environment variables:

1.  Create a `.env` file by copying the `.env.example` file.
    ```sh
    cp .env.example .env
    ```
2.  Open the `.env` file and add your Gemini API key, session secret, and Google OAuth credentials.
    ```
    GEMINI_API_KEY="YOUR_API_KEY"
    SESSION_SECRET="YOUR_SESSION_SECRET"
    GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
    ```
3.  The `DATABASE_URL` is already set in the `.env.example` file, but you can change it if you need to.

### Installation

1.  **Start the database:** Open your terminal and run the following command to start the PostgreSQL database:
    ```sh
    docker run --name some-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 5432:5432 -d postgres:14.1-alpine
    ```
2.  **Install dependencies:** Navigate to the `sv-uvm-guide` directory in your terminal and run this command to install the project's dependencies:
    ```sh
    npm install
    ```
3.  **Apply database migrations:** This command will set up the database schema:
    ```sh
    npx prisma migrate dev --name init
    ```
4.  **Run the application:**
    ```sh
    npm run dev
    ```
    After these steps, the application should be running at [http://localhost:3000](http://localhost:3000).

## Clean and Run

To clean up local files and builds, do a clean install, and run the dev server, use the following command:

```bash
npm run clean-and-run
```

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

### Styling

The site uses Tailwind CSS with custom CSS variables. Colors like `text-brand-text-primary` are driven by variables defined in `src/app/globals.css` and mapped in `tailwind.config.ts`. Make sure these variables are present when customizing themes, otherwise the components will appear unstyled.

Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
