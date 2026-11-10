# Worker 1102 diagnosis (sv-uvm-guide, 2026-11-10)

## Summary

The most likely cause is the Workers Free plan's 10 ms CPU limit per request. Cached pages already use more than that, and the home page uses far more because it misses cache interception and loads the full 18 MB Next.js server. Confidence: medium-high. The plan and the exact outcome (CPU or memory) can only be confirmed in the dashboard. The recommended first fix is for the owner to move the account to Workers Paid ($5 a month).

## What the probes showed

About 210 requests from LAX (sequential, 4 at a time, after 100 s idle gaps); logs are in <scratch>/phase0.

- Only 1 request failed: the home page at 11:02:43, a 503 with "error code: 1102" in 0.21 s and `cache-control: private, no-store`. Earlier today the failure rate was 9 of 45 and 4 of 50, so failures come in bursts over time. They did not follow idle gaps (cold isolates) and they did not rise with concurrency.
- Every HTML page, /sitemap.xml, /robots.txt and /api/feature-flags runs the Worker on every request, with no edge cache in front.
- Home page responses carry `x-nextjs-cache: HIT` and `x-powered-by: Next.js` with no `x-opennext-cache` header. Every other page carries `x-opennext-cache: HIT`. So / is the one page rendered through NextServer.

## Why the home page misses interception

In @opennextjs/aws 3.9.12 (node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js), the path "/" becomes "" after `replace(/\/$/, "")`. Then `localizedPath ?? "/"` keeps "", which is not in the prerender manifest, so `isISR` is false. In .open-next/worker.js, the middleware handler (363 kB) does the interception, and `import("./server-functions/default/handler.mjs")` runs only when interception misses. So each home page view evaluates and runs the full server.

## Bundle and cache entries (fresh cf:build of origin/main 32fd8c64)

- handler.mjs: 18.0 MB uncompressed, 4.7 MB gzip, well under the 64 MiB limit. 15 MB of it is the app's own .next server chunks. Prisma (about 0.25 MB) and next-auth are bundled via the /api routes, but load only on the NextServer path.
- 188 prerendered cache entries, 129 MB in total. The median is 0.82 MB. F2A is 1.6 MB, expert-index 2.7 MB and interview-prep 8.1 MB. Each intercepted request reads, JSON-parses and MD5-hashes its entry, so CPU grows with page size. docs/deploy/cloudflare.md already measured 11 to 27 ms of CPU for a warm cached lesson, and 100 to 500 ms on the dynamic path.
- The middleware matches only /curriculum/:path+ and is cheap. It is not the cause.

## Cloudflare and OpenNext limits

From https://developers.cloudflare.com/workers/platform/limits/:
- CPU per HTTP request: Free "10 ms"; Paid "5 min (default: 30 seconds)".
- Isolates have slack for a Worker that "infrequently runs over the configured limit". A Worker that hits the limit consistently is terminated.
- Memory: "128 MB" per isolate. Startup: "1 second". Size: "64 MiB" uncompressed on both plans.
- Error 1102 means CPU or memory was exceeded. The dashboard shows "Exceeded CPU Time Limits" (`exceededCpu`) or "Exceeded Memory" (`exceededMemory`).

https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/ suggests optimising JSON parsing or raising the CPU limit on Paid. https://opennext.js.org/cloudflare/caching says cache interception exists "to avoid calling the NextServer".

## Why CPU rather than memory

Failures return in about 0.2 s, which fits an early CPU kill. Every page fails, including small ones, and failures come in bursts as the slack runs out. The 8 MB interview-prep entry never failed in 15 tries, while the 89 kB home page did. A memory limit would hit the largest pages first. Memory cannot be ruled out without the dashboard.

## Fix options

1. **Owner: move to Workers Paid.** The CPU limit becomes 30 s by default. No repo change is needed. Optionally add `"limits": { "cpu_ms": 30000 }` to wrangler.jsonc. Risk: $5 a month.
2. **Repo: route / through the cache interceptor.** Use patch-package on @opennextjs/aws so that "" falls back to "/" and "/index" in cacheInterceptor.js. Risk: patching a pinned dependency, which must be checked on every build. This removes the heaviest request path.
3. **Repo: shrink the prerendered payloads.** Change src/app/interview-prep, curriculum/expert-index and the lesson [...slug] page so large data is not inlined into the HTML and RSC. Load it as static JSON from /public, or lazily. This lowers per-request CPU on either plan. Effort M to L.
4. **Repo: keep Prisma and next-auth out of the server bundle** by importing them lazily inside the /api routes. Small gain. It only helps the NextServer path.
5. **Repo: add a scheduled sitemap check** that alerts on any non-200.

I recommend option 1 first. It is one dashboard change, it fixes every path at once, and the runbook already concluded that serving needs Paid. Do option 2 next so the home page stops loading the full server, then option 3 for performance on any plan.

## Owner steps in the dashboard

1. Check the plan. Go to dash.cloudflare.com, then Workers & Pages, and look for "Plan: Free" or "Workers Paid" on the overview page. You can also check Manage Account, Billing, Subscriptions.
2. Confirm the cause. Go to Workers & Pages, then sv-uvm-guide, then Metrics. Under Errors, compare "Exceeded CPU Time Limits" with "Exceeded Memory" for today. In Observability, Events, filter `outcome` for `exceededCpu` or `exceededMemory` and note the paths. The CPU time chart shows median and P99.
3. If the plan is Free, upgrade at Workers & Pages, then Plans, then Workers Paid. Afterwards check Settings, then Runtime, for the CPU limit (30,000 ms by default), and watch the error metrics for a day.
