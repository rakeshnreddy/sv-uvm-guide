import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Lessons are prerendered at build time and every push redeploys, so the
// read-only static-assets cache is enough: no R2 bucket, KV namespace or
// revalidation queue to provision. Cache interception serves prerendered
// pages without loading the Next.js server.
const config = {
  ...defineCloudflareConfig({
    incrementalCache: staticAssetsIncrementalCache,
    enableCacheInterception: true,
  }),
  // Patch @opennextjs/aws so "/" is also served by cache interception (see
  // scripts/patch-opennext-cache-interceptor.mjs). It runs here, before
  // OpenNext bundles the middleware, so every `opennextjs-cloudflare build`
  // gets it, including Workers Builds, whose `npm ci --ignore-scripts` skips
  // postinstall. It fails the build if the upstream source text changed.
  buildCommand: "node scripts/patch-opennext-cache-interceptor.mjs && npm run build",
};

export default config;
