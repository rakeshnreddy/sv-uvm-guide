# SystemVerilog and UVM Learning Platform

**Vision:** To be the world's leading open-source, curriculum-based guide for SystemVerilog and UVM.

**Tagline:** *The definitive online resource for mastering SystemVerilog and UVM.*

This repository provides a structured and comprehensive curriculum for learning SystemVerilog and the Universal Verification Methodology (UVM). Our goal is to create a platform that is accessible to beginners, yet deep enough for experienced engineers to hone their skills.

## Getting Started

### Prerequisites

* **Node.js 18.18+** and **npm 9+** (Next.js 14 requires Node 18).
* **Git** for cloning the repository.
* **Playwright system packages** (Linux only). `npm install` attempts to run `npx playwright install-deps`; when that command fails because the host cannot access the necessary apt repositories, install the packages manually or rerun on a machine with desktop libraries available (see [Playwright setup](#playwright-setup--troubleshooting)).

### Quick start

```bash
git clone https://github.com/<your-org>/sv-uvm-guide.git
cd sv-uvm-guide
cp .env.example .env.local   # adjust secrets and feature flags as needed
npm install                  # installs dependencies and Playwright browsers
npm run dev                  # regenerates Prisma client and starts Next.js
```

For a clean slate you can run `npm run clean-and-run`, which removes build artifacts, reinstalls dependencies, and restarts the dev server at <http://localhost:3000>.

### Standard pre-commit loop

Before pushing changes, run the checks that back our CI gate:

```bash
npm run lint
npm run test
CI=1 ANALYZE=true npm run build
npm run bundle:check
npm run test:e2e
```

Husky installs a pre-commit hook (via `npm install`) that runs `lint-staged` with `next lint --file` and `vitest related --run` so source changes meet the lint/test bar before they land.

If Playwright system dependencies are unavailable in your environment you can temporarily skip `npm run test:e2e`, but record the blocker (see [Playwright setup](#playwright-setup--troubleshooting)).

### Environment variables

The `.env.example` file in the project root documents all supported variables. Copy it to `.env.local` and update the values for your environment. Common settings include:

* `SESSION_SECRET` – required for authenticated sessions.
* Firebase credentials (`NEXT_PUBLIC_FIREBASE_*`) – optional locally; leave blank to use the mocked client.
* `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – required to enable Google sign-in.
* `GEMINI_API_KEY` – enables AI-driven helpers and feedback flows.
* Feature flag overrides (`NEXT_PUBLIC_FEATURE_FLAG_*`, `FEATURE_FLAGS_FORCE_ON`) – useful for unlocking in-progress UI.
* Build tooling flags (`ANALYZE`, `BUNDLE_ANALYZER_*`, `BUNDLE_BASELINE_PATH`) – power bundle reports and guard rails enforced by `npm run bundle:check`.
* Commit metadata (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, `NEXT_PUBLIC_COMMIT_SHA`) – shown in dashboards/downloads when populated by CI.

Additional overrides for bundle analysis and Playwright automation are also included in `.env.example` with inline documentation.

### Playwright setup & troubleshooting

`npm install` automatically runs [`scripts/install-playwright-browsers.cjs`](scripts/install-playwright-browsers.cjs), which:

1. Attempts to install Playwright's Linux system dependencies via `npx playwright install-deps` (skipped when `PLAYWRIGHT_SKIP_INSTALL_DEPS=true` or on non-Linux platforms). This step can fail on locked-down environments where `apt` access is unavailable. If that happens, install the missing libraries manually or rerun the command on a workstation with GUI dependencies available. Known blockers include `libatk-1.0-0`, `libxkbcommon0`, audio libraries, and related X11/GTK packages.
2. Installs the Chromium/Firefox/WebKit browser binaries with `npx playwright install` so the E2E suite is ready immediately after dependency installation.

You can rerun the setup at any time with `node scripts/install-playwright-browsers.cjs`. To skip the system dependency attempt (e.g., when corporate images provide them), export `PLAYWRIGHT_SKIP_INSTALL_DEPS=true` before running `npm install` or the setup script.

### Fresh-clone validation & outstanding manual steps

The onboarding flow was re-tested from a clean clone using Node 18.18 + npm 9. Running `npm install` triggers the Playwright browser install automation, and `npm run dev` starts the site once `.env.local` is populated. The only manual intervention still required on locked-down Linux environments is installing the GTK/X11/audio libraries that `npx playwright install-deps` cannot reach (documented above); once those packages are present, `npm run test:e2e` can run locally without skips.

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

[/T1_Foundational/F1A_The_Cost_of_Bugs/](/T1_Foundational/F1A_The_Cost_of_Bugs/)

## Deployment

The site uses Next.js with a standalone output so it can be hosted on most platforms.

### Local Production Build

```bash
npm run build
npm start
```

`npm run build` runs the TypeScript compiler before invoking `next build`; ESLint now executes during the build step, so any lint errors will fail the production build.

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

The Firebase keys documented in `.env.example` map directly to the initialization logic in [`src/lib/firebase.ts`](src/lib/firebase.ts). Providing real project credentials enables persistence against your Firebase project. Leaving them blank uses a mocked configuration so the site can still run locally, but data will not persist across refreshes.

## Phase Deliverables

* [Enhancement Blueprint](enhance.md)
* [Planned Enhancements](enhancements.md)

Contributions are welcome via pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
