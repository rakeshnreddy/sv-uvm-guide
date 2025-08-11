import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/reviews/route';
import { getReviews, clearReviews } from '@/server/reviews';

function createRequest(body: any) {
  return new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Reviews API', () => {
  beforeEach(() => {
    clearReviews();
  });

  it('stores review successfully', async () => {
    const req = createRequest({ commitId: 'abc1234', comment: 'Looks good', approved: true });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toEqual({ message: 'Review recorded' });
    expect(getReviews()).toContainEqual({ commitId: 'abc1234', comment: 'Looks good', approved: true });
  });

  it('returns 400 when commitId is missing', async () => {
    const req = createRequest({ comment: 'Missing commitId' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
