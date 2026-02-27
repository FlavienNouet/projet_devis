import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface StoredInvoiceItem {
  designation: string;
  prix: number;
  qty: number;
}

export interface StoredInvoice {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  items: StoredInvoiceItem[];
  total: number;
  vatRate?: number;
  negotiatedTotal?: number;
  negotiationNote?: string;
  quoteNumber: string;
  issueDate: string;
  status: 'sent' | 'accepted' | 'rejected';
  documentType: 'quote' | 'invoice';
  sourceQuoteId?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  paidAmount?: number;
  paidDate?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  signatureName?: string;
  createdAt: string;
}

const normalizeStatus = (status: unknown): StoredInvoice['status'] => {
  if (status === 'accepted') return 'accepted';
  if (status === 'rejected') return 'rejected';
  return 'sent';
};

const toStoredInvoice = (invoice: {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  items: Prisma.JsonValue;
  total: number;
  vatRate: number;
  negotiatedTotal: number | null;
  negotiationNote: string | null;
  quoteNumber: string;
  issueDate: string;
  status: string;
  documentType: string;
  sourceQuoteId: string | null;
  paymentStatus: string | null;
  paidAmount: number | null;
  paidDate: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  signatureName: string | null;
  createdAt: Date;
}): StoredInvoice => {
  const parsedItems = Array.isArray(invoice.items)
    ? invoice.items
        .map((item): StoredInvoiceItem | null => {
          if (!item || typeof item !== 'object') return null;

          const value = item as Record<string, unknown>;
          const designation = typeof value.designation === 'string' ? value.designation : '';
          const prix = typeof value.prix === 'number' ? value.prix : 0;
          const qty = typeof value.qty === 'number' ? value.qty : 0;

          return { designation, prix, qty };
        })
        .filter((item): item is StoredInvoiceItem => Boolean(item))
    : [];

  return {
    id: invoice.id,
    userId: invoice.userId,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    items: parsedItems,
    total: invoice.total,
    vatRate: Number.isFinite(invoice.vatRate) ? invoice.vatRate : 20,
    negotiatedTotal: invoice.negotiatedTotal ?? undefined,
    negotiationNote: invoice.negotiationNote ?? undefined,
    quoteNumber: invoice.quoteNumber,
    issueDate: invoice.issueDate,
    status: normalizeStatus(invoice.status),
    documentType: invoice.documentType === 'invoice' ? 'invoice' : 'quote',
    sourceQuoteId: invoice.sourceQuoteId ?? undefined,
    paymentStatus: invoice.documentType === 'invoice'
      ? (invoice.paymentStatus === 'paid'
        ? 'paid'
        : invoice.paymentStatus === 'partial'
          ? 'partial'
          : 'unpaid')
      : undefined,
    paidAmount: invoice.paidAmount ?? undefined,
    paidDate: invoice.paidDate ?? undefined,
    locationAddress: invoice.locationAddress ?? undefined,
    locationLat: invoice.locationLat ?? undefined,
    locationLng: invoice.locationLng ?? undefined,
    signatureName: invoice.signatureName ?? undefined,
    createdAt: invoice.createdAt.toISOString(),
  };
};

export const listInvoicesByUser = async (userId: string): Promise<StoredInvoice[]> => {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map(toStoredInvoice);
};

export const findInvoiceByIdForUser = async (
  userId: string,
  invoiceId: string
): Promise<StoredInvoice | null> => {
  const invoices = await listInvoicesByUser(userId);
  return invoices.find((invoice) => invoice.id === invoiceId) || null;
};

export const findConvertedInvoiceByQuoteId = async (
  userId: string,
  quoteId: string
): Promise<StoredInvoice | null> => {
  const invoices = await listInvoicesByUser(userId);
  return invoices.find((invoice) => invoice.documentType === 'invoice' && invoice.sourceQuoteId === quoteId) || null;
};

export const createInvoice = async (newInvoice: StoredInvoice): Promise<void> => {
  await prisma.invoice.create({
    data: {
      id: newInvoice.id,
      userId: newInvoice.userId,
      clientId: newInvoice.clientId || '',
      clientName: newInvoice.clientName,
      items: newInvoice.items as unknown as Prisma.InputJsonValue,
      total: newInvoice.total,
      vatRate: newInvoice.vatRate ?? 20,
      negotiatedTotal: newInvoice.negotiatedTotal,
      negotiationNote: newInvoice.negotiationNote,
      quoteNumber: newInvoice.quoteNumber,
      issueDate: newInvoice.issueDate,
      status: newInvoice.status,
      documentType: newInvoice.documentType,
      sourceQuoteId: newInvoice.sourceQuoteId,
      paymentStatus: newInvoice.paymentStatus,
      paidAmount: newInvoice.paidAmount,
      paidDate: newInvoice.paidDate,
      locationAddress: newInvoice.locationAddress,
      locationLat: newInvoice.locationLat,
      locationLng: newInvoice.locationLng,
      signatureName: newInvoice.signatureName,
      createdAt: new Date(newInvoice.createdAt),
    },
  });
};

export const updateInvoiceStatusByIdForUser = async (
  userId: string,
  invoiceId: string,
  status: StoredInvoice['status']
): Promise<StoredInvoice | null> => {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!existing) {
    return null;
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });

  return toStoredInvoice(updatedInvoice);
};

export const updateInvoiceByIdForUser = async (
  userId: string,
  invoiceId: string,
  updates: Partial<Pick<StoredInvoice, 'status' | 'negotiatedTotal' | 'negotiationNote' | 'paymentStatus' | 'paidAmount' | 'paidDate'>>
): Promise<StoredInvoice | null> => {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!existing) {
    return null;
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: updates.status,
      negotiatedTotal: Object.prototype.hasOwnProperty.call(updates, 'negotiatedTotal')
        ? updates.negotiatedTotal ?? null
        : undefined,
      negotiationNote: Object.prototype.hasOwnProperty.call(updates, 'negotiationNote')
        ? updates.negotiationNote ?? null
        : undefined,
      paymentStatus: Object.prototype.hasOwnProperty.call(updates, 'paymentStatus')
        ? updates.paymentStatus ?? null
        : undefined,
      paidAmount: Object.prototype.hasOwnProperty.call(updates, 'paidAmount')
        ? updates.paidAmount ?? null
        : undefined,
      paidDate: Object.prototype.hasOwnProperty.call(updates, 'paidDate')
        ? updates.paidDate ?? null
        : undefined,
    },
  });

  return toStoredInvoice(updatedInvoice);
};

export const deleteInvoiceByIdForUser = async (
  userId: string,
  invoiceId: string
): Promise<boolean> => {
  const deleted = await prisma.invoice.deleteMany({
    where: {
      id: invoiceId,
      userId,
    },
  });

  if (deleted.count === 0) {
    return false;
  }

  return true;
};

export const deleteInvoicesByClientIdForUser = async (
  userId: string,
  clientId: string
): Promise<number> => {
  const deleted = await prisma.invoice.deleteMany({
    where: {
      userId,
      clientId,
    },
  });

  return deleted.count;
};

export const countInvoicesByUserSince = async (userId: string, since: Date): Promise<number> => {
  return prisma.invoice.count({
    where: {
      userId,
      createdAt: {
        gte: since,
      },
    },
  });
};
