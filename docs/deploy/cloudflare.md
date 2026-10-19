# Cloudflare Workers deployment

The site runs on Cloudflare Workers through the OpenNext adapter
([`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)). It is a
**no-login** deploy: lessons, search, visualizers, the practice hub, all 23
available labs, the placement quiz, flashcard review, the notebook, the dashboard
and settings all work for an anonymous visitor, and learner data stays in that
visitor's browser. Accounts (sign-in and server-side records), the AI tutor,
simulation and community need PostgreSQL and secrets; they stay off until
[Turning accounts and server features on](#turning-accounts-and-server-features-on-later).

| | |
|---|---|
| Worker name | `sv-uvm-guide` |
| URL | <https://sv-uvm-guide.rakesh-n99.workers.dev> |
| Cloudflare account | `4e1b7f6a7440770a01779a67602ec5e9` |
| Deploy branch (phase 1) | `deploy/cloudflare` |
| Adapter | `@opennextjs/cloudflare` **1.15.1**, pinned exactly (see below) |
| Wrangler | `^4.149.0` (needs Node **22+**) |
| Plan | Workers **Paid** recommended (see *Size and plan*) |

## What the deploy adds

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker name, entry (`.open-next/worker.js`), static assets, `nodejs_compat`, runtime vars `APP_URL` and `NEXTAUTH_URL` |
| `open-next.config.ts` | Static-assets incremental cache + cache interception (no R2/KV/queue to provision) |
| `package.json` | `cf:build`, `cf:preview`, `cf:deploy`, `cf:upload` scripts; dev dependencies `@opennextjs/cloudflare@1.15.1` and `wrangler` |
| `package-lock.json` | +364 packages for the two dev dependencies (nothing removed) |
| `.gitignore` | `.open-next/`, `.wrangler/`, `.dev.vars*` |
| `docs/deploy/cloudflare.md` | This runbook |

No application code, `next.config.mjs`, Prisma schema or `content/**` file changes.

### Why OpenNext 1.15.1 exactly

OpenNext 1.16+ dropped Next 14; 1.19+ requires Next ≥ 15.5. 1.15.1 is the last
release whose peer range (`^14.2.35`) covers this app's `next@14.2.35`. Keep the
exact pin until the app moves to Next 15.5+, then upgrade both together.

### How lessons are served

Lesson pages, `/curriculum`, the home page, the practice pages and the visualizers are
prerendered by `next build`. OpenNext copies the prerendered HTML/RSC into the
Worker's static assets (`staticAssetsIncrementalCache`) and, with
`enableCacheInterception`, answers those routes without booting the Next.js server.
There is no ISR revalidation; **every push redeploys**, which is how content updates
go live. `src/middleware.ts` still runs in the Worker and sends the 308 for
non-canonical lesson URLs. Search is client-side (`src/generated/search-index.json`
chunk), so it needs no server.

## Behaviour without a database

`DATABASE_URL` is **not** set and accounts are off (`ACCOUNTS_ENABLED`, the
`accountUI` flag, is false). What happens:

- **Build:** no route calls Prisma. `src/lib/prisma.ts` constructs the client lazily
  (a Proxy), and every Prisma-backed route is dynamic (`ƒ` in the build output:
  `force-dynamic`, or it reads the session cookie first), so nothing is prerendered
  through the database. Verified by a clean build with no `DATABASE_URL`.
- **Lessons and labs are static.** Lessons, `/curriculum`, `/`, `/practice`, the
  visualizers and all **23** `/practice/lab/<id>` pages are prerendered by
  `next build` and served from Worker static assets. The lab page uses
  `generateStaticParams` with `dynamicParams = false` and `dynamic = 'error'`; its
  files and solutions are read at build time and travel as props. Nothing
  redirects: there is no sign-in wall in front of a lab, and an unknown or
  coming-soon lab id is a 404. `npm run check:prerender`
  (`scripts/check-prerendered-labs.mjs`, run by `npm run test:ci` after the build)
  fails unless `.next/prerender-manifest.json` lists every available lab plus the
  four learner pages below. The server chunks of these pages contain no Prisma
  client, `next-auth` or `src/lib/auth.ts` code; only the `/api/*` route chunks do.
- **Learner pages are static too.** `/dashboard`, `/dashboard/review`,
  `/dashboard/notebook` and `/settings` are prerendered shells with client islands.
  Progress, flashcard schedules, notes, quiz and placement results live in the
  visitor's browser storage (`localStorage`, keys starting `sv-uvm-guide:` plus a
  few legacy keys), labelled "Saved in this browser" on the page. `/settings`
  offers export (a JSON backup), import (replace or merge) and reset of that data.
  These pages are reachable from the navigation but kept out of the sitemap, and
  `robots.txt` keeps disallowing `/dashboard` and `/settings`.
- **No session traffic.** With accounts off, `ClientProviders` does not mount
  next-auth's `SessionProvider` and `useAuth()` returns a constant signed-out
  value, so no page requests `/api/auth/session`, on load or on tab focus. (Before
  the no-login work every learning page did, and each request was a 100–500 ms
  dynamic Worker call.)
- **`/api/auth/*` is closed.** `src/app/api/auth/[...nextauth]/route.ts` is
  `force-dynamic` and checks `isServerPersistenceConfigured()`
  (`src/server/persistence-gate.ts`) before it loads `next-auth` or
  `src/lib/auth.ts`. The gate needs `accountUI` **and** `DATABASE_URL` **and** a real
  provider (both Google keys) **and** `NEXTAUTH_SECRET` or `SESSION_SECRET`. While it
  is closed: `GET /api/auth/session` answers `200 {}` (signed out, `no-store`),
  `POST /api/auth/_log` answers `204`, and every other path, including
  `/api/auth/signin`, answers `404 {"error":"ACCOUNTS_DISABLED"}`. The old
  placeholder sign-in page is gone.
- **Account-only API routes fail closed.** `/api/me/*`, `/api/reviews`,
  `/api/simulate`, `/api/ai/*` and `/api/labs/run` are unchanged: `requireSession()`
  throws `AuthenticationError` before any Prisma call, so they answer **401** (405
  for a GET on POST-only routes). No page calls them while accounts are off; they
  are the backends for when accounts return.
- **Hidden pages.** `/notifications`, `/community/**`, `/assessment`, `/resources`,
  `/projects` and `/history` answer 404 and are neither linked nor in the sitemap
  while their switches are off (see the flags below).
- **Feature flags:** `community`, `tracking`, `personalization`, `fakeComments`,
  `accountUI`, `aiTutor` and `simulation` default to **off** in
  `src/tools/featureFlags.ts`. They are read only from `NEXT_PUBLIC_FEATURE_FLAG_*`
  build variables, which Next inlines into the server render and the browser alike,
  so the two always agree. Leave every `NEXT_PUBLIC_FEATURE_FLAG_*` variable
  **unset** on this deploy. `tracking` and `personalization` now only preview draft
  pages (the assessment center; resources, projects and history) and must stay off
  in production.
- **Unknown lesson URLs** (`/curriculum/<no such lesson>`) render a 404 on demand.
  The Worker log then shows `StaticAssetsIncrementalCache: Failed to set to
  read-only cache`, which is expected: the read-only cache refuses to store the 404.
- **NEXTAUTH_SECRET is still required at build.** `src/lib/auth.ts` throws on import
  when neither `NEXTAUTH_SECRET` nor `SESSION_SECRET` is set. The auth route now
  imports it lazily, but `next build` still imports the other API routes
  (`/api/me/*` and friends) while collecting page data, and they import auth at
  module load, so the **build** fails without a secret (`Failed to collect page
  data for /api/me/notifications`), and at runtime those routes would 500. Set it
  in both places: a build variable (any random value; nothing is signed at build
  time) and a Worker secret.

## Size and plan

Measured on the phase-1 build (OpenNext 1.15.1, Next 14.2.35, 163 static pages):

| Measure | Value | Free limit | Paid limit |
|---|---|---|---|
| Worker script (`Total Upload`) | **18.3 MiB** (3.83 MiB gzip) | 64 MiB uncompressed | 64 MiB uncompressed |
| Worker startup time | 30 ms | 1 s | 1 s |
| Static asset files | 406 (largest well under 25 MiB) | 20,000 | 100,000 |
| CPU per cached lesson page (warm) | **11–27 ms** | **10 ms** | 30 s default |
| CPU, cold isolate or dynamic route (`/api/*`, an on-demand 404) | 100–500 ms | 10 ms | 30 s default |

Cloudflare's current limits page counts only the uncompressed size (64 MiB on both
plans); the gzip figure is informational. The dynamic-route row was measured on
`/api/auth/session` and the old lab redirect; the no-login build serves neither on
a normal page view (labs are static and there is no session fetch), so those
figures now apply only to the `/api/*` routes and on-demand 404s. Re-measure the
Worker size and static asset count after the next deploy, since the 23 lab pages
and four learner pages are now prerendered.

**Verdict: the bundle fits the Free plan, but serving needs Workers Paid
($5/month).** Even cached lesson pages consistently use more than Free's 10 ms of
CPU, because each one parses its prerendered HTML+RSC cache entry (450–600 kB).
Cloudflare tolerates occasional overruns but terminates Workers that hit the limit
consistently with **Error 1102** ("Worker exceeded resource limits"). Free may look
fine at a handful of visitors, but expect 1102s as traffic grows. Paid also raises the
daily request cap (100,000/day on Free) and gives 6,000 build minutes and faster
4-vCPU builds. Watch **Workers → sv-uvm-guide → Metrics → Errors → Exceeded CPU
Time Limits** after any plan change.

## Continuous deployment (Workers Builds)

Cloudflare builds and deploys on every push to the production branch. One-time
setup in the dashboard:

1. **Workers & Pages → `sv-uvm-guide` → Settings → Build → Connect**, authorise the
   Cloudflare GitHub app for `rakeshnreddy/sv-uvm-guide` (only this repository).
2. Enter exactly:

   | Setting | Value |
   |---|---|
   | Git repository | `rakeshnreddy/sv-uvm-guide` |
   | Branch (production) | `main` (set 2026-10-19; `main` is fast-forwarded to the integration branch at each checkpoint) |
   | Build command | `npm ci --ignore-scripts && npx prisma generate && npx opennextjs-cloudflare build` |
   | Deploy command | `npx opennextjs-cloudflare deploy` |
   | Non-production branch builds | **Off** (or preview command `npx opennextjs-cloudflare upload`) |
   | Root directory | `/` (leave empty) |
   | Build watch paths | include `*` (default) |
   | API token | let Cloudflare create one |

3. **Build variables and secrets** (Settings → Build → Variables and secrets):

   | Name | Value | Type |
   |---|---|---|
   | `NODE_VERSION` | `22` | text |
   | `SKIP_DEPENDENCY_INSTALL` | `1` | text |
   | `APP_URL` | `https://sv-uvm-guide.rakesh-n99.workers.dev` | text |
   | `NEXT_TELEMETRY_DISABLED` | `1` | text |

   No build secret is needed: `src/lib/auth.ts` tolerates a missing `NEXTAUTH_SECRET` only while
   `next build` runs (`NEXT_PHASE=phase-production-build`) and still fails closed at runtime, where
   the Worker's own `NEXTAUTH_SECRET` secret (Settings → Variables and secrets) is used. The repo's
   `postinstall` also skips Playwright browser installs when `WORKERS_CI` or `CF_PAGES` is set, so a
   missing `SKIP_DEPENDENCY_INSTALL` can no longer fail the build (`su: Authentication failure`).

   Do **not** add `DATABASE_URL`, `GOOGLE_*`, `GEMINI_API_KEY` or any
   `NEXT_PUBLIC_FEATURE_FLAG_*` variable on the anonymous deploy (see
   [Turning accounts and server features on](#turning-accounts-and-server-features-on-later)).

Why each setting:

- `SKIP_DEPENDENCY_INSTALL=1` + `npm ci --ignore-scripts`: the repo's `postinstall`
  (`scripts/install-playwright-browsers.cjs`) runs `npx playwright install`, which
  ignores `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` and would download every browser in CI.
  `--ignore-scripts` also stops `husky` from touching git config.
- `npx prisma generate`: `--ignore-scripts` skips Prisma's own postinstall, and the
  type-check and `@prisma/client` import need the generated client (no database
  connection is made).
- `NODE_VERSION=22`: Wrangler 4.149 requires Node 22; Workers Builds defaults to 24.
- `APP_URL` at build time: `src/app/layout.tsx` uses it as `metadataBase`, which is
  baked into the prerendered pages' Open Graph URLs.
- `npx opennextjs-cloudflare build` runs the repo's `npm run build` (prebuild
  `generate:curriculum` → `tsc --noEmit` → `next build` with lint), then bundles the
  Worker. A type or lint error on the branch fails the deploy, same as locally.

Runtime configuration lives in `wrangler.jsonc` (`vars`) and in Worker secrets.
Secrets survive every deploy; `vars` are re-applied from `wrangler.jsonc` on each
deploy, so change them there, not in the dashboard.

| Runtime name | Where | Value |
|---|---|---|
| `APP_URL` | `wrangler.jsonc` vars | Worker URL |
| `NEXTAUTH_URL` | `wrangler.jsonc` vars | Worker URL |
| `NEXTAUTH_SECRET` | Worker secret | set once: `npx wrangler secret put NEXTAUTH_SECRET` |

Free plan build quota: 3,000 build minutes/month, one build at a time, 20-minute
timeout, 8 GB RAM, 2 vCPU (Paid: 6,000 minutes, 4 vCPU). A clean local build
(generate → `tsc` → `next build` → bundle) takes about 5 minutes on an Apple-silicon
Mac; expect longer on the 2-vCPU Free builder, still well inside 20 minutes.

## Local commands

Wrangler needs Node 22. With nvm: `nvm install 22` (then `nvm alias default 20.12.2`
if you want to keep 20 as the default), and prefix commands with
`PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH` or run `nvm use 22`.

```bash
NEXTAUTH_SECRET=local-build-only npm run cf:build      # build .open-next/
npx opennextjs-cloudflare preview                       # serve it in workerd on :8787
NEXTAUTH_SECRET=local-build-only npm run cf:deploy     # build + deploy from this machine
npx wrangler deployments list                           # history
npx wrangler rollback                                   # roll back to the previous version
npx wrangler tail                                       # live logs
```

For local preview, create `.dev.vars` (git-ignored) with
`NEXTAUTH_SECRET=<anything>`, or routes that import `src/lib/auth.ts` return 500.

A build writes about 760 MB to `.open-next/` and about 1.4 GB to `.next/`;
delete both afterwards on a tight disk.

## Phase 2: deploy every integration push

Once phase 1 is live:

1. The main session merges `deploy/cloudflare` into `curriculum-quality-program`
   **once** (message below).
2. In the dashboard, change **Settings → Build → Branch** from `deploy/cloudflare`
   to `curriculum-quality-program`. Nothing else changes.
3. Every later push to `curriculum-quality-program` builds and deploys. A push
   that fails type-check, lint or `next build` does not deploy; the previous
   version keeps serving.

Files the merge adds or changes (nothing else, no `content/**`):

| File | Change | Conflict risk |
|---|---|---|
| `wrangler.jsonc` | new | none |
| `open-next.config.ts` | new | none |
| `docs/deploy/cloudflare.md` | new | none |
| `.gitignore` | +6 lines at the end | low |
| `package.json` | +4 `cf:*` scripts after `start:local`; +2 devDependencies | low |
| `package-lock.json` | +364 packages; 5 transitive hoists bumped within range (`semver` 7.7.4→7.8.5, `undici` 7.22.0→7.29.1, `ws` 8.19.0→8.21.0, `hasown` 2.0.2→2.0.4, `@emnapi/runtime` 1.8.1→1.11.3) | medium if the main branch changed dependencies since the fork point |

If `package-lock.json` conflicts, take the main branch's version and re-add the two
packages instead of hand-merging:

```bash
git checkout --ours package-lock.json     # "ours" = curriculum-quality-program during the merge
npm install -D -E --ignore-scripts @opennextjs/cloudflare@1.15.1
npm install -D --ignore-scripts wrangler@^4.149.0
git add package-lock.json
```

After the merge, `npm install` adds about 400 MB to `node_modules` (workerd,
wrangler, the OpenNext AWS SDK dependencies). `npm run dev`, `npm run build`,
`npm test` and Playwright are unaffected and still run on Node 20; only the
`cf:*` scripts need Node 22. `tsc` skips dot-directories, so a local `.open-next/`
never enters `npm run type-check`; `tsconfig.json` needs no change.

## Release checklist and `cf:preview` smoke test

Run this on the owner's machine once every package of an integration is in, before
deploying:

1. `npx vitest --run`, `npm run type-check`, `npm run lint`,
   `npm run validate:flashcards` and `node scripts/check-mdx.mjs content/curriculum`.
2. Check `df -h` (a build needs about 1.5 GB), then
   `ANALYZE=true npm run build && npm run bundle:check && npm run check:prerender`.
   `check:prerender` expects 23 `/practice/lab/<id>` routes plus `/dashboard`,
   `/dashboard/review`, `/dashboard/notebook` and `/settings`.
3. `npm run test:e2e:release` (anonymous mode), then `npm run test:e2e:accounts`
   against a disposable database (see *Running the Playwright suites locally* in
   `CONTRIBUTING.md`).
4. `npm run cf:preview` (Node 22, `.dev.vars` with `NEXTAUTH_SECRET`), then, with
   `B=http://localhost:8787`, check:

   | Check | Expected |
   |---|---|
   | `curl -sI $B/practice/lab/basics-1` | `200`, `content-type: text/html` |
   | `curl -s -D - -H 'RSC: 1' $B/practice/lab/basics-1` (what a client-side navigation fetches) | `200`, `content-type: text/x-component` (an RSC payload, not HTML or an error) |
   | `curl -sI $B/practice/lab/nope` | `404` |
   | `curl -sI` on `$B/dashboard`, `$B/dashboard/review`, `$B/dashboard/notebook`, `$B/settings` | `200` each |
   | `curl -si $B/api/auth/signin` | `404`, body `{"error":"ACCOUNTS_DISABLED"}` |
   | `curl -si $B/api/auth/session` | `200`, body `{}` |
   | DevTools → Network on a lesson, a lab, `/dashboard` and `/settings`, including after switching tabs away and back | no request to `/api/auth/*` or `/api/me/*` |

5. Deploy (`npm run cf:deploy`, or push the deploy branch).

## Turning accounts and server features on (later)

Not done on this deploy. Each server feature needs **all** of its pieces in the
same build and deploy; a half-configured switch either shows nothing or, for
accounts, a sign-in link that answers 404.

| Feature | Build variables (inlined, so rebuild) | Runtime secrets and services | Also needs |
|---|---|---|---|
| Accounts: sign-in, account menu, notifications, account preferences | `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true` | `DATABASE_URL` (or Hyperdrive), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` | the database steps below |
| AI tutor, Teach-it-back and notebook AI feedback | `NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR=true` | `GEMINI_API_KEY` (optional `GEMINI_MODEL`) | accounts |
| Server simulation (the lab "Run" panel) | `NEXT_PUBLIC_FEATURE_FLAG_SIMULATION=true` | `SIMULATION_QUEUE_URL`, `SIMULATION_QUEUE_TOKEN` and the isolated runner service | accounts |
| Community | `NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY=true` | a real backend (today's Firebase client is a mock: posts are denied by `firestore.rules`) | accounts |

The AI tutor, simulation and community switches are ANDed with accounts in
`src/lib/site-features.ts`. The AI tutor and AI feedback, the simulation panel,
the notification feed and the account preferences panel also appear only for a
**signed-in** learner (`useServerFeature` and `useAccountSession` in
`src/lib/persistence/target.ts`); signed-out visitors keep the local, anonymous
UI. Leave `TRACKING` and `PERSONALIZATION` off: they only preview draft pages.

What changes when accounts are on and fully configured:

- `ClientProviders` mounts `SessionProvider`, so pages fetch `/api/auth/session`
  again (on load and on tab focus): budget for those dynamic Worker calls.
- The persistence gate opens and `/api/auth/*` is served by NextAuth.
- **Sign-in entry point:** when the learner is signed out, the navbar account menu
  offers **Sign in**, linking to `/api/auth/signin?callbackUrl=<current path>`.
  Configure the Google OAuth redirect URI `https://<host>/api/auth/callback/google`.
- **Learner data stays in the browser.** `SERVER_SYNC_READY` in
  `src/lib/persistence/accounts.ts` is the constant `false`, so even signed-in
  learners keep every record (labs, flashcards, notebook, progress, placement) in
  browser storage, and the dashboard always reads local data. Turning accounts on
  therefore never hides local progress. Flip `SERVER_SYNC_READY` only after
  `POST /api/me/import` exists: it must accept the `/settings` export bundle on
  first sign-in, re-validate every entry and re-grade lab evidence recorded with
  origin `browser`.
- If `accountUI` is on but the gate is not configured (for example the Google keys
  are missing), `SessionProvider` still mounts but `/api/auth/session` answers
  `200 {}`, so pages quietly stay signed out instead of failing on every focus;
  the **Sign in** link, however, leads to a 404, and `/notifications` shows
  "Sign-in is not available on this site yet" instead of a Sign in link.
  Configure everything together.

Steps:

1. **Database.** Create a hosted Postgres: **Neon** (serverless driver, branchable,
   free tier) or **Supabase** (use the pooled "transaction" connection string, port
   6543). Run `npx prisma migrate deploy` against it from a trusted machine.
2. **Connection path.** Either
   - **Hyperdrive** (recommended for Workers): `npx wrangler hyperdrive create
     sv-uvm-guide-db --connection-string="<postgres url>"` and add
     `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id>" }]` to
     `wrangler.jsonc`; or
   - a direct `DATABASE_URL` Worker secret with Neon's serverless driver.

   The persistence gate checks `DATABASE_URL` at request time. With Hyperdrive
   only, still provide a `DATABASE_URL` value (or extend the gate to accept the
   binding) or `/api/auth/*` stays closed.
3. **Prisma on Workers.** In `prisma/schema.prisma`, add
   `previewFeatures = ["driverAdapters"]` to the generator (keep the default output
   location; OpenNext patches the generated client). Install `@prisma/adapter-pg`
   (Hyperdrive) or `@prisma/adapter-neon`. In `next.config.mjs` (Next 14) add
   `experimental.serverComponentsExternalPackages: ["@prisma/client", ".prisma/client"]`.
   Change `src/lib/prisma.ts` to build the client **per request** from
   `getCloudflareContext().env.HYPERDRIVE.connectionString` with
   `new PrismaPg({ connectionString, maxUses: 1 })`. Workers must not reuse a
   connection pool across requests. This is an app-code change; review it in its
   own PR.
4. **Secrets** (`npx wrangler secret put <NAME>`):

   | Secret | Purpose |
   |---|---|
   | `DATABASE_URL` | Prisma and the persistence gate |
   | `NEXTAUTH_SECRET` | already set for the anonymous deploy; keep it |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in; OAuth redirect URI `https://<host>/api/auth/callback/google` |
   | `GEMINI_API_KEY` | AI tutor routes (only with the `aiTutor` flag) |
   | `SIMULATION_QUEUE_URL`, `SIMULATION_QUEUE_TOKEN` | lab simulation worker (only with the `simulation` flag) |

   `NEXTAUTH_URL` stays a plain var in `wrangler.jsonc`; point it at the custom
   domain if one is added. Never set `AUTH_TEST_MODE` on the Worker: the test
   identity is refused in production anyway, and it exists only for Playwright.
5. **Flags.** Add `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true` as a **build** variable
   (it is inlined at build time) and redeploy. Add `..._AI_TUTOR`, `..._SIMULATION`
   or `..._COMMUNITY` the same way, each only once its backend from the table above
   is in place.
6. **Verify.** With a test Google account: the navbar shows **Sign in** when signed
   out; signing in returns to the same page; `/api/auth/session` returns the user;
   local progress is still visible after sign-in; `npm run test:e2e:accounts`
   passes against a disposable database. Check the navbar at 768 px with a
   signed-in learner (no sideways scroll; the account menu and the bell do not
   fit there yet), and once it fits turn the `test.fixme` in
   `tests/e2e/navigation.spec.ts` into a normal test.
7. **Plan.** Database-backed SSR routes use 100+ ms of CPU per request; they need
   Workers Paid (already recommended, see *Size and plan*).
8. **Later:** add `POST /api/me/import`, then flip `SERVER_SYNC_READY` so signed-in
   learners' records move to the server stores.
