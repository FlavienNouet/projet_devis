import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, type SessionUser, verifySessionToken } from '@/lib/auth';

export const getSessionUserOrNull = async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
};
