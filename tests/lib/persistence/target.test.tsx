import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TargetModule = typeof import('@/lib/persistence/target');

const useSessionMock = vi.fn();

async function importTarget(options: { accounts: boolean; serverSyncReady?: boolean }): Promise<TargetModule> {
  vi.doMock('@/lib/persistence/accounts', () => ({
    ACCOUNTS_ENABLED: options.accounts,
    SERVER_SYNC_READY: options.serverSyncReady ?? false,
  }));
  vi.doMock('next-auth/react', () => ({ useSession: useSessionMock }));
  return import('@/lib/persistence/target');
}

function sessionValue(status: 'loading' | 'authenticated' | 'unauthenticated', userId?: string) {
  return {
    status,
    data: status === 'authenticated' ? { user: { id: userId ?? 'learner-1', name: 'Ada' }, expires: '2099-01-01' } : null,
    update: vi.fn(),
  };
}

describe('persistence target hooks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    useSessionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.doUnmock('@/lib/persistence/accounts');
    vi.doUnmock('next-auth/react');
    vi.unstubAllEnvs();
  });

  describe('with accounts off', () => {
    it('reports a disabled session, the local target and no server features without a SessionProvider', async () => {
      useSessionMock.mockImplementation(() => {
        throw new Error('useSession must not be called while accounts are off');
      });
      const { useAccountSession, usePersistenceTarget, useServerFeature } = await importTarget({ accounts: false });

      const { result } = renderHook(() => ({
        session: useAccountSession(),
        target: usePersistenceTarget(),
        aiTutor: useServerFeature('aiTutor'),
        simulation: useServerFeature('simulation'),
        notifications: useServerFeature('notifications'),
      }));

      expect(result.current.session).toEqual({ status: 'disabled', userId: null });
      expect(result.current.target).toEqual({ target: 'local', ready: true });
      expect(result.current.aiTutor).toBe(false);
      expect(result.current.simulation).toBe(false);
      expect(result.current.notifications).toBe(false);
      expect(useSessionMock).not.toHaveBeenCalled();
    });

    it('returns the same frozen objects on every render', async () => {
      const { useAccountSession, usePersistenceTarget } = await importTarget({ accounts: false });

      const { result, rerender } = renderHook(() => ({ session: useAccountSession(), target: usePersistenceTarget() }));
      const first = result.current;
      rerender();

      expect(result.current.session).toBe(first.session);
      expect(result.current.target).toBe(first.target);
      expect(Object.isFrozen(first.session)).toBe(true);
      expect(Object.isFrozen(first.target)).toBe(true);
    });

    it('works with the real accounts module and the default env', async () => {
      vi.doMock('next-auth/react', () => ({ useSession: useSessionMock }));
      const { useAccountSession, usePersistenceTarget } = await import('@/lib/persistence/target');

      const { result } = renderHook(() => ({ session: useAccountSession(), target: usePersistenceTarget() }));

      expect(result.current.session.status).toBe('disabled');
      expect(result.current.target).toEqual({ target: 'local', ready: true });
      expect(useSessionMock).not.toHaveBeenCalled();
    });
  });

  describe('with accounts on', () => {
    it('maps a loading session to loading, a pending local target and no features', async () => {
      useSessionMock.mockReturnValue(sessionValue('loading'));
      const { useAccountSession, usePersistenceTarget, useServerFeature } = await importTarget({ accounts: true });

      const { result } = renderHook(() => ({
        session: useAccountSession(),
        target: usePersistenceTarget(),
        notifications: useServerFeature('notifications'),
      }));

      expect(result.current.session).toEqual({ status: 'loading', userId: null });
      expect(result.current.target).toEqual({ target: 'local', ready: false });
      expect(result.current.notifications).toBe(false);
    });

    it('maps a signed-in session to its user id and keeps the local target while server sync is not ready', async () => {
      useSessionMock.mockReturnValue(sessionValue('authenticated', 'learner-42'));
      const { useAccountSession, usePersistenceTarget } = await importTarget({ accounts: true });

      const { result } = renderHook(() => ({ session: useAccountSession(), target: usePersistenceTarget() }));

      expect(result.current.session).toEqual({ status: 'authenticated', userId: 'learner-42' });
      expect(result.current.target).toEqual({ target: 'local', ready: true });
    });

    it('chooses the server target only when server sync is ready and the learner is signed in', async () => {
      useSessionMock.mockReturnValue(sessionValue('authenticated'));
      const { usePersistenceTarget } = await importTarget({ accounts: true, serverSyncReady: true });

      const { result, rerender } = renderHook(() => usePersistenceTarget());
      expect(result.current).toEqual({ target: 'server', ready: true });

      useSessionMock.mockReturnValue(sessionValue('unauthenticated'));
      rerender();
      expect(result.current).toEqual({ target: 'local', ready: true });
    });

    it('maps a signed-out session to unauthenticated and the local target', async () => {
      useSessionMock.mockReturnValue(sessionValue('unauthenticated'));
      const { useAccountSession, usePersistenceTarget, useServerFeature } = await importTarget({ accounts: true });

      const { result } = renderHook(() => ({
        session: useAccountSession(),
        target: usePersistenceTarget(),
        notifications: useServerFeature('notifications'),
      }));

      expect(result.current.session).toEqual({ status: 'unauthenticated', userId: null });
      expect(result.current.target).toEqual({ target: 'local', ready: true });
      expect(result.current.notifications).toBe(false);
    });

    it('treats a session without a user id as signed out', async () => {
      useSessionMock.mockReturnValue({ status: 'authenticated', data: { user: { name: 'No id' } }, update: vi.fn() });
      const { useAccountSession } = await importTarget({ accounts: true });

      const { result } = renderHook(() => useAccountSession());

      expect(result.current).toEqual({ status: 'unauthenticated', userId: null });
    });

    it('needs both the feature switch and a signed-in session for useServerFeature', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'true');
      useSessionMock.mockReturnValue(sessionValue('authenticated'));
      const { useServerFeature } = await importTarget({ accounts: true });

      const { result, rerender } = renderHook(() => ({
        aiTutor: useServerFeature('aiTutor'),
        simulation: useServerFeature('simulation'),
        notifications: useServerFeature('notifications'),
      }));

      expect(result.current).toEqual({ aiTutor: true, simulation: false, notifications: true });

      useSessionMock.mockReturnValue(sessionValue('unauthenticated'));
      rerender();
      expect(result.current).toEqual({ aiTutor: false, simulation: false, notifications: false });
    });

    it('keeps the same session object while the session does not change', async () => {
      useSessionMock.mockReturnValue(sessionValue('authenticated', 'learner-7'));
      const { useAccountSession } = await importTarget({ accounts: true });

      const { result, rerender } = renderHook(() => useAccountSession());
      const first = result.current;
      useSessionMock.mockReturnValue(sessionValue('authenticated', 'learner-7'));
      rerender();

      expect(result.current).toBe(first);
    });

    it('reports no session during the server render, so hydration matches', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'true');
      useSessionMock.mockReturnValue(sessionValue('authenticated'));
      const { useAccountSession, usePersistenceTarget, useServerFeature } = await importTarget({
        accounts: true,
        serverSyncReady: true,
      });

      function Probe() {
        const session = useAccountSession();
        const target = usePersistenceTarget();
        const aiTutor = useServerFeature('aiTutor');
        return <p>{`${session.status}|${target.target}|${String(target.ready)}|${String(aiTutor)}`}</p>;
      }

      expect(renderToString(<Probe />)).toContain('loading|local|false|false');
    });
  });
});
