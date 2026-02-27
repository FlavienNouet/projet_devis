import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { createUser, findUserByEmail, getDefaultPlanForNewUser, getDefaultRoleForNewUser } from '@/lib/user-store';
import { enforceRateLimit } from '@/lib/rate-limit';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'auth-register', REGISTER_MAX_ATTEMPTS, REGISTER_WINDOW_MS);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfterSeconds}s.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const body = await request.json();

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const siret = typeof body.siret === 'string' ? body.siret.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.` }, { status: 400 });
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json({ error: `Le mot de passe doit contenir au maximum ${PASSWORD_MAX_LENGTH} caractères.` }, { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const role = await getDefaultRoleForNewUser(email);
    const plan = await getDefaultPlanForNewUser(email);
    const billingStatus = plan === 'free' ? 'inactive' as const : 'active' as const;

    await createUser({
      id,
      companyName,
      siret,
      email,
      passwordHash,
      role,
      plan,
      billingStatus,
      createdAt,
    });

    const sessionUser = { id, companyName, siret, email, role, plan, billingStatus };
    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ user: sessionUser }, { status: 201 });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant l\'inscription.' }, { status: 500 });
  }
}
