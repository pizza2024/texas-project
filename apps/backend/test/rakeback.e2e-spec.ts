import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';

describe('RakebackController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Find or create test user
    let testUser = await prisma.user.findFirst({
      where: { username: 'rakeback-test-user' },
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          username: 'rakeback-test-user',
          nickname: 'Rakeback Tester',
          passwordHash:
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lWkJ8LWQqWX.',
          role: 'PLAYER',
          status: 'OFFLINE',
          email: 'rakeback-test@example.com',
          totalRake: 6000,
          rakebackBalance: 1500,
        },
      });
    }
    testUserId = testUser.id;

    // Find or create admin user
    let adminUser = await prisma.user.findFirst({
      where: { username: 'rakeback-test-admin' },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          username: 'rakeback-test-admin',
          nickname: 'Rakeback Admin',
          passwordHash:
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lWkJ8LWQqWX.',
          role: 'ADMIN',
          status: 'OFFLINE',
          email: 'rakeback-admin@example.com',
        },
      });
    }
    adminUserId = adminUser.id;

    // Generate tokens
    userToken = jwtService.sign({
      userId: testUserId,
      username: testUser.username,
      role: 'PLAYER',
    });
    adminToken = jwtService.sign({
      userId: adminUserId,
      username: adminUser.username,
      role: 'ADMIN',
    });

    // Reset rakeback state
    await prisma.user.update({
      where: { id: testUserId },
      data: { rakebackBalance: 1500, totalRake: 6000 },
    });
  });

  afterAll(async () => {
    // Cleanup test users
    try {
      await prisma.user.delete({ where: { id: testUserId } });
      await prisma.user.delete({ where: { id: adminUserId } });
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('/user/rakeback (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/user/rakeback').expect(401);
    });

    it('should return rakeback info for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/user/rakeback')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            rakebackBalance: 1500,
            tier: 'GOLD',
            rate: 0.3,
            totalRake: 6000,
          });
          expect(res.body.minRakeForNextTier).toBeNull();
          expect(res.body.rakeToNextTier).toBeNull();
        });
    });

    it('should return BRONZE tier for user with low rake', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { totalRake: 100, rakebackBalance: 10 },
      });

      return request(app.getHttpServer())
        .get('/user/rakeback')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            rakebackBalance: 10,
            tier: 'BRONZE',
            rate: 0.1,
            totalRake: 100,
            minRakeForNextTier: 1000,
            rakeToNextTier: 900,
          });
        });
    });

    it('should return SILVER tier for mid-level rake user', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { totalRake: 3000, rakebackBalance: 300 },
      });

      return request(app.getHttpServer())
        .get('/user/rakeback')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            rakebackBalance: 300,
            tier: 'SILVER',
            rate: 0.2,
            totalRake: 3000,
            minRakeForNextTier: 5000,
            rakeToNextTier: 2000,
          });
        });
    });
  });

  describe('/user/rakeback/claim (POST)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/user/rakeback/claim')
        .expect(401);
    });

    it('should return 400 when no rakeback to claim', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { rakebackBalance: 0 },
      });

      return request(app.getHttpServer())
        .post('/user/rakeback/claim')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('No rakeback balance to claim');
        });
    });

    it('should successfully claim rakeback balance', async () => {
      // Set a known rakeback balance
      await prisma.user.update({
        where: { id: testUserId },
        data: { rakebackBalance: 500 },
      });

      // Get initial chips
      const walletBefore = await prisma.wallet.findUnique({
        where: { userId: testUserId },
        select: { chips: true },
      });
      const chipsBefore = walletBefore!.chips;

      const response = await request(app.getHttpServer())
        .post('/user/rakeback/claim')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        claimedAmount: 500,
      });
      expect(response.body.newChipsBalance).toBe(chipsBefore + 500);

      // Verify balance was reset
      const userAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { rakebackBalance: true },
      });
      expect(userAfter!.rakebackBalance).toBe(0);
    });

    it('should prevent double-claim of rakeback', async () => {
      // Set a known rakeback balance
      await prisma.user.update({
        where: { id: testUserId },
        data: { rakebackBalance: 100 },
      });

      // First claim should succeed
      await request(app.getHttpServer())
        .post('/user/rakeback/claim')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      // Second claim should fail with 400
      return request(app.getHttpServer())
        .post('/user/rakeback/claim')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('No rakeback balance to claim');
        });
    });
  });
});
