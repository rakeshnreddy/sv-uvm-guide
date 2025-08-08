# SystemVerilog and UVM Learning Platform

**Vision:** To be the world's leading open-source, curriculum-based guide for SystemVerilog and UVM.

**Tagline:** *The definitive online resource for mastering SystemVerilog and UVM.*

This repository provides a structured and comprehensive curriculum for learning SystemVerilog and the Universal Verification Methodology (UVM). Our goal is to create a platform that is accessible to beginners, yet deep enough for experienced engineers to hone their skills.

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

## Phase Deliverables

* [Enhancement Blueprint](enhance.md)
* [Planned Enhancements](enhancements.md)

Contributions are welcome via pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
