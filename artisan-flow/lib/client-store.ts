import { prisma } from '@/lib/prisma';

export interface StoredClient {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

const toStoredClient = (client: {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: Date;
}): StoredClient => ({
  id: client.id,
  userId: client.userId,
  name: client.name,
  email: client.email,
  phone: client.phone,
  notes: client.notes,
  createdAt: client.createdAt.toISOString(),
});

export const listClientsByUser = async (userId: string): Promise<StoredClient[]> => {
  const clients = await prisma.client.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return clients.map(toStoredClient);
};

export const findClientByNameForUser = async (
  userId: string,
  name: string
): Promise<StoredClient | undefined> => {
  const normalizedName = name.trim().toLowerCase();
  const clients = await prisma.client.findMany({ where: { userId } });
  const client = clients.find((entry) => entry.name.trim().toLowerCase() === normalizedName);
  return client ? toStoredClient(client) : undefined;
};

export const createClient = async (newClient: StoredClient): Promise<void> => {
  await prisma.client.create({
    data: {
      id: newClient.id,
      userId: newClient.userId,
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
      notes: newClient.notes,
      createdAt: new Date(newClient.createdAt),
    },
  });
};

export const deleteClientByIdForUser = async (
  userId: string,
  clientId: string
): Promise<boolean> => {
  const deleted = await prisma.client.deleteMany({
    where: {
      id: clientId,
      userId,
    },
  });

  if (deleted.count === 0) {
    return false;
  }

  return true;
};
