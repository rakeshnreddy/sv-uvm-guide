import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers.js';
import { sessionOptions } from './session-options';

export interface SessionData {
  userId?: string;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
