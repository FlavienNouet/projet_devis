import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { createInvoice, deleteInvoiceByIdForUser, findConvertedInvoiceByQuoteId, findInvoiceByIdForUser, updateInvoiceByIdForUser } from '@/lib/invoice-store';
import { getNextDocumentNumber } from '@/lib/document-numbering';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const allowedStatuses = new Set(['sent', 'accepted', 'rejected']);
const allowedPaymentStatuses = new Set(['unpaid', 'partial', 'paid']);

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id } = await context.params;

  const existingDocument = await findInvoiceByIdForUser(sessionUser.id, id);
  if (!existingDocument) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }

  if (existingDocument.documentType === 'quote') {
    if (existingDocument.status === 'accepted') {
      return NextResponse.json(
        { error: 'Ce devis est accepté et ne peut plus être modifié.' },
        { status: 409 }
      );
    }

    const existingConvertedInvoice = await findConvertedInvoiceByQuoteId(sessionUser.id, id);
    if (existingConvertedInvoice) {
      return NextResponse.json(
        { error: 'Ce devis est déjà facturé et ne peut plus être modifié.' },
        { status: 409 }
      );
    }
  }

  try {
    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status : undefined;
    const negotiatedTotal = typeof body.negotiatedTotal === 'number' && Number.isFinite(body.negotiatedTotal)
      ? body.negotiatedTotal
      : undefined;
    const negotiationNote = typeof body.negotiationNote === 'string'
      ? body.negotiationNote.trim()
      : undefined;
    const paymentStatus = typeof body.paymentStatus === 'string' ? body.paymentStatus : undefined;
    const paidAmount = typeof body.paidAmount === 'number' && Number.isFinite(body.paidAmount)
      ? body.paidAmount
      : undefined;
    const paidDate = typeof body.paidDate === 'string' ? body.paidDate : undefined;

    if (status !== undefined && !allowedStatuses.has(status)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }

    if (paymentStatus !== undefined && !allowedPaymentStatuses.has(paymentStatus)) {
      return NextResponse.json({ error: 'Statut de paiement invalide.' }, { status: 400 });
    }

    if (negotiatedTotal !== undefined && negotiatedTotal < 0) {
      return NextResponse.json({ error: 'Le montant négocié ne peut pas être négatif.' }, { status: 400 });
    }

    if (paidAmount !== undefined && paidAmount < 0) {
      return NextResponse.json({ error: 'Le montant encaissé ne peut pas être négatif.' }, { status: 400 });
    }

    if (
      status === undefined
      && negotiatedTotal === undefined
      && negotiationNote === undefined
      && paymentStatus === undefined
      && paidAmount === undefined
      && paidDate === undefined
    ) {
      return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
    }

    const updatePayload: {
      status?: 'sent' | 'accepted' | 'rejected';
      negotiatedTotal?: number;
      negotiationNote?: string;
      paymentStatus?: 'unpaid' | 'partial' | 'paid';
      paidAmount?: number;
      paidDate?: string;
    } = {};

    if (existingDocument.documentType === 'quote') {
      if (status !== undefined) {
        updatePayload.status = status as 'sent' | 'accepted' | 'rejected';
      }

      if (negotiatedTotal !== undefined) {
        updatePayload.negotiatedTotal = negotiatedTotal;
      }

      if (negotiationNote !== undefined) {
        updatePayload.negotiationNote = negotiationNote;
      }
    } else {
      const normalizedPaidAmount = paidAmount ?? existingDocument.paidAmount ?? 0;
      const isZeroTotalInvoice = existingDocument.total <= 0;
      const today = new Intl.DateTimeFormat('fr-FR').format(new Date());
      let normalizedPaymentStatus = (paymentStatus as 'unpaid' | 'partial' | 'paid' | undefined)
        ?? existingDocument.paymentStatus
        ?? 'unpaid';

      if (isZeroTotalInvoice) {
        if (normalizedPaymentStatus === 'partial') {
          return NextResponse.json({ error: 'Une facture à 0 € ne peut pas être partiellement payée.' }, { status: 400 });
        }

        updatePayload.paidAmount = 0;
        updatePayload.paidDate = normalizedPaymentStatus === 'paid'
          ? (paidDate || existingDocument.paidDate || today)
          : '';
      } else if (normalizedPaymentStatus === 'unpaid') {
        updatePayload.paidAmount = 0;
        updatePayload.paidDate = '';
      } else if (normalizedPaymentStatus === 'paid') {
        updatePayload.paidAmount = existingDocument.total;
        updatePayload.paidDate = paidDate || existingDocument.paidDate || today;
      } else {
        const boundedPaidAmount = Math.min(existingDocument.total, Math.max(0, normalizedPaidAmount));

        if (boundedPaidAmount <= 0 || boundedPaidAmount >= existingDocument.total) {
          return NextResponse.json({ error: 'Pour partiellement payée, le montant encaissé doit être entre 0 et le total.' }, { status: 400 });
        }

        updatePayload.paidAmount = boundedPaidAmount;
        updatePayload.paidDate = paidDate || existingDocument.paidDate || today;
      }

      if (isZeroTotalInvoice) {
        normalizedPaymentStatus = normalizedPaymentStatus === 'unpaid' ? 'unpaid' : 'paid';
      } else if (updatePayload.paidAmount === 0) {
        normalizedPaymentStatus = 'unpaid';
      } else if ((updatePayload.paidAmount ?? 0) >= existingDocument.total) {
        normalizedPaymentStatus = 'paid';
      } else {
        normalizedPaymentStatus = 'partial';
      }

      if (normalizedPaymentStatus === 'unpaid') {
        updatePayload.paidDate = '';
      }

      updatePayload.paymentStatus = normalizedPaymentStatus;
    }

    const invoice = await updateInvoiceByIdForUser(sessionUser.id, id, updatePayload);

    if (!invoice) {
      return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
    }

    if (invoice.documentType === 'quote' && status === 'accepted' && invoice.status === 'accepted') {
      const existingConvertedInvoice = await findConvertedInvoiceByQuoteId(sessionUser.id, invoice.id);

      if (existingConvertedInvoice) {
        return NextResponse.json({
          invoice,
          convertedToInvoice: false,
          convertedInvoiceAlreadyExists: true,
        });
      }

      const invoiceNumber = await getNextDocumentNumber('invoice');

      const convertedInvoice = {
        id: crypto.randomUUID(),
        userId: invoice.userId,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        items: invoice.items,
        total: invoice.negotiatedTotal ?? invoice.total,
        quoteNumber: invoiceNumber,
        issueDate: new Intl.DateTimeFormat('fr-FR').format(new Date()),
        status: 'sent' as const,
        documentType: 'invoice' as const,
        sourceQuoteId: invoice.id,
        paymentStatus: (invoice.negotiatedTotal ?? invoice.total) <= 0 ? 'paid' as const : 'unpaid' as const,
        paidAmount: 0,
        paidDate: (invoice.negotiatedTotal ?? invoice.total) <= 0
          ? new Intl.DateTimeFormat('fr-FR').format(new Date())
          : '',
        negotiationNote: invoice.negotiationNote,
        locationAddress: invoice.locationAddress,
        locationLat: invoice.locationLat,
        locationLng: invoice.locationLng,
        signatureName: invoice.signatureName,
        createdAt: new Date().toISOString(),
      };

      await createInvoice(convertedInvoice);

      return NextResponse.json({
        invoice,
        convertedToInvoice: true,
        convertedInvoice: convertedInvoice,
      });
    }

    return NextResponse.json({ invoice, convertedToInvoice: false });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la mise à jour du devis.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteInvoiceByIdForUser(sessionUser.id, id);

  if (!deleted) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
