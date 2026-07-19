import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const goalSchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    target: z.number().int().min(1).max(100_000),
    unit: z.string().trim().min(1).max(40),
    dueAt: z.string().datetime().optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = goalSchema.parse(await request.json());
    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        description: input.description,
        target: input.target,
        unit: input.unit,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      },
    });
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_GOAL" }, { status: 400 });
    }
    console.error("Unable to create goal", error);
    return NextResponse.json({ error: "GOAL_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
