#!/usr/bin/env node
/**
 * 将指定用户提升为管理员
 * 用法: node scripts/make-admin.js <username>
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node scripts/make-admin.js <username>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { username },
    data: { role: 'ADMIN' },
  });

  console.log(`✅ User "${username}" (${user.nickname}) has been promoted to ADMIN`);
  console.log(`   You can now login to the admin console at http://localhost:3001`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
