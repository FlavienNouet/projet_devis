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
  quoteNumber: string;
  issueDate: string;
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
  return invoices
    .filter((invoice) => invoice.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const createInvoice = async (newInvoice: StoredInvoice): Promise<void> => {
  const invoices = await readInvoices();
  invoices.push(newInvoice);
  await writeInvoices(invoices);
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
