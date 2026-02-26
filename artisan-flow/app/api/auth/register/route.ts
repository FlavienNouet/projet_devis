import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { createUser, findUserByEmail } from '@/lib/user-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const siret = typeof body.siret === 'string' ? body.siret.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await createUser({
      id,
      companyName,
      siret,
      email,
      passwordHash,
      createdAt,
    });

    const sessionUser = { id, companyName, siret, email };
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
