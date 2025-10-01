import { describe, it, expect } from 'vitest';

describe('connectCollaboration SSR fallback', () => {
  it('returns null when WebSocket is unavailable', async () => {
    const originalWindowWebSocket = window.WebSocket;
    const originalGlobalWebSocket = globalThis.WebSocket;

    try {
      (window as unknown as { WebSocket: typeof window.WebSocket | undefined }).WebSocket = undefined;
      (globalThis as unknown as { WebSocket: typeof globalThis.WebSocket | undefined }).WebSocket = undefined;

      const { connectCollaboration } = await import('@/lib/collaboration');
      expect(connectCollaboration('wss://example.test')).toBeNull();
    } finally {
      (window as unknown as { WebSocket: typeof window.WebSocket | undefined }).WebSocket = originalWindowWebSocket;
      (globalThis as unknown as { WebSocket: typeof globalThis.WebSocket | undefined }).WebSocket = originalGlobalWebSocket;
    }
  });
});
