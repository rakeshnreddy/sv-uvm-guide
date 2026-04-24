import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { runSimulation } from '@/server/simulation';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code, backend } = await request.json();
  try {
    const result = await runSimulation(code, backend);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
