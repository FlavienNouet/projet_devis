import { promises as fs } from 'fs';
import path from 'path';

export interface StoredClient {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

const CLIENTS_FILE_PATH = path.join(process.cwd(), 'data', 'clients.json');

const ensureClientsFile = async () => {
  const directoryPath = path.dirname(CLIENTS_FILE_PATH);
  await fs.mkdir(directoryPath, { recursive: true });

  try {
    await fs.access(CLIENTS_FILE_PATH);
  } catch {
    await fs.writeFile(CLIENTS_FILE_PATH, '[]', 'utf8');
  }
};

const readClients = async (): Promise<StoredClient[]> => {
  await ensureClientsFile();
  const content = await fs.readFile(CLIENTS_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeClients = async (clients: StoredClient[]) => {
  await ensureClientsFile();
  await fs.writeFile(CLIENTS_FILE_PATH, JSON.stringify(clients, null, 2), 'utf8');
};

export const listClientsByUser = async (userId: string): Promise<StoredClient[]> => {
  const clients = await readClients();
  return clients
    .filter((client) => client.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const findClientByNameForUser = async (
  userId: string,
  name: string
): Promise<StoredClient | undefined> => {
  const normalizedName = name.trim().toLowerCase();
  const clients = await listClientsByUser(userId);
  return clients.find((client) => client.name.trim().toLowerCase() === normalizedName);
};

export const createClient = async (newClient: StoredClient): Promise<void> => {
  const clients = await readClients();
  clients.push(newClient);
  await writeClients(clients);
};

export const deleteClientByIdForUser = async (
  userId: string,
  clientId: string
): Promise<boolean> => {
  const clients = await readClients();
  const initialLength = clients.length;

  const remainingClients = clients.filter(
    (client) => !(client.userId === userId && client.id === clientId)
  );

  if (remainingClients.length === initialLength) {
    return false;
  }

  await writeClients(remainingClients);
  return true;
};
