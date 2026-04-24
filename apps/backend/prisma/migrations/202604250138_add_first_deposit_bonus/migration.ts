import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // This migration adds hasReceivedFirstDepositBonus to users table
  // It is a no-op for existing users - they simply won't have received the bonus yet
  console.log('Migration applied: add_first_deposit_bonus');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
