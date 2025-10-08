import { NextResponse } from 'next/server';
import { buildEngagementResponse } from '@/lib/engagement';

export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const userId = params.userId ?? 'anonymous';
  const payload = buildEngagementResponse(userId);
  return NextResponse.json(payload);
}
