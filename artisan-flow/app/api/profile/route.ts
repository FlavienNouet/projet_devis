import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { updateUser } from '@/lib/user-store';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  return NextResponse.json({ user: sessionUser });
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const siret = typeof body.siret === 'string' ? body.siret.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!companyName) {
      return NextResponse.json({ error: 'Le nom de société est obligatoire.' }, { status: 400 });
    }

    const updatePayload: { companyName: string; siret: string; passwordHash?: string } = {
      companyName,
      siret,
    };

    if (password.trim()) {
      if (password.trim().length < 8) {
        return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
      }

      updatePayload.passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const updatedUser = await updateUser(sessionUser.id, updatePayload);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    const user = {
      id: updatedUser.id,
      companyName: updatedUser.companyName,
      siret: updatedUser.siret,
      email: updatedUser.email,
      role: updatedUser.role === 'admin' ? 'admin' as const : 'user' as const,
      plan: updatedUser.plan ?? 'free' as const,
      billingStatus: updatedUser.billingStatus ?? 'inactive' as const,
    };

    const refreshedToken = await createSessionToken(user);
    const response = NextResponse.json({ user });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la mise à jour du profil.' }, { status: 500 });
  }
}
