import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('api/labs/run route', () => {
  const loadPost = async () => {
    vi.resetModules();
    const mod = await import('@/app/api/labs/run/route');
    return mod.POST;
  };

  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-32-bytes-minimum');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs deterministic public lab graders without requiring a session', async () => {
    const POST = await loadPost();

    const request = new Request('http://localhost/api/labs/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'int myVar;',
        labId: 'basics-1',
        stepId: '1',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
  });

  it('returns a grader hint for incorrect code', async () => {
    const POST = await loadPost();

    const request = new Request('http://localhost/api/labs/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: '// missing declaration',
        labId: 'basics-1',
        stepId: '1',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.hint).toContain("declare a variable named 'myVar'");
  });
});
