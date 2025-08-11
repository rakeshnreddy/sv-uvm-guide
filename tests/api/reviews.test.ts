import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../src/app/api/reviews/route';
import { getReviews, clearReviews } from '../../src/server/reviews';

function makeRequest(body: any) {
  return new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/reviews', () => {
  beforeEach(() => {
    clearReviews();
  });

  it('stores reviews and returns 201', async () => {
    const res = await POST(makeRequest({ commitId: 'abcdef1', comment: 'good' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ message: 'Review recorded' });
    expect(getReviews()).toContainEqual({ commitId: 'abcdef1', comment: 'good' });
  });

  it('rejects requests without commitId', async () => {
    const res = await POST(makeRequest({ comment: 'bad' }));
    expect(res.status).toBe(400);
  });
});
