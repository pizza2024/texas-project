import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RakebackController } from '../src/rakeback/rakeback.controller';
import { RakebackService } from '../src/rakeback/rakeback.service';
import { WalletService } from '../src/wallet/wallet.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'rakeback-user-id';

// ── Per-test mutable state ────────────────────────────────────────────────────

interface UserState {
  rakebackBalance: number;
  totalRake: number;
  chips: number;
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createApp(state: UserState) {
  const mockPrisma = {
    $transaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    user: {
      findUnique: jest.fn().mockImplementation(async () => ({
        id: TEST_USER_ID,
        username: 'rakeback-test-user',
        nickname: 'Rakeback Tester',
        role: 'PLAYER',
        status: 'OFFLINE',
        email: 'rakeback-test@example.com',
        totalRake: state.totalRake,
        rakebackBalance: state.rakebackBalance,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        if (data?.rakebackBalance !== undefined) state.rakebackBalance = data.rakebackBalance;
        if (data?.totalRake !== undefined) state.totalRake = data.totalRake;
        return {
          id: TEST_USER_ID,
          username: 'rakeback-test-user',
          totalRake: state.totalRake,
          rakebackBalance: state.rakebackBalance,
        };
      }),
    },
    wallet: {
      findUnique: jest.fn().mockResolvedValue({ userId: TEST_USER_ID, chips: state.chips }),
      update: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        if (data?.chips?.increment) state.chips += data.chips.increment;
        return { userId: TEST_USER_ID, chips: state.chips };
      }),
      upsert: jest.fn(),
    },
    transaction: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [RakebackController],
    providers: [
      RakebackService,
      { provide: WalletService, useValue: { addChips: jest.fn() } },
      { provide: PrismaService, useValue: mockPrisma },
      { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() } },
    ],
  })
    .overrideGuard(AuthGuard('jwt'))
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        request.user = { userId: TEST_USER_ID, username: 'rakeback-test-user', role: 'PLAYER' };
        return true;
      },
    })
    .compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  await app.init();
  return { app, mockPrisma };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RakebackController (e2e)', () => {

  // ── GET /user/rakeback ─────────────────────────────────────────────────────

  describe('GET /user/rakeback', () => {
    it('should return GOLD tier for user with 6000 totalRake', async () => {
      const { app } = await createApp({ rakebackBalance: 1500, totalRake: 6000, chips: 1000 });
      try {
        await request(app.getHttpServer())
          .get('/user/rakeback')
          .set('Authorization', 'Bearer mock-token')
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              rakebackBalance: 1500,
              tier: 'GOLD',
              rate: 30,
              totalRake: 6000,
              minRakeForNextTier: 10000,
              rakeToNextTier: 4000,
            });
          });
      } finally {
        await app.close();
      }
    });

    it('should return BRONZE tier for user with 100 totalRake', async () => {
      const { app } = await createApp({ rakebackBalance: 10, totalRake: 100, chips: 1000 });
      try {
        await request(app.getHttpServer())
          .get('/user/rakeback')
          .set('Authorization', 'Bearer mock-token')
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              rakebackBalance: 10,
              tier: 'BRONZE',
              rate: 15,
              totalRake: 100,
              minRakeForNextTier: 500,
              rakeToNextTier: 400,
            });
          });
      } finally {
        await app.close();
      }
    });

    it('should return GOLD tier for user with 3000 totalRake', async () => {
      // 3000 totalRake >= GOLD.minRake (2000), so this is GOLD tier (not SILVER)
      const { app } = await createApp({ rakebackBalance: 300, totalRake: 3000, chips: 1000 });
      try {
        await request(app.getHttpServer())
          .get('/user/rakeback')
          .set('Authorization', 'Bearer mock-token')
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              rakebackBalance: 300,
              tier: 'GOLD',
              rate: 30,
              totalRake: 3000,
              minRakeForNextTier: 10000,
              rakeToNextTier: 7000,
            });
          });
      } finally {
        await app.close();
      }
    });
  });

  // ── POST /user/rakeback/claim ───────────────────────────────────────────────

  describe('POST /user/rakeback/claim', () => {
    it('should return 400 when rakeback balance is 0', async () => {
      const { app } = await createApp({ rakebackBalance: 0, totalRake: 100, chips: 1000 });
      try {
        await request(app.getHttpServer())
          .post('/user/rakeback/claim')
          .set('Authorization', 'Bearer mock-token')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('No rakeback balance to claim');
          });
      } finally {
        await app.close();
      }
    });

    it('should successfully claim rakeback balance and update chips', async () => {
      const state = { rakebackBalance: 500, totalRake: 6000, chips: 1000 };
      const { app } = await createApp(state);
      try {
        await request(app.getHttpServer())
          .post('/user/rakeback/claim')
          .set('Authorization', 'Bearer mock-token')
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              claimedAmount: 500,
              newChipsBalance: 1500,
            });
          });
        // Verify chips were incremented and balance reset
        expect(state.rakebackBalance).toBe(0);
        expect(state.chips).toBe(1500);
      } finally {
        await app.close();
      }
    });

    it('should prevent double-claim of rakeback', async () => {
      const state = { rakebackBalance: 100, totalRake: 6000, chips: 1000 };
      const { app } = await createApp(state);
      try {
        // First claim succeeds
        await request(app.getHttpServer())
          .post('/user/rakeback/claim')
          .set('Authorization', 'Bearer mock-token')
          .expect(201);

        // Second claim fails
        await request(app.getHttpServer())
          .post('/user/rakeback/claim')
          .set('Authorization', 'Bearer mock-token')
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('No rakeback balance to claim');
          });
      } finally {
        await app.close();
      }
    });
  });
});
