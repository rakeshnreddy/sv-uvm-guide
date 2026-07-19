import { NextResponse } from "next/server";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { simulationJobs } from "@/server/simulation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const session = await requireSession();
    const job = await simulationJobs.getForUser(session.user.id, params.jobId);

    if (!job) {
      return NextResponse.json({ error: "SIMULATION_JOB_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("Unable to load simulation job", error);
    return NextResponse.json({ error: "SIMULATION_STATUS_UNAVAILABLE" }, { status: 503 });
  }
}
