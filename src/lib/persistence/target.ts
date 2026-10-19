'use client';

/**
 * The account seam for client islands: who is signed in, where learner records
 * live, and whether an account-only server feature may be shown.
 *
 * The implementation is chosen once, at module level, from the build-time
 * ACCOUNTS_ENABLED switch:
 * - Accounts off (this deploy): every hook returns a frozen module-level
 *   constant and never calls useSession, so no SessionProvider is needed and
 *   nothing requests /api/auth/*.
 * - Accounts on: the hooks read next-auth's useSession (SessionProvider is
 *   mounted by ClientProviders). Until hydration finishes they report no
 *   session ('loading', target 'local' with ready false, features false), so
 *   the server render and the hydrating render always match.
 *
 * Even signed in, the target stays 'local' while SERVER_SYNC_READY is false:
 * learner records keep living in this browser until POST /api/me/import exists.
 *
 * Only this module, src/contexts/AuthContext.tsx and
 * src/components/providers/SessionProvider.tsx may import 'next-auth/react'.
 */
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';

import { useHydrated } from '@/lib/learner-store/react';
import { ACCOUNTS_ENABLED, SERVER_SYNC_READY } from '@/lib/persistence/accounts';
import { SITE_FEATURES } from '@/lib/site-features';

export type AccountSessionStatus = 'disabled' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AccountSession {
  /** 'disabled' when accounts are off; with accounts on, 'loading' until hydration and the session check finish. */
  readonly status: AccountSessionStatus;
  /** The signed-in user's id; null unless status is 'authenticated'. */
  readonly userId: string | null;
}

export type PersistenceTargetKind = 'local' | 'server';

export interface PersistenceTarget {
  /** 'server' only when ACCOUNTS_ENABLED && SERVER_SYNC_READY && signed in. */
  readonly target: PersistenceTargetKind;
  /** False while the session is still loading; wait for it before choosing a store. */
  readonly ready: boolean;
}

/** Account-only server features. 'notifications' follows SITE_FEATURES.accounts. */
export type ServerFeature = 'aiTutor' | 'simulation' | 'notifications';

const DISABLED_SESSION: AccountSession = Object.freeze({ status: 'disabled', userId: null });
const LOADING_SESSION: AccountSession = Object.freeze({ status: 'loading', userId: null });
const SIGNED_OUT_SESSION: AccountSession = Object.freeze({ status: 'unauthenticated', userId: null });

const LOCAL_TARGET: PersistenceTarget = Object.freeze({ target: 'local', ready: true });
const PENDING_TARGET: PersistenceTarget = Object.freeze({ target: 'local', ready: false });
const SERVER_TARGET: PersistenceTarget = Object.freeze({ target: 'server', ready: true });

function serverFeatureSwitch(feature: ServerFeature): boolean {
  return feature === 'notifications' ? SITE_FEATURES.accounts : SITE_FEATURES[feature];
}

// --- Accounts off ----------------------------------------------------------

function useAnonymousAccountSession(): AccountSession {
  return DISABLED_SESSION;
}

function useAnonymousPersistenceTarget(): PersistenceTarget {
  return LOCAL_TARGET;
}

function useAnonymousServerFeature(feature: ServerFeature): boolean {
  void feature;
  return false;
}

// --- Accounts on -----------------------------------------------------------

function useSessionAccountSession(): AccountSession {
  const hydrated = useHydrated();
  const { data, status } = useSession();
  const userId = data?.user?.id || null;
  return useMemo(() => {
    if (!hydrated || status === 'loading') return LOADING_SESSION;
    if (status === 'authenticated' && userId) return Object.freeze({ status: 'authenticated', userId });
    return SIGNED_OUT_SESSION;
  }, [hydrated, status, userId]);
}

function useSessionPersistenceTarget(): PersistenceTarget {
  const { status } = useSessionAccountSession();
  if (status === 'loading') return PENDING_TARGET;
  if (SERVER_SYNC_READY && status === 'authenticated') return SERVER_TARGET;
  return LOCAL_TARGET;
}

function useSessionServerFeature(feature: ServerFeature): boolean {
  const { status } = useSessionAccountSession();
  return serverFeatureSwitch(feature) && status === 'authenticated';
}

// --- The hooks -------------------------------------------------------------

/** {status, userId}: 'disabled' with accounts off; otherwise 'loading', 'authenticated' or 'unauthenticated'. */
export const useAccountSession: () => AccountSession = ACCOUNTS_ENABLED
  ? useSessionAccountSession
  : useAnonymousAccountSession;

/** Where learner records live: {target:'local', ready:true} unless accounts, server sync and a session are all present. */
export const usePersistenceTarget: () => PersistenceTarget = ACCOUNTS_ENABLED
  ? useSessionPersistenceTarget
  : useAnonymousPersistenceTarget;

/** True only when the feature's SITE_FEATURES switch is on and a learner is signed in. Gate account-only controls on it. */
export const useServerFeature: (feature: ServerFeature) => boolean = ACCOUNTS_ENABLED
  ? useSessionServerFeature
  : useAnonymousServerFeature;
