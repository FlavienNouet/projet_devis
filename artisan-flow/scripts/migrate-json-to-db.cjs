/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const readJsonArrayFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readJsonObjectFile = async (filePath, fallback) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const migrateUsers = async (dataDir) => {
  const users = await readJsonArrayFile(path.join(dataDir, 'users.json'));
  if (users.length === 0) return;

  const sortedByCreated = [...users].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const firstUserId = sortedByCreated[0]?.id;

  for (const user of users) {
    if (!user?.id || !user?.email) continue;

    const role = user.role === 'admin' || user.role === 'user'
      ? user.role
      : user.id === firstUserId
        ? 'admin'
        : 'user';

    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        companyName: String(user.companyName || ''),
        siret: String(user.siret || ''),
        email: String(user.email || '').toLowerCase(),
        passwordHash: String(user.passwordHash || ''),
        role,
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      },
      update: {
        companyName: String(user.companyName || ''),
        siret: String(user.siret || ''),
        email: String(user.email || '').toLowerCase(),
        passwordHash: String(user.passwordHash || ''),
        role,
      },
    });
  }
};

const migrateClients = async (dataDir) => {
  const clients = await readJsonArrayFile(path.join(dataDir, 'clients.json'));
  if (clients.length === 0) return;

  for (const client of clients) {
    if (!client?.id || !client?.userId) continue;

    await prisma.client.upsert({
      where: { id: client.id },
      create: {
        id: client.id,
        userId: String(client.userId),
        name: String(client.name || ''),
        email: String(client.email || ''),
        phone: String(client.phone || ''),
        notes: String(client.notes || ''),
        createdAt: client.createdAt ? new Date(client.createdAt) : new Date(),
      },
      update: {
        userId: String(client.userId),
        name: String(client.name || ''),
        email: String(client.email || ''),
        phone: String(client.phone || ''),
        notes: String(client.notes || ''),
      },
    });
  }
};

const migrateInvoices = async (dataDir) => {
  const invoices = await readJsonArrayFile(path.join(dataDir, 'invoices.json'));
  if (invoices.length === 0) return;

  for (const invoice of invoices) {
    if (!invoice?.id || !invoice?.userId) continue;

    await prisma.invoice.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        userId: String(invoice.userId),
        clientId: String(invoice.clientId || ''),
        clientName: String(invoice.clientName || ''),
        items: Array.isArray(invoice.items) ? invoice.items : [],
        total: Number(invoice.total || 0),
        negotiatedTotal: typeof invoice.negotiatedTotal === 'number' ? invoice.negotiatedTotal : null,
        negotiationNote: typeof invoice.negotiationNote === 'string' ? invoice.negotiationNote : null,
        quoteNumber: String(invoice.quoteNumber || '0000'),
        issueDate: String(invoice.issueDate || ''),
        status: String(invoice.status || 'sent'),
        documentType: String(invoice.documentType || 'quote'),
        sourceQuoteId: typeof invoice.sourceQuoteId === 'string' ? invoice.sourceQuoteId : null,
        paymentStatus: typeof invoice.paymentStatus === 'string' ? invoice.paymentStatus : null,
        paidAmount: typeof invoice.paidAmount === 'number' ? invoice.paidAmount : null,
        paidDate: typeof invoice.paidDate === 'string' ? invoice.paidDate : null,
        locationAddress: typeof invoice.locationAddress === 'string' ? invoice.locationAddress : null,
        locationLat: typeof invoice.locationLat === 'number' ? invoice.locationLat : null,
        locationLng: typeof invoice.locationLng === 'number' ? invoice.locationLng : null,
        signatureName: typeof invoice.signatureName === 'string' ? invoice.signatureName : null,
        createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date(),
      },
      update: {
        userId: String(invoice.userId),
        clientId: String(invoice.clientId || ''),
        clientName: String(invoice.clientName || ''),
        items: Array.isArray(invoice.items) ? invoice.items : [],
        total: Number(invoice.total || 0),
        negotiatedTotal: typeof invoice.negotiatedTotal === 'number' ? invoice.negotiatedTotal : null,
        negotiationNote: typeof invoice.negotiationNote === 'string' ? invoice.negotiationNote : null,
        quoteNumber: String(invoice.quoteNumber || '0000'),
        issueDate: String(invoice.issueDate || ''),
        status: String(invoice.status || 'sent'),
        documentType: String(invoice.documentType || 'quote'),
        sourceQuoteId: typeof invoice.sourceQuoteId === 'string' ? invoice.sourceQuoteId : null,
        paymentStatus: typeof invoice.paymentStatus === 'string' ? invoice.paymentStatus : null,
        paidAmount: typeof invoice.paidAmount === 'number' ? invoice.paidAmount : null,
        paidDate: typeof invoice.paidDate === 'string' ? invoice.paidDate : null,
        locationAddress: typeof invoice.locationAddress === 'string' ? invoice.locationAddress : null,
        locationLat: typeof invoice.locationLat === 'number' ? invoice.locationLat : null,
        locationLng: typeof invoice.locationLng === 'number' ? invoice.locationLng : null,
        signatureName: typeof invoice.signatureName === 'string' ? invoice.signatureName : null,
      },
    });
  }
};

const migrateNumbering = async (dataDir) => {
  const numbering = await readJsonObjectFile(path.join(dataDir, 'numbering.json'), { quote: {}, invoice: {} });

  for (const documentType of ['quote', 'invoice']) {
    const values = numbering[documentType] && typeof numbering[documentType] === 'object'
      ? numbering[documentType]
      : {};

    for (const [year, value] of Object.entries(values)) {
      await prisma.numberingCounter.upsert({
        where: {
          documentType_year: {
            documentType,
            year,
          },
        },
        create: {
          documentType,
          year,
          value: Number(value) || 0,
        },
        update: {
          value: Number(value) || 0,
        },
      });
    }
  }
};

const run = async () => {
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, 'data');

  await migrateUsers(dataDir);
  await migrateClients(dataDir);
  await migrateInvoices(dataDir);
  await migrateNumbering(dataDir);

  console.log('✅ Migration JSON -> DB terminée.');
};

run()
  .catch((error) => {
    console.error('❌ Erreur migration JSON -> DB', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
