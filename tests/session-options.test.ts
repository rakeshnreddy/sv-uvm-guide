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

  it('throws error when SESSION_SECRET missing', async () => {
    await expect(loadModule()).rejects.toThrow('SESSION_SECRET must be set to ensure secure sessions.');
  });
});
