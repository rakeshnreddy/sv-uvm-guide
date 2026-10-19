import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SITE_FEATURES } from '@/lib/site-features';
import { isServerPersistenceConfigured } from '@/server/persistence-gate';
import {
  deriveNotificationsFromEngagement,
  resolveNotificationPreferences,
  formatTimestamp,
  NOTIFICATION_CATEGORY_META,
  type NotificationItem,
} from '@/lib/notifications';
import { normalizeUserPreferences } from '@/lib/user-preferences';
import type { PartialUserPreferences } from '@/lib/user-preferences';

/*
 * Notifications exist only for signed-in learners, so the page renders only
 * while accounts are on (SITE_FEATURES.accounts). The route does not force a
 * dynamic render: with accounts off (this deploy) it prerenders as a static
 * 404 and costs no Worker render. With accounts on, the cookies() call below
 * opts that branch alone into a per-request render, and auth, Prisma and the
 * engagement queries are imported only there, once the persistence gate is
 * open. On a half-configured deploy (accounts on, isServerPersistenceConfigured()
 * false) /api/auth/signin answers 404, so the page offers no Sign in link then.
 */

const SIGN_IN_HREF = `/api/auth/signin?callbackUrl=${encodeURIComponent('/notifications')}`;

function NotificationsNotice({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Notifications</h1>
        {children}
      </header>
    </div>
  );
}

function renderSignedOut() {
  return (
    <NotificationsNotice>
      <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">Sign in to see your notifications.</p>
      {/* A plain link: NextAuth's sign-in page is not an app route, so it needs a full page load. */}
      <a
        href={SIGN_IN_HREF}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-[var(--blueprint-accent)] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign in
      </a>
    </NotificationsNotice>
  );
}

function renderSignInUnavailable() {
  return (
    <NotificationsNotice>
      <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
        Sign-in is not available on this site yet, so there are no notifications to show. Your progress is kept in this
        browser.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-[var(--blueprint-accent)] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Open your dashboard
      </Link>
    </NotificationsNotice>
  );
}

function renderUnavailable() {
  return (
    <NotificationsNotice>
      <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
        Your notifications could not be loaded. Try again in a moment.
      </p>
    </NotificationsNotice>
  );
}

/** requireSession() throws AuthenticationError (matched by name, so its module stays a lazy import) when nobody is signed in. */
function isSignedOutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AuthenticationError';
}

function NotificationsEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center">
      <p className="text-lg font-semibold text-[var(--blueprint-foreground)]">Inbox is quiet</p>
      <p className="mt-2 text-sm text-[rgba(230,241,255,0.7)]">
        You are fully caught up. New lessons, review requests, and reminders will appear here as soon as activity resumes.
      </p>
      <Link
        href="/curriculum"
        className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-[var(--blueprint-accent)] transition hover:bg-white/10"
      >
        Explore the curriculum
      </Link>
    </div>
  );
}

function NotificationCard({ notification }: { notification: NotificationItem }) {
  const meta = NOTIFICATION_CATEGORY_META[notification.category];

  return (
    <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6 transition hover:-translate-y-0.5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${meta?.badgeClass ?? 'bg-white/10 text-[rgba(230,241,255,0.8)]'}`}
          >
            {meta?.label ?? 'Update'}
          </span>
          <h3 className="text-lg font-semibold text-[var(--blueprint-foreground)]">{notification.title}</h3>
          <p className="text-sm text-[rgba(230,241,255,0.72)]">{notification.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-xs text-[rgba(230,241,255,0.55)]">
          <span>{formatTimestamp(notification.timestamp)}</span>
          {notification.priority === 'high' && (
            <span className="inline-flex items-center rounded-full border border-rose-400/40 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
              High priority
            </span>
          )}
        </div>
      </div>
      {notification.href && (
        <div className="mt-5 flex items-center justify-between text-xs text-[rgba(230,241,255,0.6)]">
          <span>Keep momentum by taking action now.</span>
          <Link href={notification.href} className="text-[var(--blueprint-accent)] hover:underline">
            View details
          </Link>
        </div>
      )}
    </article>
  );
}

export default async function NotificationsPage() {
  if (!SITE_FEATURES.accounts) {
    notFound();
  }

  // Outside any try/catch on purpose: reading the request cookies is what makes
  // this branch render per request, and Next signals that by throwing.
  cookies();

  // The gate reads the runtime environment, so check it only in this per-request branch.
  if (!isServerPersistenceConfigured()) {
    return renderSignInUnavailable();
  }

  const [{ requireSession }, { prisma }, { buildEngagementResponse }] = await Promise.all([
    import('@/lib/auth'),
    import('@/lib/prisma'),
    import('@/lib/engagement'),
  ]);

  let userId: string;
  let timeZone = 'UTC';
  let storedPreferences: PartialUserPreferences | null = null;
  try {
    const session = await requireSession();
    userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true, timeZone: true },
    });
    timeZone = user?.timeZone ?? 'UTC';
    storedPreferences = user?.preferences as PartialUserPreferences | null;
  } catch (error) {
    if (isSignedOutError(error)) {
      return renderSignedOut();
    }
    console.error('NotificationsPage: failed to load the account', error);
    return renderUnavailable();
  }
  const notificationPreferences = normalizeUserPreferences(
    storedPreferences,
    resolveNotificationPreferences(),
  ).notifications;
  const engagement = await buildEngagementResponse(userId, new Date(), timeZone);
  const notifications = deriveNotificationsFromEngagement(engagement, notificationPreferences);
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  const channelSummary = [
    notificationPreferences.channels.inApp ? 'In-app' : null,
    notificationPreferences.channels.email ? 'Email' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-8">
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Notifications</h1>
            <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
              Stay on top of lesson completions, reviewer hand-offs, and community activity. Preferences below control which
              nudges arrive in your inbox.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center text-xs text-[rgba(230,241,255,0.7)] sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-lg font-semibold text-[var(--blueprint-foreground)]">{notifications.length}</p>
              <p>Total items</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-lg font-semibold text-[var(--blueprint-foreground)]">{unreadCount}</p>
              <p>Unread</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-lg font-semibold text-[var(--blueprint-foreground)]">{notificationPreferences.digest}</p>
              <p>Digest cadence</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-lg font-semibold text-[var(--blueprint-foreground)]">
                {notificationPreferences.quietHours
                  ? `${notificationPreferences.quietHours.start}–${notificationPreferences.quietHours.end}`
                  : 'Off'}
              </p>
              <p>Quiet hours</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {notifications.length === 0 ? (
            <NotificationsEmptyState />
          ) : (
            notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          )}
        </div>

        <aside className="space-y-4 lg:col-span-2">
          <div className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
            <h2 className="text-lg font-semibold text-[var(--blueprint-foreground)]">Preferences snapshot</h2>
            <p className="mt-2 text-xs text-[rgba(230,241,255,0.65)]">
              These settings are seeded from the prototype profile. Edit them in the settings panel once persistence ships.
            </p>
            <ul className="mt-5 space-y-3 text-sm text-[rgba(230,241,255,0.75)]">
              {Object.entries(notificationPreferences.categories).map(([key, enabled]) => {
                const meta = NOTIFICATION_CATEGORY_META[key as keyof typeof NOTIFICATION_CATEGORY_META];
                return (
                  <li key={key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${enabled ? 'bg-[var(--blueprint-accent)]' : 'bg-white/20'}`}
                        aria-hidden="true"
                      />
                      {meta?.label ?? key}
                    </span>
                    <span className={`text-xs ${enabled ? 'text-[var(--blueprint-accent)]' : 'text-[rgba(230,241,255,0.4)]'}`}>
                      {enabled ? 'Enabled' : 'Muted'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
            <h2 className="text-lg font-semibold text-[var(--blueprint-foreground)]">Delivery schedule</h2>
            <p className="mt-2 text-sm text-[rgba(230,241,255,0.7)]">
              {channelSummary || 'Notifications are currently paused.'}
            </p>
            <p className="mt-3 text-xs text-[rgba(230,241,255,0.55)]">
              Daily digests surface review assignments and community replies in your inbox, while high-priority items still
              send instantaneous nudges.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs text-[var(--blueprint-accent)] transition hover:bg-white/10"
            >
              Adjust preferences
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
