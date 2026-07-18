import { NextResponse } from 'next/server';
import { AuthenticationError, requireSession } from '@/lib/auth';
import { simulationJobs, simulationRequestSchema } from '@/server/simulation';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const submission = simulationRequestSchema.parse(await request.json());
    const job = await simulationJobs.enqueue(session.user.id, submission);

    return NextResponse.json(
      { jobId: job.id, status: job.status },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'INVALID_SUBMISSION' }, { status: 400 });
    }

    console.error('Unable to enqueue simulation job', error);
    return NextResponse.json({ error: 'SIMULATION_QUEUE_UNAVAILABLE' }, { status: 503 });
  }
}
