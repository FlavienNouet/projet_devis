import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { findUserById, listPublicUsers } from '@/lib/user-store';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const persistedUser = await findUserById(sessionUser.id);

  if (!persistedUser || persistedUser.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé à l\'administrateur.' }, { status: 403 });
  }

  const users = await listPublicUsers();
  return NextResponse.json({ users });
}
