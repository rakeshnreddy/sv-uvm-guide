import { NextResponse } from 'next/server';
import { featureFlags } from '@/tools/featureFlags';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(featureFlags);
}
