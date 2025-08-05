import { NextResponse } from 'next/server';
import { runSimulation } from '@/server/simulation';

export async function POST(request: Request) {
  const { code } = await request.json();
  try {
    const result = await runSimulation(code);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
