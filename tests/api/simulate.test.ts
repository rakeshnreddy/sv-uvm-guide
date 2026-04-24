import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/server/simulation', () => ({
  runSimulation: vi.fn().mockResolvedValue({ output: 'Simulation successful', passed: true }),
}));

describe('api/simulate route', () => {
  const loadPost = async () => {
    vi.resetModules();
    const mod = await import('@/app/api/simulate/route');
    return mod.POST;
  };

  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-32-bytes-minimum');
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 Unauthorized if no session is found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const POST = await loadPost();

    const request = new Request('http://localhost/api/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'module top; endmodule',
        backend: 'wasm',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
  });

  it('allows request if session is found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: 'Test User' } });
    const POST = await loadPost();

    const request = new Request('http://localhost/api/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'module top; endmodule',
        backend: 'wasm',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.output).toBe('Simulation successful');
  });
});
