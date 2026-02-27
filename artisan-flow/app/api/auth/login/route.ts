import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { findUserByEmail } from '@/lib/user-store';
import { enforceRateLimit } from '@/lib/rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, 'auth-login', LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);

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

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Veuillez renseigner email et mot de passe.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      companyName: user.companyName,
      siret: user.siret,
      email: user.email,
      role: user.role === 'admin' ? 'admin' as const : 'user' as const,
      plan: user.plan ?? 'free' as const,
      billingStatus: user.billingStatus ?? 'inactive' as const,
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ user: sessionUser });

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
  } catch (error) {
    console.error('Erreur login /api/auth/login:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    const debugHint =
      errorMessage.toLowerCase().includes('prisma')
      || errorMessage.toLowerCase().includes('column')
      || errorMessage.toLowerCase().includes('database')
        ? 'Vérifiez la synchronisation Prisma: npm run db:push puis redémarrez le serveur.'
        : undefined;

    return NextResponse.json(
      {
        error: 'Erreur serveur pendant la connexion.',
        detail: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        hint: process.env.NODE_ENV === 'development' ? debugHint : undefined,
      },
      { status: 500 }
    );
  }
}
