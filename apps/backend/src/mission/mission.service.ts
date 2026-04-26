import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { Cron, CronExpression } from '@nestjs/schedule';

// ── Mission keys ─────────────────────────────────────────────────────────────

// ONE-TIME missions
export const MISSION_KEY_FIRST_DEPOSIT = 'P1-FIRST-DEPOSIT';
export const MISSION_KEY_FIRST_HAND = 'P1-FIRST-HAND';

// DAILY missions (6 total)
export const MISSION_KEY_DAILY_PLAY = 'P1-DAILY-PLAY';
export const MISSION_KEY_DAILY_WIN = 'P1-DAILY-WIN';
export const MISSION_KEY_DAILY_DEPOSIT = 'P1-DAILY-DEPOSIT';
export const MISSION_KEY_DAILY_Rake = 'P1-DAILY-RAKE';
export const MISSION_KEY_DAILY_HOUR = 'P1-DAILY-HOUR';
export const MISSION_KEY_DAILY_BIG_POT = 'P1-DAILY-BIG-POT';

// WEEKLY missions (2 total)
export const MISSION_KEY_WEEKLY_WINS = 'P2-WEEKLY-WINS';
export const MISSION_KEY_WEEKLY_PROFIT = 'P2-WEEKLY-PROFIT';

// ── Mission definitions ──────────────────────────────────────────────────────

export const MISSION_DEFINITIONS: Array<{
  key: string;
  title: string;
  description: string;
  type: 'ONE_TIME' | 'DAILY' | 'WEEKLY';
  periodType?: 'DAY' | 'WEEK';
  rewardChips: number;
  target: number;
}> = [
  // ONE-TIME
  {
    key: MISSION_KEY_FIRST_DEPOSIT,
    title: 'First Deposit',
    description: 'Make your first USDT deposit to receive a bonus',
    type: 'ONE_TIME',
    rewardChips: 10000,
    target: 1,
  },
  {
    key: MISSION_KEY_FIRST_HAND,
    title: 'First Hand Played',
    description: "Complete your first hand of Texas Hold'em",
    type: 'ONE_TIME',
    rewardChips: 500,
    target: 1,
  },
  // DAILY missions (6)
  {
    key: MISSION_KEY_DAILY_PLAY,
    title: 'Daily Grind',
    description: 'Play 3 hands in any room',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 300,
    target: 3,
  },
  {
    key: MISSION_KEY_DAILY_WIN,
    title: 'Daily Winner',
    description: 'Win 1 hand at any stakes',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 200,
    target: 1,
  },
  {
    key: MISSION_KEY_DAILY_DEPOSIT,
    title: 'Daily Top-Up',
    description: 'Make a deposit of any amount',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 500,
    target: 1,
  },
  {
    key: MISSION_KEY_DAILY_Rake,
    title: 'Rake Generation',
    description: 'Contribute to 100 chips in rake across all hands',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 800,
    target: 100,
  },
  {
    key: MISSION_KEY_DAILY_HOUR,
    title: 'Hour-long Session',
    description: 'Play at a table for 60 cumulative minutes in a single day',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 600,
    target: 60,
  },
  {
    key: MISSION_KEY_DAILY_BIG_POT,
    title: 'Big Pot Hunter',
    description: 'Win a single pot of 1000 chips or more',
    type: 'DAILY',
    periodType: 'DAY',
    rewardChips: 1000,
    target: 1,
  },
  // WEEKLY missions (2)
  {
    key: MISSION_KEY_WEEKLY_WINS,
    title: 'Weekly Champion',
    description: 'Win 20 hands in total across the week',
    type: 'WEEKLY',
    periodType: 'WEEK',
    rewardChips: 3000,
    target: 20,
  },
  {
    key: MISSION_KEY_WEEKLY_PROFIT,
    title: 'Weekly Profit Maker',
    description: 'Earn 5000 chips in net profit from games this week',
    type: 'WEEKLY',
    periodType: 'WEEK',
    rewardChips: 5000,
    target: 5000,
  },
];

// ── Helper: period boundaries ────────────────────────────────────────────────

/** Returns midnight UTC of the current day. */
export function getDailyPeriodStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Returns Monday 00:00 UTC of the current week. */
export function getWeeklyPeriodStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getTime() + diffToMonday * 86_400_000);
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
    ),
  );
}

@Injectable()
export class MissionService implements OnModuleInit {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  // ── OnModuleInit ───────────────────────────────────────────────────────────

  async onModuleInit() {
    await this.seedMissions();
  }

  /** Ensures all mission definitions exist in the DB (upsert). */
  async seedMissions(): Promise<void> {
    const results = await Promise.allSettled(
      MISSION_DEFINITIONS.map((def) =>
        this.prisma.mission.upsert({
          where: { key: def.key },
          update: {
            title: def.title,
            description: def.description,
            type: def.type,
            periodType: def.periodType ?? null,
            rewardChips: def.rewardChips,
            target: def.target,
          },
          create: {
            key: def.key,
            title: def.title,
            description: def.description,
            type: def.type,
            periodType: def.periodType ?? null,
            rewardChips: def.rewardChips,
            target: def.target,
          },
        }),
      ),
    );
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        `seedMissions: ${failures.length}/${MISSION_DEFINITIONS.length} upserts failed`,
      );
      for (const f of failures) {
        this.logger.error(f.reason);
      }
    } else {
      this.logger.log(
        `Missions seeded (${MISSION_DEFINITIONS.length} upserts)`,
      );
    }
  }

  // ── Period helpers ──────────────────────────────────────────────────────────

  /** Returns the periodStart for a recurring mission based on its periodType. */
  private getPeriodStart(missionType: string, periodType?: string): Date {
    if (missionType === 'ONE_TIME') return new Date(0); // epoch: fixed for one-time missions
    if (periodType === 'WEEK') return getWeeklyPeriodStart();
    return getDailyPeriodStart();
  }

  /**
   * Resets ACTIVE/COMPLETED daily user-mission records to EXPIRED.
   * Called by the daily cron at midnight UTC.
   */
  async resetDailyMissions(): Promise<number> {
    const yesterday = getDailyPeriodStart(); // midnight today UTC = start of new day
    const yesterdayEnd = new Date(yesterday.getTime() + 86_400_000 - 1); // end of yesterday

    const result = await this.prisma.userMission.updateMany({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
        periodStart: {
          lt: yesterday, // belongs to a previous day
        },
        mission: {
          type: 'DAILY',
          periodType: 'DAY',
        },
      },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(
      `[resetDailyMissions] expired ${result.count} daily mission records`,
    );
    return result.count;
  }

  /**
   * Resets ACTIVE/COMPLETED weekly user-mission records to EXPIRED.
   * Called by the weekly cron on Monday 00:00 UTC.
   */
  async resetWeeklyMissions(): Promise<number> {
    const thisWeekStart = getWeeklyPeriodStart();

    const result = await this.prisma.userMission.updateMany({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
        periodStart: {
          lt: thisWeekStart, // belongs to a previous week
        },
        mission: {
          type: 'WEEKLY',
          periodType: 'WEEK',
        },
      },
      data: { status: 'EXPIRED' },
    });
    this.logger.log(
      `[resetWeeklyMissions] expired ${result.count} weekly mission records`,
    );
    return result.count;
  }

  // ── Progress tracking ──────────────────────────────────────────────────────

  /**
   * Increment progress for a specific mission for a given user.
   * Automatically completes and claims the mission when target is reached.
   * Idempotent for already-completed/claimed missions.
   *
   * @param increment Can be > 1 for missions that track amounts (e.g. rake, profit)
   */
  async progressMission(
    userId: string,
    missionKey: string,
    increment = 1,
  ): Promise<{ completed: boolean; rewardChips: number }> {
    const mission = await this.prisma.mission.findUnique({
      where: { key: missionKey },
    });
    if (!mission) {
      this.logger.warn(`[progressMission] mission not found: ${missionKey}`);
      return { completed: false, rewardChips: 0 };
    }

    const periodStart = this.getPeriodStart(
      mission.type,
      mission.periodType ?? undefined,
    );

    // Find or create user-mission record for this period
    let userMission = await this.prisma.userMission.findUnique({
      where: {
        userId_missionId_periodStart: {
          userId,
          missionId: mission.id,
          periodStart,
        },
      },
    });

    if (!userMission) {
      userMission = await this.prisma.userMission.create({
        data: {
          userId,
          missionId: mission.id,
          status: 'ACTIVE',
          progress: 0,
          periodStart,
        },
      });
    }

    // Already completed or claimed — skip
    if (userMission.status !== 'ACTIVE') {
      return { completed: false, rewardChips: 0 };
    }

    const newProgress = Math.min(
      userMission.progress + increment,
      mission.target,
    );
    const isComplete = newProgress >= mission.target;

    await this.prisma.userMission.update({
      where: { id: userMission.id },
      data: {
        progress: newProgress,
        status: isComplete ? 'COMPLETED' : 'ACTIVE',
        completedAt: isComplete ? new Date() : undefined,
      },
    });

    if (isComplete) {
      await this.claimMission(userId, mission, userMission.id);
    }

    return {
      completed: isComplete,
      rewardChips: isComplete ? mission.rewardChips : 0,
    };
  }

  /** Awards chips and marks the user-mission as CLAIMED. */
  private async claimMission(
    userId: string,
    mission: { rewardChips: number; key: string },
    userMissionId: string,
  ): Promise<void> {
    await this.walletService.addChips(userId, mission.rewardChips);

    await this.prisma.userMission.update({
      where: { id: userMissionId },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });

    await this.prisma.transaction.create({
      data: {
        userId,
        amount: mission.rewardChips,
        type: 'MISSION_REWARD',
      },
    });

    this.logger.log(
      `[claimMission] user=${userId} mission=${mission.key} — awarded ${mission.rewardChips} chips`,
    );
  }

  // ── Game event wiring helpers ──────────────────────────────────────────────

  /**
   * Call from game.handler when a hand completes and a user wins.
   * Tracks: P1-DAILY-PLAY, P1-DAILY-WIN, P1-DAILY-BIG-POT, P2-WEEKLY-WINS.
   *
   * @param userId Winner user id
   * @param potSize The winning pot size in chips
   */
  async onHandWon(userId: string, potSize: number): Promise<void> {
    await this.progressMission(userId, MISSION_KEY_DAILY_PLAY);
    await this.progressMission(userId, MISSION_KEY_DAILY_WIN);
    await this.progressMission(userId, MISSION_KEY_WEEKLY_WINS);
    if (potSize >= 1000) {
      await this.progressMission(userId, MISSION_KEY_DAILY_BIG_POT);
    }
  }

  /**
   * Call from game.handler when a hand completes (all participants).
   * Tracks: P1-DAILY-PLAY.
   */
  async onHandPlayed(userId: string): Promise<void> {
    await this.progressMission(userId, MISSION_KEY_DAILY_PLAY);
  }

  /**
   * Call when a settlement is applied — adds to the user's session profit.
   * Tracks: P2-WEEKLY-PROFIT (net chip delta this period).
   *
   * @param userId
   * @param chipDelta Positive for win, negative for loss
   */
  async onSettlement(userId: string, chipDelta: number): Promise<void> {
    // P2-WEEKLY-PROFIT tracks cumulative net profit (sum of positive deltas)
    if (chipDelta > 0) {
      // Record net profit toward the weekly profit mission
      // We use progressMission with the positive chip delta
      await this.progressMission(userId, MISSION_KEY_WEEKLY_PROFIT, chipDelta);
    }
  }

  /**
   * Call from deposit service when a deposit is confirmed.
   * Tracks: P1-FIRST-DEPOSIT, P1-DAILY-DEPOSIT.
   */
  async onDeposit(userId: string): Promise<void> {
    await this.progressMission(userId, MISSION_KEY_FIRST_DEPOSIT);
    await this.progressMission(userId, MISSION_KEY_DAILY_DEPOSIT);
  }

  /**
   * Call when rake is contributed from a hand.
   * Tracks: P1-DAILY-RAKE.
   *
   * @param userId
   * @param rakeAmount Chips contributed as rake
   */
  async onRakeContributed(userId: string, rakeAmount: number): Promise<void> {
    await this.progressMission(userId, MISSION_KEY_DAILY_Rake, rakeAmount);
  }

  /**
   * Call periodically (e.g. every minute) with the player's total session time today.
   * Tracks: P1-DAILY-HOUR (target is 60 minutes).
   *
   * @param userId
   * @param totalMinutes Total minutes played today (cumulative)
   */
  async onPlayTimeUpdated(userId: string, totalMinutes: number): Promise<void> {
    await this.progressMission(userId, MISSION_KEY_DAILY_HOUR, totalMinutes);
  }

  /**
   * Convenience: emit mission progress update to a user via WebSocket.
   */
  async emitMissionUpdate(
    userId: string,
    missionKey: string,
    completed: boolean,
    rewardChips: number,
    server: import('socket.io').Server,
  ): Promise<void> {
    server.to(userId).emit('mission_updated', {
      missionKey,
      completed,
      rewardChips,
    });
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Returns all missions (definitions + user's current progress for this period). */
  async getUserMissions(userId: string) {
    const missions = await this.prisma.mission.findMany({
      orderBy: { key: 'asc' },
    });

    const now = new Date();
    const dailyStart = getDailyPeriodStart();
    const weeklyStart = getWeeklyPeriodStart();

    // For ONE_TIME missions: query without period constraint
    // For DAILY/WEEKLY: query only the current period
    const userMissions = await this.prisma.userMission.findMany({
      where: {
        userId,
        OR: [
          // Current daily period
          {
            periodStart: dailyStart,
            mission: { type: 'DAILY' },
          },
          // Current weekly period
          {
            periodStart: weeklyStart,
            mission: { type: 'WEEKLY' },
          },
          // All ONE_TIME missions (no period filter)
          {
            mission: { type: 'ONE_TIME' },
          },
        ],
      },
    });

    const map = new Map(
      userMissions.map((um) => [
        um.missionId + '|' + um.periodStart.getTime(),
        um,
      ]),
    );

    return missions.map((m) => {
      const periodStart =
        m.type === 'WEEKLY'
          ? weeklyStart
          : m.type === 'DAILY'
            ? dailyStart
            : null;
      const key = periodStart ? m.id + '|' + periodStart.getTime() : m.id;
      const um = map.get(key);

      return {
        key: m.key,
        title: m.title,
        description: m.description,
        type: m.type,
        rewardChips: m.rewardChips,
        target: m.target,
        progress: um?.progress ?? 0,
        status: um?.status ?? 'ACTIVE',
        completedAt: um?.completedAt ?? null,
        claimedAt: um?.claimedAt ?? null,
      };
    });
  }

  /** Returns active missions (ACTIVE or COMPLETED, non-expired) for a user. */
  async getActiveMissions(userId: string) {
    return this.prisma.userMission.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        mission: { type: { not: 'ONE_TIME' } },
        periodStart: {
          gte: getDailyPeriodStart(), // current period only
        },
      },
      include: { mission: true },
    });
  }

  /** Returns true if user has already claimed the P1-FIRST-DEPOSIT mission. */
  async hasReceivedFirstDepositReward(userId: string): Promise<boolean> {
    const mission = await this.prisma.mission.findUnique({
      where: { key: MISSION_KEY_FIRST_DEPOSIT },
    });
    if (!mission) return false;
    const um = await this.prisma.userMission.findUnique({
      where: {
        userId_missionId_periodStart: {
          userId,
          missionId: mission.id,
          periodStart: new Date(0), // ONE_TIME missions use epoch
        },
      },
    });
    return um?.status === 'CLAIMED';
  }
}
