import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { graderRegistry, type LabSubmission } from "@/lib/lab-graders";
import { checkGradedSubmission, toLabPolicyInput } from "@/lib/lab-progress-policy";
import { getLabById } from "@/lib/lab-registry";
import { completeLabStep, LabStepCompletionError } from "@/server/labs";

const submissionSchema = z.object({
  labId: z.string().regex(/^[a-z0-9-]+$/),
  labVersion: z.string().min(1),
  stepId: z.string().min(1),
  stepVersion: z.string().min(1),
  files: z.array(z.object({
    path: z.string().min(1).max(300),
    content: z.string().max(256 * 1024),
  }).strict()).min(1).max(24),
}).strict().superRefine((value, context) => {
  const total = value.files.reduce((bytes, file) => bytes + Buffer.byteLength(file.content), 0);
  if (total > 1024 * 1024) context.addIssue({ code: "custom", message: "Submission is too large" });
  if (new Set(value.files.map((file) => file.path)).size !== value.files.length) {
    context.addIssue({ code: "custom", message: "Duplicate file path" });
  }
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const submission: LabSubmission = submissionSchema.parse(await request.json());
    const lab = getLabById(submission.labId);
    if (!lab || lab.status !== "available") {
      return NextResponse.json({ error: "LAB_NOT_FOUND" }, { status: 404 });
    }

    // The same prechecks, codes and statuses the browser lab store applies (src/lib/lab-progress-policy.ts).
    const check = checkGradedSubmission(toLabPolicyInput(lab), submission, graderRegistry);
    if (!check.ok) return NextResponse.json({ error: check.code }, { status: check.status });
    const { grader, step } = check;
    const result = await grader.grade(submission);
    if (!result.success) return NextResponse.json(result);
    const progress = await completeLabStep(session.user.id, lab, step.id, {
      kind: "graded",
      graderId: grader.id,
      graderVersion: grader.version,
    });
    return NextResponse.json({ ...result, progress });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_LAB_SUBMISSION" }, { status: 400 });
    }
    if (error instanceof LabStepCompletionError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    console.error("Lab grading failed", error);
    return NextResponse.json({ error: "LAB_GRADING_UNAVAILABLE" }, { status: 503 });
  }
}
