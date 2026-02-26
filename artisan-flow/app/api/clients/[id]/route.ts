import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { deleteClientByIdForUser } from '@/lib/client-store';
import { deleteInvoicesByClientIdForUser } from '@/lib/invoice-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Identifiant client manquant.' }, { status: 400 });
  }

  const deleted = await deleteClientByIdForUser(sessionUser.id, id);

  if (!deleted) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
  }

  const deletedInvoices = await deleteInvoicesByClientIdForUser(sessionUser.id, id);

  return NextResponse.json({ success: true, deletedInvoices });
}
