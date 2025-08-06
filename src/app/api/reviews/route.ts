import { NextResponse } from 'next/server';
import { addReview, Review } from '@/server/reviews';

export async function POST(request: Request) {
  let body: Partial<Review>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { commitId, comment, approved } = body;
  if (!commitId || typeof commitId !== 'string') {
    return NextResponse.json({ error: 'commitId is required' }, { status: 400 });
  }

  addReview({ commitId, comment, approved });
  return NextResponse.json({ message: 'Review stored' }, { status: 201 });
}
