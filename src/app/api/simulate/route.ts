import { NextResponse } from 'next/server';
import { runSimulation } from '@/server/simulation';

export async function POST(request: Request) {
  const { code, backend } = await request.json();
  try {
    const result = await runSimulation(code, backend);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
