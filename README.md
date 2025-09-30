# SystemVerilog and UVM Learning Platform

**Vision:** To be the world's leading open-source, curriculum-based guide for SystemVerilog and UVM.

**Tagline:** *The definitive online resource for mastering SystemVerilog and UVM.*

This repository provides a structured and comprehensive curriculum for learning SystemVerilog and the Universal Verification Methodology (UVM). Our goal is to create a platform that is accessible to beginners, yet deep enough for experienced engineers to hone their skills.

## Getting Started

Follow these steps to spin up the project locally:

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/<your-org>/sv-uvm-guide.git
   cd sv-uvm-guide
   npm install
   ```

   The install step runs `scripts/install-playwright-browsers.cjs`, which installs Playwright browsers and (on Linux) attempts to pull in the required system dependencies. If your environment manages system packages separately, export `PLAYWRIGHT_SKIP_INSTALL_DEPS=true` before running `npm install` and install them manually via `npx playwright install-deps`.

2. **Configure environment variables**

   Copy the provided example and adjust the values as needed:

   ```bash
   cp .env.example .env.local
   ```

   For local development you can leave the Firebase keys blank to use the mocked configuration. See [Firebase Configuration](#firebase-configuration) for details.

3. **Start the development server**

   ```bash
   npm run dev
   ```

   This command also runs `prisma generate` to keep the client in sync before launching Next.js on <http://localhost:3000>.

4. **Run end-to-end tests (optional)**

   ```bash
   npm run test:e2e
   ```

   The command builds the app and executes the Playwright suite using the browsers installed during `npm install`. Rerun `node scripts/install-playwright-browsers.cjs` if you need to refresh the browser binaries.

For a clean slate you can run `npm run clean-and-run`, which removes build artifacts, reinstalls dependencies, and restarts the dev server.

## Curriculum Architecture

The curriculum is organized into a four-tiered structure, based on the principle of progressive disclosure. Each tier builds upon the previous one, creating a clear learning path from foundational concepts to expert-level techniques.

*   **Tier 1: Foundational (T1_Foundational):** Core concepts of the SystemVerilog language.
*   **Tier 2: Intermediate (T2_Intermediate):** Advanced SystemVerilog and core UVM concepts.
*   **Tier 3: Advanced (T3_Advanced):** Advanced UVM techniques and patterns.
*   **Tier 4: Expert (T4_Expert):** Expert-level topics, including performance, debug, and methodology customization.

## Comprehensive Curriculum Module Map

[Comprehensive Curriculum Module Map](COMPREHENSIVE_CURRICULUM_MODULE_MAP.md)

## Start Here

If you are new to SystemVerilog and verification, we recommend starting with the first module of Tier 1:

[/T1_Foundational/F1_Why_Verification/](/T1_Foundational/F1_Why_Verification/)

## Deployment

The site uses Next.js with a standalone output so it can be hosted on most platforms.

### Local Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t sv-uvm-guide .
docker run -p 3000:3000 sv-uvm-guide
```

### Vercel

Deploying via Vercel works out of the box using the `next start` command. The `output: 'standalone'` setting keeps image size small.

If exporting with `next export`, guard any `window` usage as it only runs client-side.

### Curriculum Link Checker

The `check_pages.js` script verifies that each curriculum page is reachable.

1. Start the local server: `npm run dev` (serves on `http://localhost:3000`).
2. In a separate terminal, run `node check_pages.js`.

The script imports the latest curriculum structure and issues a `curl` request for every topic URL, reporting any failures.

## Firebase Configuration

The application expects Firebase credentials to be provided via environment variables. Create a `.env.local` file (or otherwise set these values) with the following keys:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

These variables are used during initialization in `src/lib/firebase.ts`.
If they are not provided, the app falls back to a mock Firebase configuration
so the site can still run locally, but data will not persist.

## Phase Deliverables

* [Enhancement Blueprint](enhance.md)
* [Planned Enhancements](enhancements.md)

Contributions are welcome via pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
