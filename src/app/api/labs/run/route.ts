import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { graderRegistry, type LabSubmission } from "@/lib/lab-graders";
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
    if (submission.labVersion !== lab.version) {
      return NextResponse.json({ error: "LAB_VERSION_MISMATCH" }, { status: 409 });
    }

    const step = lab.steps.find((candidate) => candidate.id === submission.stepId);
    if (!step || step.version !== submission.stepVersion) {
      return NextResponse.json({ error: "LAB_STEP_VERSION_MISMATCH" }, { status: 409 });
    }
    if (step.completion !== "graded") {
      return NextResponse.json({ error: "LAB_STEP_IS_SELF_ATTESTED" }, { status: 409 });
    }
    const editablePaths = new Set(lab.assets.filter((asset) => asset.editable).map((asset) => asset.path));
    if (submission.files.some((file) => !editablePaths.has(file.path))) {
      return NextResponse.json({ error: "INVALID_SUBMISSION_FILE" }, { status: 400 });
    }
    if (!lab.graderId) return NextResponse.json({ error: "GRADER_NOT_CONFIGURED" }, { status: 404 });

    const grader = graderRegistry.get(lab.graderId);
    if (!grader) return NextResponse.json({ error: "GRADER_NOT_FOUND" }, { status: 503 });
    if (grader.requiresSandbox) {
      return NextResponse.json({ error: "GRADING_QUEUE_UNAVAILABLE" }, { status: 503 });
    }
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
