import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { createInvoice, findConvertedInvoiceByQuoteId, findInvoiceByIdForUser, listInvoicesByUser } from '@/lib/invoice-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id } = await context.params;
  const sourceQuote = await findInvoiceByIdForUser(sessionUser.id, id);

  if (!sourceQuote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  if (sourceQuote.documentType !== 'quote') {
    return NextResponse.json({ error: 'Seuls les devis peuvent être révisés.' }, { status: 400 });
  }

  if (sourceQuote.status === 'accepted') {
    return NextResponse.json(
      { error: 'Ce devis est accepté et ne peut plus être modifié.' },
      { status: 409 }
    );
  }

  const existingConvertedInvoice = await findConvertedInvoiceByQuoteId(sessionUser.id, sourceQuote.id);
  if (existingConvertedInvoice) {
    return NextResponse.json(
      { error: 'Ce devis est déjà facturé et ne peut plus être révisé.' },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();

    const revisedTotal = typeof body.revisedTotal === 'number' && Number.isFinite(body.revisedTotal)
      ? body.revisedTotal
      : null;
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (revisedTotal === null || revisedTotal < 0) {
      return NextResponse.json({ error: 'Montant de révision invalide.' }, { status: 400 });
    }

    const rootQuoteId = sourceQuote.sourceQuoteId || sourceQuote.id;
    const allDocuments = await listInvoicesByUser(sessionUser.id);

    const rootQuote = allDocuments.find((doc) => doc.id === rootQuoteId) || sourceQuote;

    const quoteVersions = allDocuments.filter(
      (doc) => doc.documentType === 'quote' && (doc.id === rootQuoteId || doc.sourceQuoteId === rootQuoteId)
    );

    const revisionCount = Math.max(0, quoteVersions.length - 1);
    const nextRevisionNumber = revisionCount + 1;

    const baseNumber = rootQuote.quoteNumber.split('-NEGO-')[0];
    const revisedQuoteNumber = `${baseNumber}-NEGO-${nextRevisionNumber}`;

    const revisedQuote = {
      id: crypto.randomUUID(),
      userId: sourceQuote.userId,
      clientId: sourceQuote.clientId,
      clientName: sourceQuote.clientName,
      items: sourceQuote.items,
      total: revisedTotal,
      quoteNumber: revisedQuoteNumber,
      issueDate: new Intl.DateTimeFormat('fr-FR').format(new Date()),
      status: 'sent' as const,
      documentType: 'quote' as const,
      sourceQuoteId: rootQuoteId,
      negotiationNote: note,
      locationAddress: sourceQuote.locationAddress,
      locationLat: sourceQuote.locationLat,
      locationLng: sourceQuote.locationLng,
      signatureName: sourceQuote.signatureName,
      createdAt: new Date().toISOString(),
    };

    await createInvoice(revisedQuote);

    return NextResponse.json({ quote: revisedQuote }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la création du devis révisé.' }, { status: 500 });
  }
}
