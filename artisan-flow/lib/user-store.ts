import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parseBillingStatus, parsePlan, type BillingPlan, type BillingStatus } from '@/lib/plans';

export interface StoredUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
  passwordHash: string;
  role?: 'admin' | 'user';
  plan?: BillingPlan;
  billingStatus?: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  createdAt: string;
}

interface PublicUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
  role: 'admin' | 'user';
  plan: BillingPlan;
  billingStatus: BillingStatus;
  createdAt: string;
}

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const BOOTSTRAP_ADMIN_COMPANY = process.env.BOOTSTRAP_ADMIN_COMPANY?.trim() || 'Administrateur';

let ensureSingleAdminPromise: Promise<void> | null = null;

const normalizeRole = (role: string): 'admin' | 'user' => (role === 'admin' ? 'admin' : 'user');

const toStoredUser = (user: {
  id: string;
  companyName: string;
  siret: string;
  email: string;
  passwordHash: string;
  role: string;
  plan: string;
  billingStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  createdAt: Date;
}): StoredUser => ({
  id: user.id,
  companyName: user.companyName,
  siret: user.siret,
  email: user.email,
  passwordHash: user.passwordHash,
  role: normalizeRole(user.role),
  plan: parsePlan(user.plan),
  billingStatus: parseBillingStatus(user.billingStatus),
  stripeCustomerId: user.stripeCustomerId ?? undefined,
  stripeSubscriptionId: user.stripeSubscriptionId ?? undefined,
  stripePriceId: user.stripePriceId ?? undefined,
  createdAt: user.createdAt.toISOString(),
});

const toPublicUser = (user: StoredUser): PublicUser => ({
  id: user.id,
  companyName: user.companyName,
  siret: user.siret,
  email: user.email,
  role: user.role === 'admin' ? 'admin' : 'user',
  plan: user.plan ?? 'free',
  billingStatus: user.billingStatus ?? 'inactive',
  createdAt: user.createdAt,
});

const ensureSingleAdminAccount = async () => {
  if (ensureSingleAdminPromise) {
    return ensureSingleAdminPromise;
  }

  ensureSingleAdminPromise = (async () => {
    if (!BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) {
      return;
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: BOOTSTRAP_ADMIN_EMAIL },
    });

    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 12);

      await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          companyName: BOOTSTRAP_ADMIN_COMPANY,
          siret: '',
          email: BOOTSTRAP_ADMIN_EMAIL,
          passwordHash: adminPasswordHash,
          role: 'admin',
          plan: 'team',
          billingStatus: 'active',
          createdAt: new Date(),
        },
      });
    } else if (normalizeRole(existingAdmin.role) !== 'admin') {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: 'admin',
        },
      });
    }
  })()
    .finally(() => {
      ensureSingleAdminPromise = null;
    });

  return ensureSingleAdminPromise;
};

export const findUserByEmail = async (email: string): Promise<StoredUser | undefined> => {
  await ensureSingleAdminAccount();

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return undefined;
  }

  return toStoredUser(user);
};

export const createUser = async (newUser: StoredUser): Promise<void> => {
  await ensureSingleAdminAccount();

  await prisma.user.create({
    data: {
      id: newUser.id,
      companyName: newUser.companyName,
      siret: newUser.siret,
      email: newUser.email.trim().toLowerCase(),
      passwordHash: newUser.passwordHash,
      role: newUser.role === 'admin' ? 'admin' : 'user',
      plan: newUser.plan ?? 'free',
      billingStatus: newUser.billingStatus ?? 'inactive',
      stripeCustomerId: newUser.stripeCustomerId,
      stripeSubscriptionId: newUser.stripeSubscriptionId,
      stripePriceId: newUser.stripePriceId,
      createdAt: new Date(newUser.createdAt),
    },
  });
};

export const findUserById = async (id: string): Promise<StoredUser | undefined> => {
  await ensureSingleAdminAccount();

  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toStoredUser(user) : undefined;
};

export const getDefaultRoleForNewUser = async (email: string): Promise<'admin' | 'user'> => {
  await ensureSingleAdminAccount();
  return BOOTSTRAP_ADMIN_EMAIL && email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'user';
};

export const getDefaultPlanForNewUser = async (email: string): Promise<BillingPlan> => {
  await ensureSingleAdminAccount();
  return BOOTSTRAP_ADMIN_EMAIL && email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 'team' : 'free';
};

export const listPublicUsers = async (): Promise<PublicUser[]> => {
  await ensureSingleAdminAccount();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return users.map((user) => toPublicUser(toStoredUser(user)));
};

export const updateUser = async (
  userId: string,
  update: Partial<Pick<StoredUser, 'companyName' | 'siret' | 'passwordHash'>>
): Promise<StoredUser | null> => {
  await ensureSingleAdminAccount();

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    return null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      companyName: update.companyName,
      siret: update.siret,
      passwordHash: update.passwordHash,
    },
  });

  return toStoredUser(updatedUser);
};

export const deleteUserByIdForAdmin = async (
  adminUserId: string,
  targetUserId: string
): Promise<{ success: boolean; reason?: 'forbidden' | 'not-found' | 'protected' | 'self' }> => {
  await ensureSingleAdminAccount();

  if (adminUserId === targetUserId) {
    return { success: false, reason: 'self' };
  }

  const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!adminUser || normalizeRole(adminUser.role) !== 'admin') {
    return { success: false, reason: 'forbidden' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    return { success: false, reason: 'not-found' };
  }

  if (BOOTSTRAP_ADMIN_EMAIL && targetUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
    return { success: false, reason: 'protected' };
  }

  await prisma.$transaction([
    prisma.invoice.deleteMany({ where: { userId: targetUserId } }),
    prisma.client.deleteMany({ where: { userId: targetUserId } }),
    prisma.user.delete({ where: { id: targetUserId } }),
  ]);

  return { success: true };
};

export const updateUserBillingById = async (
  userId: string,
  update: {
    plan?: BillingPlan;
    billingStatus?: BillingStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  }
): Promise<StoredUser | null> => {
  await ensureSingleAdminAccount();

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    return null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      plan: update.plan,
      billingStatus: update.billingStatus,
      stripeCustomerId: Object.prototype.hasOwnProperty.call(update, 'stripeCustomerId')
        ? update.stripeCustomerId
        : undefined,
      stripeSubscriptionId: Object.prototype.hasOwnProperty.call(update, 'stripeSubscriptionId')
        ? update.stripeSubscriptionId
        : undefined,
      stripePriceId: Object.prototype.hasOwnProperty.call(update, 'stripePriceId')
        ? update.stripePriceId
        : undefined,
    },
  });

  return toStoredUser(updatedUser);
};

export const findUserByStripeCustomerId = async (stripeCustomerId: string): Promise<StoredUser | undefined> => {
  await ensureSingleAdminAccount();

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId },
  });

  return user ? toStoredUser(user) : undefined;
};

export const findUserByStripeSubscriptionId = async (stripeSubscriptionId: string): Promise<StoredUser | undefined> => {
  await ensureSingleAdminAccount();

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId },
  });

  return user ? toStoredUser(user) : undefined;
};
