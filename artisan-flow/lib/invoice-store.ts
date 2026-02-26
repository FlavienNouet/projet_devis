import { promises as fs } from 'fs';
import path from 'path';

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
  createdAt: string;
}

const INVOICES_FILE_PATH = path.join(process.cwd(), 'data', 'invoices.json');

const ensureInvoicesFile = async () => {
  const directoryPath = path.dirname(INVOICES_FILE_PATH);
  await fs.mkdir(directoryPath, { recursive: true });

  try {
    await fs.access(INVOICES_FILE_PATH);
  } catch {
    await fs.writeFile(INVOICES_FILE_PATH, '[]', 'utf8');
  }
};

const readInvoices = async (): Promise<StoredInvoice[]> => {
  await ensureInvoicesFile();
  const content = await fs.readFile(INVOICES_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeInvoices = async (invoices: StoredInvoice[]) => {
  await ensureInvoicesFile();
  await fs.writeFile(INVOICES_FILE_PATH, JSON.stringify(invoices, null, 2), 'utf8');
};

export const listInvoicesByUser = async (userId: string): Promise<StoredInvoice[]> => {
  const invoices = await readInvoices();

  const normalizeStatus = (status: unknown): StoredInvoice['status'] => {
    if (status === 'accepted') return 'accepted';
    if (status === 'rejected') return 'rejected';
    return 'sent';
  };

  return invoices
    .filter((invoice) => invoice.userId === userId)
    .map((invoice) => ({
      ...invoice,
      status: normalizeStatus((invoice as { status?: unknown }).status),
      documentType: (invoice as { documentType?: unknown }).documentType === 'invoice' ? 'invoice' : 'quote',
      sourceQuoteId: typeof (invoice as { sourceQuoteId?: unknown }).sourceQuoteId === 'string'
        ? (invoice as { sourceQuoteId?: string }).sourceQuoteId
        : undefined,
      paymentStatus: (invoice as { documentType?: unknown }).documentType === 'invoice'
        ? ((invoice as { paymentStatus?: unknown }).paymentStatus === 'paid'
          ? 'paid'
          : (invoice as { paymentStatus?: unknown }).paymentStatus === 'partial'
            ? 'partial'
            : 'unpaid')
        : undefined,
      paidAmount: typeof (invoice as { paidAmount?: unknown }).paidAmount === 'number'
        ? (invoice as { paidAmount?: number }).paidAmount
        : undefined,
      paidDate: typeof (invoice as { paidDate?: unknown }).paidDate === 'string'
        ? (invoice as { paidDate?: string }).paidDate
        : undefined,
      negotiatedTotal: typeof (invoice as { negotiatedTotal?: unknown }).negotiatedTotal === 'number'
        ? (invoice as { negotiatedTotal?: number }).negotiatedTotal
        : undefined,
      negotiationNote: typeof (invoice as { negotiationNote?: unknown }).negotiationNote === 'string'
        ? (invoice as { negotiationNote?: string }).negotiationNote
        : undefined,
      locationAddress: typeof (invoice as { locationAddress?: unknown }).locationAddress === 'string'
        ? (invoice as { locationAddress?: string }).locationAddress
        : undefined,
      locationLat: typeof (invoice as { locationLat?: unknown }).locationLat === 'number'
        ? (invoice as { locationLat?: number }).locationLat
        : undefined,
      locationLng: typeof (invoice as { locationLng?: unknown }).locationLng === 'number'
        ? (invoice as { locationLng?: number }).locationLng
        : undefined,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  const invoices = await readInvoices();
  invoices.push(newInvoice);
  await writeInvoices(invoices);
};

export const updateInvoiceStatusByIdForUser = async (
  userId: string,
  invoiceId: string,
  status: StoredInvoice['status']
): Promise<StoredInvoice | null> => {
  const invoices = await readInvoices();
  const invoiceIndex = invoices.findIndex(
    (invoice) => invoice.userId === userId && invoice.id === invoiceId
  );

  if (invoiceIndex < 0) {
    return null;
  }

  const updatedInvoice: StoredInvoice = {
    ...invoices[invoiceIndex],
    status,
  };

  invoices[invoiceIndex] = updatedInvoice;
  await writeInvoices(invoices);

  return updatedInvoice;
};

export const updateInvoiceByIdForUser = async (
  userId: string,
  invoiceId: string,
  updates: Partial<Pick<StoredInvoice, 'status' | 'negotiatedTotal' | 'negotiationNote' | 'paymentStatus' | 'paidAmount' | 'paidDate'>>
): Promise<StoredInvoice | null> => {
  const invoices = await readInvoices();
  const invoiceIndex = invoices.findIndex(
    (invoice) => invoice.userId === userId && invoice.id === invoiceId
  );

  if (invoiceIndex < 0) {
    return null;
  }

  const existing = invoices[invoiceIndex];

  const updatedInvoice: StoredInvoice = { ...existing };

  if (updates.status !== undefined) {
    updatedInvoice.status = updates.status;
  }

  if ('negotiatedTotal' in updates) {
    updatedInvoice.negotiatedTotal = updates.negotiatedTotal;
  }

  if ('negotiationNote' in updates) {
    updatedInvoice.negotiationNote = updates.negotiationNote;
  }

  if ('paymentStatus' in updates) {
    updatedInvoice.paymentStatus = updates.paymentStatus;
  }

  if ('paidAmount' in updates) {
    updatedInvoice.paidAmount = updates.paidAmount;
  }

  if ('paidDate' in updates) {
    updatedInvoice.paidDate = updates.paidDate;
  }

  invoices[invoiceIndex] = updatedInvoice;
  await writeInvoices(invoices);

  return updatedInvoice;
};

export const deleteInvoiceByIdForUser = async (
  userId: string,
  invoiceId: string
): Promise<boolean> => {
  const invoices = await readInvoices();
  const initialLength = invoices.length;

  const remainingInvoices = invoices.filter(
    (invoice) => !(invoice.userId === userId && invoice.id === invoiceId)
  );

  if (remainingInvoices.length === initialLength) {
    return false;
  }

  await writeInvoices(remainingInvoices);
  return true;
};

export const deleteInvoicesByClientIdForUser = async (
  userId: string,
  clientId: string
): Promise<number> => {
  const invoices = await readInvoices();
  const remainingInvoices = invoices.filter(
    (invoice) => !(invoice.userId === userId && invoice.clientId === clientId)
  );

  const deletedCount = invoices.length - remainingInvoices.length;

  if (deletedCount > 0) {
    await writeInvoices(remainingInvoices);
  }

  return deletedCount;
};
