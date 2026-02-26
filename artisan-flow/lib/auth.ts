import { SignJWT, jwtVerify } from 'jose';

export interface SessionUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
}

export const SESSION_COOKIE_NAME = 'artisan_flow_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const sessionSecret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'change-me-in-production-artisan-flow'
);

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET doit être défini en production.');
}

export const createSessionToken = async (user: SessionUser) => {
  return new SignJWT({
    sub: user.id,
    companyName: user.companyName,
    siret: user.siret,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret);
};

export const verifySessionToken = async (token: string): Promise<SessionUser | null> => {
  try {
    const { payload } = await jwtVerify(token, sessionSecret);

    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const companyName = typeof payload.companyName === 'string' ? payload.companyName : '';
    const siret = typeof payload.siret === 'string' ? payload.siret : '';
    const email = typeof payload.email === 'string' ? payload.email : '';

    if (!id || !companyName || !email) {
      return null;
    }

    return { id, companyName, siret, email };
  } catch {
    return null;
  }
};
