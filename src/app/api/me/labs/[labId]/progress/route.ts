import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { getLabById } from "@/lib/lab-registry";
import { getLabProgress, saveLabProgress } from "@/server/labs";

export const dynamic = "force-dynamic";

const progressSchema = z.object({
  labVersion: z.string().min(1),
  currentStepId: z.string().nullable(),
  completedSteps: z.array(z.string()).max(100),
  fileBuffers: z.record(z.string().max(256 * 1024)),
}).strict().superRefine((value, context) => {
  if (Object.keys(value.fileBuffers).length > 24) {
    context.addIssue({ code: "custom", message: "Too many workspace files" });
  }
  const total = Object.values(value.fileBuffers).reduce((bytes, content) => bytes + Buffer.byteLength(content), 0);
  if (total > 1024 * 1024) context.addIssue({ code: "custom", message: "Workspace is too large" });
});

type RouteContext = { params: { labId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const session = await requireSession();
    const lab = getLabById(params.labId);
    if (!lab) return NextResponse.json({ error: "LAB_NOT_FOUND" }, { status: 404 });
    return NextResponse.json(await getLabProgress(session.user.id, lab));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json({ error: "LAB_PROGRESS_UNAVAILABLE" }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await requireSession();
    const lab = getLabById(params.labId);
    if (!lab) return NextResponse.json({ error: "LAB_NOT_FOUND" }, { status: 404 });
    const input = progressSchema.parse(await request.json());
    if (input.labVersion !== lab.version) {
      return NextResponse.json({ error: "LAB_VERSION_MISMATCH" }, { status: 409 });
    }

    const stepIds = new Set(lab.steps.map((step) => step.id));
    const editablePaths = new Set(lab.assets.filter((asset) => asset.editable).map((asset) => asset.path));
    if (
      (input.currentStepId && !stepIds.has(input.currentStepId)) ||
      input.completedSteps.some((step) => !stepIds.has(step)) ||
      Object.keys(input.fileBuffers).some((assetPath) => !editablePaths.has(assetPath))
    ) {
      return NextResponse.json({ error: "INVALID_LAB_PROGRESS" }, { status: 400 });
    }

    return NextResponse.json(await saveLabProgress(session.user.id, lab, input));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_LAB_PROGRESS" }, { status: 400 });
    }
    console.error("Lab progress persistence failed", error);
    return NextResponse.json({ error: "LAB_PROGRESS_UNAVAILABLE" }, { status: 503 });
  }
}
