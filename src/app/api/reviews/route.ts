import { NextResponse } from 'next/server';


interface Review {
  commitId: string;
  comment?: string;
  approved?: boolean;
}

const reviews: Review[] = [];

export async function GET() {
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }


  const { commitId, comment, approved } = data ?? {};
  if (!commitId || typeof commitId !== 'string') {
    return NextResponse.json({ error: 'commitId is required' }, { status: 400 });
  }
  const shaRegex = /^[0-9a-f]{7,40}$/i;
  if (!shaRegex.test(commitId)) {
    return NextResponse.json({ error: 'Invalid commitId' }, { status: 400 });
  }

  const record: Review = { commitId };
  if (typeof comment === 'string') {
    record.comment = comment;
  }
  if (typeof approved === 'boolean') {
    record.approved = approved;
  }
  reviews.push(record);
  return NextResponse.json({ message: 'Review recorded' }, { status: 201 });
}
