import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Lessons are prerendered at build time and every push redeploys, so the
// read-only static-assets cache is enough: no R2 bucket, KV namespace or
// revalidation queue to provision. Cache interception serves prerendered
// pages without loading the Next.js server.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
