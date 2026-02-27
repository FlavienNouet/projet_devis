import { prisma } from '@/lib/prisma';

export const getNextDocumentNumber = async (
  documentType: 'quote' | 'invoice'
): Promise<string> => {
  const currentYear = String(new Date().getFullYear());
  const prefix = documentType === 'invoice' ? 'FAC' : 'DEV';

  const counter = await prisma.numberingCounter.upsert({
    where: {
      documentType_year: {
        documentType,
        year: currentYear,
      },
    },
    create: {
      documentType,
      year: currentYear,
      value: 1,
    },
    update: {
      value: {
        increment: 1,
      },
    },
  });

  const nextValue = counter.value;

  return `${prefix}-${currentYear}-${String(nextValue).padStart(3, '0')}`;
};
