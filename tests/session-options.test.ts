import { describe, it, expect, afterEach, vi } from 'vitest';

const loadModule = async () => {
  vi.resetModules();
  return await import('@/lib/session-options');
};

describe('sessionOptions', () => {
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it('uses SESSION_SECRET when provided', async () => {
    process.env.SESSION_SECRET = 'secret';
    const mod = await loadModule();
    expect(mod.sessionOptions.password).toBe('secret');
  });

  it('falls back to test-secret when SESSION_SECRET missing', async () => {
    const mod = await loadModule();
    expect(mod.sessionOptions.password).toBe('test-secret');
  });
});
