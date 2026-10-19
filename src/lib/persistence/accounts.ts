/**
 * The account switches. Client-safe: this module imports nothing but the
 * build-time feature flags, so client islands, server components and route
 * handlers can all read it without pulling in auth or database code.
 */
import { isFeatureEnabled } from '@/tools/featureFlags';

/**
 * Accounts (sign-in, the account menu, notifications, account-only server
 * features) are on only when NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI is set at
 * build time. It stays false on the anonymous deploy, and then nothing
 * mounts SessionProvider or requests /api/auth/*.
 */
export const ACCOUNTS_ENABLED: boolean = isFeatureEnabled('accountUI');

/**
 * Whether signed-in learners may keep their records on the server instead of
 * in this browser.
 *
 * Flip this to true only once POST /api/me/import exists. That route receives
 * the learner-data export bundle on first sign-in, re-validates every entry
 * and re-grades lab evidence recorded with origin 'browser'. Until then even
 * signed-in learners keep every record in the browser, so turning accounts on
 * never hides local progress, and the dashboard always reads local data.
 */
export const SERVER_SYNC_READY = false as const;
