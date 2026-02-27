const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'Admin123!';

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        role: 'admin',
      },
    });
  } else {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        companyName: 'Administrateur',
        siret: '',
        email,
        passwordHash,
        role: 'admin',
        plan: 'team',
        billingStatus: 'active',
        createdAt: new Date(),
      },
    });
  }

  await prisma.$disconnect();
  console.log(`Admin ready: ${email}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
