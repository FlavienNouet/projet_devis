import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { deleteUserByIdForAdmin, findUserById } from '@/lib/user-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const persistedUser = await findUserById(sessionUser.id);

  if (!persistedUser || persistedUser.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé à l\'administrateur.' }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await deleteUserByIdForAdmin(sessionUser.id, id);

  if (!result.success) {
    if (result.reason === 'self') {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte admin.' }, { status: 400 });
    }

    if (result.reason === 'protected') {
      return NextResponse.json({ error: 'Le compte admin principal ne peut pas être supprimé.' }, { status: 409 });
    }

    if (result.reason === 'not-found') {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
