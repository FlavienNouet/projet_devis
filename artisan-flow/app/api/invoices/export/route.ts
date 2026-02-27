import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { listInvoicesByUser } from '@/lib/invoice-store';
import { findUserById } from '@/lib/user-store';

const formatNumber = (value: number) => value.toFixed(2);

const csvEscape = (value: string) => {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const paymentStatusLabel = (paymentStatus?: 'unpaid' | 'partial' | 'paid') => {
  if (paymentStatus === 'paid') return 'Payée';
  if (paymentStatus === 'partial') return 'Partiellement payée';
  return 'À payer';
};

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const persistedUser = await findUserById(sessionUser.id);

  if (!persistedUser) {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
  }

  if ((persistedUser.plan ?? 'free') === 'free') {
    return NextResponse.json({ error: 'L\'export CSV est réservé au plan Pro.' }, { status: 403 });
  }

  const allDocuments = await listInvoicesByUser(sessionUser.id);
  const invoices = allDocuments.filter((document) => document.documentType === 'invoice');

  const headers = [
    'Numero',
    'Client',
    'Date',
    'TotalEUR',
    'StatutPaiement',
    'EncaisseEUR',
    'ResteEUR',
    'DatePaiement',
  ];

  const rows = invoices.map((invoice) => {
    const collected = invoice.paymentStatus === 'paid'
      ? invoice.total
      : Math.min(invoice.total, Math.max(0, invoice.paidAmount ?? 0));
    const remaining = Math.max(0, invoice.total - collected);

    return [
      invoice.quoteNumber,
      invoice.clientName,
      invoice.issueDate,
      formatNumber(invoice.total),
      paymentStatusLabel(invoice.paymentStatus),
      formatNumber(collected),
      formatNumber(remaining),
      invoice.paidDate || '',
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(';')),
  ].join('\r\n');

  const filenameDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(`\uFEFF${csvContent}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="factures_${filenameDate}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
