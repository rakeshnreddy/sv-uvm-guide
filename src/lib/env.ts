import { z } from "zod";

function normalizeDeploymentUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

const environmentSchema = z.object({
  APP_URL: z.string().url(),
});

export const env = environmentSchema.parse({
  APP_URL:
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    normalizeDeploymentUrl(process.env.VERCEL_URL) ??
    "http://localhost:3000",
});
