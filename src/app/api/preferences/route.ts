import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  normalizeUserPreferences,
  mergeUserPreferences,
  type PartialUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { resolveNotificationPreferences } from '@/lib/notifications';

function sanitizeUpdates(payload: unknown): PartialUserPreferences | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as PartialUserPreferences;
}

export async function GET() {
  const session = await getSession();
  const defaultNotifications = resolveNotificationPreferences(session.userId ?? 'demo-user');
  const preferences = normalizeUserPreferences(session.preferences, defaultNotifications);

  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const defaultNotifications = resolveNotificationPreferences(session.userId ?? 'demo-user');
  const currentPreferences = normalizeUserPreferences(session.preferences, defaultNotifications);

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const updates = sanitizeUpdates((body as { preferences?: unknown }).preferences ?? body);
  if (!updates) {
    return NextResponse.json({ error: 'Invalid preferences payload' }, { status: 400 });
  }

  const merged = mergeUserPreferences(currentPreferences, updates);
  merged.notifications.channels.inApp = true;

  session.preferences = merged as UserPreferences;
  await session.save();

  return NextResponse.json({ preferences: merged });
}
