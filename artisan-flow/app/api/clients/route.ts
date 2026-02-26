import { NextResponse } from 'next/server';
import { createClient, findClientByNameForUser, listClientsByUser } from '@/lib/client-store';
import { listInvoicesByUser } from '@/lib/invoice-store';
import { getSessionUserOrNull } from '@/lib/auth-server';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const [clients, invoices] = await Promise.all([
    listClientsByUser(sessionUser.id),
    listInvoicesByUser(sessionUser.id),
  ]);

  const enrichedClients = clients.map((client) => {
    const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);

    return {
      ...client,
      invoiceCount: clientInvoices.length,
      lastInvoiceAt: clientInvoices[0]?.createdAt || null,
    };
  });

  return NextResponse.json({ clients: enrichedClients });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Le nom client est obligatoire.' }, { status: 400 });
    }

    const alreadyExists = await findClientByNameForUser(sessionUser.id, name);
    if (alreadyExists) {
      return NextResponse.json({ error: 'Ce client existe déjà.' }, { status: 409 });
    }

    const newClient = {
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      name,
      email,
      phone,
      notes,
      createdAt: new Date().toISOString(),
    };

    await createClient(newClient);

    return NextResponse.json({ client: { ...newClient, invoiceCount: 0, lastInvoiceAt: null } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la création du client.' }, { status: 500 });
  }
}
