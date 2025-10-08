import { NextResponse } from 'next/server';
import { buildEngagementResponse } from '@/lib/engagement';
import {
  deriveNotificationsFromEngagement,
  resolveNotificationPreferences,
} from '@/lib/notifications';
import { getSession } from '@/lib/session';
import { normalizeUserPreferences } from '@/lib/user-preferences';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const userId = params.userId ?? 'anonymous';
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const engagement = buildEngagementResponse(userId);
  const session = await getSession();
  const defaultNotifications = resolveNotificationPreferences(userId);
  const userPreferences = normalizeUserPreferences(session.preferences, defaultNotifications);
  const preferences = userPreferences.notifications;
  const notifications = deriveNotificationsFromEngagement(engagement, preferences, { limit });

  return NextResponse.json({
    notifications,
    preferences,
  });
}
