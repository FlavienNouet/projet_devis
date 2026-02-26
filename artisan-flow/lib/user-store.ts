import { promises as fs } from 'fs';
import path from 'path';

export interface StoredUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');

const ensureUsersFile = async () => {
  const directoryPath = path.dirname(USERS_FILE_PATH);
  await fs.mkdir(directoryPath, { recursive: true });

  try {
    await fs.access(USERS_FILE_PATH);
  } catch {
    await fs.writeFile(USERS_FILE_PATH, '[]', 'utf8');
  }
};

const readUsers = async (): Promise<StoredUser[]> => {
  await ensureUsersFile();
  const content = await fs.readFile(USERS_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeUsers = async (users: StoredUser[]) => {
  await ensureUsersFile();
  await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
};

export const findUserByEmail = async (email: string): Promise<StoredUser | undefined> => {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === normalizedEmail);
};

export const createUser = async (newUser: StoredUser): Promise<void> => {
  const users = await readUsers();
  users.push(newUser);
  await writeUsers(users);
};

export const findUserById = async (id: string): Promise<StoredUser | undefined> => {
  const users = await readUsers();
  return users.find((user) => user.id === id);
};

export const updateUser = async (
  userId: string,
  update: Partial<Pick<StoredUser, 'companyName' | 'siret' | 'passwordHash'>>
): Promise<StoredUser | null> => {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index < 0) {
    return null;
  }

  const updatedUser: StoredUser = {
    ...users[index],
    ...update,
  };

  users[index] = updatedUser;
  await writeUsers(users);
  return updatedUser;
};
