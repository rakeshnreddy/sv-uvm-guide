import { describe, it, expect, beforeEach } from 'vitest';
import { POST, getReviews, clearReviews, reviews } from '../../src/app/api/reviews/route';

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
    const reviewsRes = await getReviews();
    const reviewsJson = await reviewsRes.json();
    expect(reviewsJson).toContainEqual({ commitId: 'abcdef1', comment: 'good' });
  });

  it('rejects requests without commitId', async () => {
    const res = await POST(makeRequest({ comment: 'bad' }));
    expect(res.status).toBe(400);
  });
});
