import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { aiTutor, AiConfigurationError } from "@/server/ai";
import { AiRateLimitError, enforceAiRateLimit } from "@/server/ai/rate-limit";

const requestSchema = z.object({
  userQuestion: z.string().trim().min(1).max(2_000),
  pageContext: z
    .object({
      title: z.string().max(200),
      route: z.string().max(500),
      selectedText: z.string().max(2_000),
    })
    .strict()
    .optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = requestSchema.parse(await request.json());
    await enforceAiRateLimit(session.user.id);

    const reply = await aiTutor.answer(input, {
      signal: AbortSignal.timeout(20_000),
    });
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_AI_REQUEST" }, { status: 400 });
    }
    if (error instanceof AiRateLimitError) {
      return NextResponse.json(
        { error: "AI_RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    }
    if (error instanceof AiConfigurationError) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ error: "AI_TIMEOUT" }, { status: 504 });
    }

    console.error("AI chat request failed", error);
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }
}
