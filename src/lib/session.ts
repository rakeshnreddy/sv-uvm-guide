import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers.js';
import { sessionOptions } from './session-options';
import type { UserPreferences } from './user-preferences';

export interface SessionData {
  userId?: string;
  preferences?: UserPreferences;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
