import { getSession } from '@/lib/session';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

export async function SessionProvider({ children }: { children: ReactNode }) {
  const session = await getSession();
  const userId = session.userId;

  return <AuthProvider userId={userId}>{children}</AuthProvider>;
}
