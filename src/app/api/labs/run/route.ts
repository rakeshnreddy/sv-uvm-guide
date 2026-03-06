import { NextResponse } from 'next/server';
import { LAB_GRADERS } from '@/lib/lab-graders';

export async function POST(request: Request) {
  const { code, labId, stepId } = await request.json();

  if (!LAB_GRADERS[labId] || !LAB_GRADERS[labId][stepId]) {
    // If a lab exists but doesn't have a grader yet, just return success generically for unmigrated labs
    // but ideally the client should prevent submission if the lab is empty/coming_soon
    return NextResponse.json({ error: "Grader not found for this step" }, { status: 404 });
  }

  const result = LAB_GRADERS[labId][stepId](code);
  return NextResponse.json(result);
}
