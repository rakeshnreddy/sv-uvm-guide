import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { aiTutor, AiConfigurationError } from "@/server/ai";
import { AiRateLimitError, enforceAiRateLimit } from "@/server/ai/rate-limit";

const requestSchema = z.object({
  content: z.string().trim().min(20).max(8_000),
}).strict();

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { content } = requestSchema.parse(await request.json());
    await enforceAiRateLimit(session.user.id);

    const result = await aiTutor.evaluateFeynmanExplanation(content, {
      signal: AbortSignal.timeout(20_000),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_FEYNMAN_REQUEST" }, { status: 400 });
    }
    if (error instanceof AiRateLimitError) {
      return NextResponse.json(
        { error: "AI_RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof AiConfigurationError) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ error: "AI_TIMEOUT" }, { status: 504 });
    }

    console.error("Feynman evaluation failed", error);
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }
}
