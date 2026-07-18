import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_REQUEST_LIMIT = 20;

export class AiRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("AI request rate limit exceeded");
    this.name = "AiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function enforceAiRateLimit(
  userId: string,
  options: { now?: Date; windowMs?: number; limit?: number } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_REQUEST_LIMIT;
  const windowStart = new Date(now.getTime() - windowMs);

  const requests = await prisma.activity.count({
    where: {
      userId,
      type: "AI_REQUEST",
      occurredAt: { gte: windowStart },
    },
  });

  if (requests >= limit) {
    throw new AiRateLimitError(Math.ceil(windowMs / 1_000));
  }

  await prisma.activity.create({
    data: {
      userId,
      type: "AI_REQUEST",
      occurredAt: now,
      algorithmVersion: "ai-rate-limit-v1",
    },
  });
}
