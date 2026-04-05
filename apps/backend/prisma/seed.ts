/**
 * Seed script for development environment.
 * Inserts the default test accounts with their original password hashes from SQLite.
 *
 * Run with: npm run db:seed
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERS = [
  { id: 'd75ee415-6bf3-4384-bf4a-bfaa6b95382a', username: 'test1', nickname: 'apple',  role: 'PLAYER', chips: 8980,  passwordHash: '$2b$10$3NqC0aYt6./.lUScwmM0gu9Pf77BMf9c6wnvqtG0eSaJ61RSlf5Ym', avatar: '/uploads/avatars/82fa0e63-cfc3-492e-beb2-ebec177a48e6.jpg' },
  { id: 'e017e8de-869d-4239-a1c9-f0a01e950ad3', username: 'test2', nickname: 'orange', role: 'PLAYER', chips: 10090, passwordHash: '$2b$10$MeQWsicmXPb0hwVTLctsoe/C3yk3P2dPBPTmIFS2hGFwp74JzLEBG', avatar: null },
  { id: 'adb99a68-fa83-4ac0-8806-509d8a08e2e9', username: 'test3', nickname: 'banana', role: 'PLAYER', chips: 10160, passwordHash: '$2b$10$9KyvVVZlXGoeqyu4/LbzEug0.6131Nc0Cd7WstoXdrt4nvTPReQzm', avatar: null },
  { id: '63a070ab-b6e0-44fa-b5ca-4f6469708f66', username: 'tj',    nickname: '臭宝',   role: 'PLAYER', chips: 9790,  passwordHash: '$2b$10$txqIRY4l4BxXUYG/xEO1NeKzhsAtVOSBr5ORJ2OvLethHrCjz5sQK', avatar: null },
  { id: '22a7c13a-2e44-4861-bcca-e189d468801a', username: 'admin', nickname: '管理员', role: 'ADMIN',  chips: 10000, passwordHash: '$2b$10$kFL88GAtdeITFYi33iOUF.39yqCd/F/z8rcpPFAgGyI.fQc77cA/S', avatar: null },
];

async function main() {
  console.log('Seeding database...');

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        password: u.passwordHash,
        avatar: u.avatar,
        role: u.role,
        status: 'OFFLINE',
        coinBalance: u.chips,
        elo: 1000,
        wallet: {
          create: { balance: 0, chips: u.chips, frozenChips: 0 },
        },
      },
    });
  }

  console.log(`Seeded ${USERS.length} users.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
