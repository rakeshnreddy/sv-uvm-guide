import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';
import { getSession } from '@/lib/session';
import { resolveNotificationPreferences } from '@/lib/notifications';
import { normalizeUserPreferences, type UserPreferences } from '@/lib/user-preferences';

export default async function SettingsPage() {
  if (!isFeatureEnabled('accountUI')) {
    notFound();
  }

  let initialPreferences: UserPreferences = normalizeUserPreferences(null);

  try {
    const session = await getSession();
    const userId = session.userId ?? 'demo-user';
    const defaultNotifications = resolveNotificationPreferences(userId);
    initialPreferences = normalizeUserPreferences(session.preferences, defaultNotifications);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SettingsPage: falling back to default preferences', error);
    }
  }

  const SettingsPageClient = (await import('./SettingsPageClient')).default;
  return <SettingsPageClient initialPreferences={initialPreferences} />;
}
