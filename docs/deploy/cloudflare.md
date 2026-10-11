# Cloudflare Workers deployment

The site runs on Cloudflare Workers through the OpenNext adapter
([`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)). Phase 1 is a
**lessons-only** deploy: curriculum pages, search, visualizers, practice pages and
the home page. Sign-in, lab progress, account and dashboard data need PostgreSQL
and stay off until phase 3.

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

## Behaviour without a database (phase 1)

`DATABASE_URL` is **not** set. What happens:

- **Build:** no route calls Prisma. `src/lib/prisma.ts` constructs the client lazily
  (a Proxy), and every Prisma-backed route is dynamic (`ƒ` in the build output:
  `force-dynamic`, or it reads the session cookie first), so nothing is prerendered
  through the database. Verified by a clean build with no `DATABASE_URL`.
- **Lessons:** the server chunks of `/curriculum/[...slug]`, `/curriculum`, `/`,
  `/practice` and the visualizer pages contain no Prisma client, `next-auth` or
  `src/lib/auth.ts` code (the lab page and `/api/me/*` chunks do, as expected).
  Lessons are served from prerendered assets.
- **Feature flags:** `community`, `tracking`, `personalization`, `fakeComments` and
  `accountUI` default to **off** in `src/tools/featureFlags.ts`. Leave the
  `NEXT_PUBLIC_FEATURE_FLAG_*` and `FEATURE_FLAGS_FORCE_ON` variables **unset**.
- **Auth:** no Google keys, so `src/lib/auth.ts` registers a placeholder provider
  that always refuses sign-in. `/api/auth/session` answers `{}` (signed out).
  `requireSession()` throws `AuthenticationError` before any Prisma call, so the
  `/api/me/*`, `/api/reviews`, `/api/simulate`, `/api/ai/*` and `/api/labs/run`
  routes answer **401** (405 for a GET on POST-only routes), and
  `/practice/lab/[labId]` redirects (307) to `/api/auth/signin`, whose page offers
  no working provider. `/settings` and `/community/post/*` answer 404 while their
  flags are off.
- **Unknown lesson URLs** (`/curriculum/<no such lesson>`) render a 404 on demand.
  The Worker log then shows `StaticAssetsIncrementalCache: Failed to set to
  read-only cache`, which is expected: the read-only cache refuses to store the 404.
- **NEXTAUTH_SECRET is required anyway.** `src/lib/auth.ts` throws on import when
  neither `NEXTAUTH_SECRET` nor `SESSION_SECRET` is set. `next build` imports every
  API route while collecting page data, so the **build** fails without it
  (`Failed to collect page data for /api/me/notifications`), and at runtime any
  route that imports it would 500. Set it in both places: a build variable (any
  random value; nothing is signed at build time) and a Worker secret.

## Size and plan

Measured on the phase-1 build (OpenNext 1.15.1, Next 14.2.35, 163 static pages):

| Measure | Value | Free limit | Paid limit |
|---|---|---|---|
| Worker script (`Total Upload`) | **18.3 MiB** (3.83 MiB gzip) | 64 MiB uncompressed | 64 MiB uncompressed |
| Worker startup time | 30 ms | 1 s | 1 s |
| Static asset files | 406 (largest well under 25 MiB) | 20,000 | 100,000 |
| CPU per cached lesson page (warm) | **11–27 ms** | **10 ms** | 30 s default |
| CPU, cold isolate or dynamic route (`/api/auth/session`, lab redirect, 404) | 100–500 ms | 10 ms | 30 s default |

Cloudflare's current limits page counts only the uncompressed size (64 MiB on both
plans); the gzip figure is informational.

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
   | Branch (production) | `deploy/cloudflare` (phase 2: `curriculum-quality-program`) |
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
   | `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` | **secret** |

   Do **not** add `DATABASE_URL`, `GOOGLE_*`, `GEMINI_API_KEY` or any
   `NEXT_PUBLIC_FEATURE_FLAG_*` variable in phase 1.

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

## Phase 3 (later): database, sign-in and labs

Not done in phase 1. To turn auth, lab progress, account and dashboard back on:

1. **Database.** Create a hosted Postgres: **Neon** (serverless driver, branchable,
   free tier) or **Supabase** (use the pooled "transaction" connection string, port
   6543). Run `npx prisma migrate deploy` against it from a trusted machine.
2. **Connection path.** Either
   - **Hyperdrive** (recommended for Workers): `npx wrangler hyperdrive create
     sv-uvm-guide-db --connection-string="<postgres url>"` and add
     `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id>" }]` to
     `wrangler.jsonc`; or
   - a direct `DATABASE_URL` Worker secret with Neon's serverless driver.
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
   | `DATABASE_URL` | Prisma (skip if only Hyperdrive is used) |
   | `NEXTAUTH_SECRET` | already set in phase 1; keep it |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in; OAuth redirect URI `https://<host>/api/auth/callback/google` |
   | `GEMINI_API_KEY` | AI tutor routes (optional) |
   | `SIMULATION_QUEUE_URL`, `SIMULATION_QUEUE_TOKEN` | lab simulation worker (optional) |

   `NEXTAUTH_URL` stays a plain var in `wrangler.jsonc`; point it at the custom
   domain if one is added.
5. **Flags.** Turn on `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI` /
   `..._TRACKING` / `..._PERSONALIZATION` as **build** variables (they are inlined
   at build time), one at a time, and redeploy.
6. **Plan.** Database-backed SSR routes use 100+ ms of CPU per request; they need
   Workers Paid (already recommended for phase 1, see *Size and plan*).
