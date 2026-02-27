import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { createInvoice, findConvertedInvoiceByQuoteId, findInvoiceByIdForUser } from '@/lib/invoice-store';
import { getNextDocumentNumber } from '@/lib/document-numbering';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id } = await context.params;

  const sourceQuote = await findInvoiceByIdForUser(sessionUser.id, id);

  if (!sourceQuote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  if (sourceQuote.documentType === 'invoice') {
    return NextResponse.json({ error: 'Ce document est déjà une facture.' }, { status: 400 });
  }

  if (sourceQuote.status === 'rejected') {
    return NextResponse.json({ error: 'Un devis refusé ne peut pas être converti en facture.' }, { status: 409 });
  }

  const existingInvoice = await findConvertedInvoiceByQuoteId(sessionUser.id, sourceQuote.id);
  if (existingInvoice) {
    return NextResponse.json({ invoice: existingInvoice, alreadyExists: true });
  }

  const invoiceNumber = await getNextDocumentNumber('invoice');
  const invoiceTotal = sourceQuote.negotiatedTotal ?? sourceQuote.total;
  const isPaidByDefault = invoiceTotal <= 0;

  const invoice = {
    id: crypto.randomUUID(),
    userId: sourceQuote.userId,
    clientId: sourceQuote.clientId,
    clientName: sourceQuote.clientName,
    items: sourceQuote.items,
    total: invoiceTotal,
    vatRate: sourceQuote.vatRate ?? 20,
    quoteNumber: invoiceNumber,
    issueDate: new Intl.DateTimeFormat('fr-FR').format(new Date()),
    status: 'sent' as const,
    documentType: 'invoice' as const,
    sourceQuoteId: sourceQuote.id,
    paymentStatus: isPaidByDefault ? 'paid' as const : 'unpaid' as const,
    paidAmount: 0,
    paidDate: isPaidByDefault ? new Intl.DateTimeFormat('fr-FR').format(new Date()) : '',
    negotiationNote: sourceQuote.negotiationNote,
    locationAddress: sourceQuote.locationAddress,
    locationLat: sourceQuote.locationLat,
    locationLng: sourceQuote.locationLng,
    signatureName: sourceQuote.signatureName,
    createdAt: new Date().toISOString(),
  };

  await createInvoice(invoice);

  return NextResponse.json({ invoice }, { status: 201 });
}
