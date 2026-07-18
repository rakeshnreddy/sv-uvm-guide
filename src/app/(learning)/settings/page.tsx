import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/tools/featureFlags';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveNotificationPreferences } from '@/lib/notifications';
import {
  normalizeUserPreferences,
  type PartialUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!isFeatureEnabled('accountUI')) {
    notFound();
  }

  let initialPreferences: UserPreferences = normalizeUserPreferences(null);

  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    const defaultNotifications = resolveNotificationPreferences();
    initialPreferences = normalizeUserPreferences(
      user?.preferences as PartialUserPreferences | null,
      defaultNotifications,
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SettingsPage: falling back to default preferences', error);
    }
  }

  const SettingsPageClient = (await import('./SettingsPageClient')).default;
  return <SettingsPageClient initialPreferences={initialPreferences} />;
}
