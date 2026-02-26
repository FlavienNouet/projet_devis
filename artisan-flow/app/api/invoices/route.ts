import { NextResponse } from 'next/server';
import { createInvoice, listInvoicesByUser, type StoredInvoiceItem } from '@/lib/invoice-store';
import { getSessionUserOrNull } from '@/lib/auth-server';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const invoices = await listInvoicesByUser(sessionUser.id);
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const quoteNumber = typeof body.quoteNumber === 'string' ? body.quoteNumber : '0000';
    const issueDate = typeof body.issueDate === 'string' ? body.issueDate : new Intl.DateTimeFormat('fr-FR').format(new Date());

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
    const items: StoredInvoiceItem[] = rawItems
      .map((item: unknown): StoredInvoiceItem => {
        const value = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;

        return {
          designation: typeof value.designation === 'string' ? value.designation.trim() : '',
          prix: Number(value.prix) || 0,
          qty: Number(value.qty) || 0,
        };
      })
      .filter((item: StoredInvoiceItem) => item.designation);

    if (!clientName || items.length === 0) {
      return NextResponse.json({ error: 'Données de devis invalides.' }, { status: 400 });
    }

    const total = items.reduce((accumulator: number, item: StoredInvoiceItem) => accumulator + item.prix * item.qty, 0);

    const invoice = {
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      clientId,
      clientName,
      items,
      total,
      quoteNumber,
      issueDate,
      createdAt: new Date().toISOString(),
    };

    await createInvoice(invoice);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la sauvegarde du devis.' }, { status: 500 });
  }
}
