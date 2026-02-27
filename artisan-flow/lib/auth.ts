import { SignJWT, jwtVerify } from 'jose';
import { parseBillingStatus, parsePlan, type BillingPlan, type BillingStatus } from '@/lib/plans';

export interface SessionUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
  role: 'admin' | 'user';
  plan: BillingPlan;
  billingStatus: BillingStatus;
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
    role: user.role,
    plan: user.plan,
    billingStatus: user.billingStatus,
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
    const role = payload.role === 'admin' ? 'admin' : 'user';
    const plan = parsePlan(typeof payload.plan === 'string' ? payload.plan : undefined);
    const billingStatus = parseBillingStatus(typeof payload.billingStatus === 'string' ? payload.billingStatus : undefined);

    if (!id || !companyName || !email) {
      return null;
    }

    return { id, companyName, siret, email, role, plan, billingStatus };
  } catch {
    return null;
  }
};
