import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const knownAssessmentVersions: Record<string, { assessmentVersion: string; scoringVersion: string }> = {
  "adaptive-test": { assessmentVersion: "adaptive-v2", scoringVersion: "adaptive-scoring-v1" },
  placement: { assessmentVersion: "placement-v2", scoringVersion: "placement-scoring-v2" },
};

const requestSchema = z.object({
  assessmentId: z.enum(["adaptive-test", "placement"]),
  assessmentVersion: z.string().min(1),
  scoringVersion: z.string().min(1),
  responses: z.array(z.object({
    questionId: z.string().min(1).max(120),
    optionId: z.string().min(1).max(120),
    isCorrect: z.boolean(),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (new Set(value.responses.map((response) => response.questionId)).size !== value.responses.length) {
    context.addIssue({ code: "custom", message: "Duplicate assessment response" });
  }
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = requestSchema.parse(await request.json());
    const expected = knownAssessmentVersions[input.assessmentId];
    if (
      input.assessmentVersion !== expected.assessmentVersion ||
      input.scoringVersion !== expected.scoringVersion
    ) {
      return NextResponse.json({ error: "ASSESSMENT_VERSION_MISMATCH" }, { status: 409 });
    }

    const correct = input.responses.filter((response) => response.isCorrect).length;
    const attempt = await getPrisma().assessmentAttempt.create({
      data: {
        userId: session.user.id,
        assessmentId: input.assessmentId,
        assessmentVersion: input.assessmentVersion,
        scoringVersion: input.scoringVersion,
        status: "COMPLETED",
        score: correct / input.responses.length,
        completedAt: new Date(),
        responses: {
          create: input.responses.map((response) => ({
            questionId: response.questionId,
            optionId: response.optionId,
            isCorrect: response.isCorrect,
            score: response.isCorrect ? 1 : 0,
          })),
        },
      },
      select: { id: true, score: true, completedAt: true },
    });
    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_ASSESSMENT_ATTEMPT" }, { status: 400 });
    }
    console.error("Assessment persistence failed", error);
    return NextResponse.json({ error: "ASSESSMENT_UNAVAILABLE" }, { status: 503 });
  }
}
