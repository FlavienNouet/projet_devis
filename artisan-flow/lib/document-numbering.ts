import { promises as fs } from 'fs';
import path from 'path';

interface NumberingData {
  quote: Record<string, number>;
  invoice: Record<string, number>;
}

const NUMBERING_FILE_PATH = path.join(process.cwd(), 'data', 'numbering.json');

const initialData: NumberingData = {
  quote: {},
  invoice: {},
};

const ensureNumberingFile = async () => {
  const directoryPath = path.dirname(NUMBERING_FILE_PATH);
  await fs.mkdir(directoryPath, { recursive: true });

  try {
    await fs.access(NUMBERING_FILE_PATH);
  } catch {
    await fs.writeFile(NUMBERING_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
};

const readNumberingData = async (): Promise<NumberingData> => {
  await ensureNumberingFile();
  const content = await fs.readFile(NUMBERING_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(content) as Partial<NumberingData>;

    return {
      quote: parsed.quote && typeof parsed.quote === 'object' ? parsed.quote : {},
      invoice: parsed.invoice && typeof parsed.invoice === 'object' ? parsed.invoice : {},
    };
  } catch {
    return initialData;
  }
};

const writeNumberingData = async (data: NumberingData) => {
  await ensureNumberingFile();
  await fs.writeFile(NUMBERING_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
};

export const getNextDocumentNumber = async (
  documentType: 'quote' | 'invoice'
): Promise<string> => {
  const currentYear = String(new Date().getFullYear());
  const prefix = documentType === 'invoice' ? 'FAC' : 'DEV';

  const data = await readNumberingData();
  const currentValue = data[documentType][currentYear] || 0;
  const nextValue = currentValue + 1;

  data[documentType][currentYear] = nextValue;
  await writeNumberingData(data);

  return `${prefix}-${currentYear}-${String(nextValue).padStart(3, '0')}`;
};
