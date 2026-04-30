import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from '../room/room.service';
import { TournamentService } from '../tournament/tournament.service';
import { AppGateway } from '../websocket/app.gateway';
import {
  TournamentType,
  BtcConfig,
  SngConfig,
  createBtcBlindSchedule,
  createDefaultBlindSchedule,
  BTC_CLOCK_INTERVAL_SECONDS,
  BTC_TOTAL_LEVELS,
} from '@texas/shared/types/tournament';
import {
  CreateScheduleDto,
  ScheduleEntryResponseDto,
  ScheduleListResponseDto,
  TournamentScheduleStatus,
  UpcomingTournamentsResponseDto,
  ListSchedulesQueryDto,
} from './dto/schedule.dto';
import { Server } from 'socket.io';
import { EventEmitter } from 'events';

/** Redis key prefix for tournament schedule entries */
const SCHEDULE_KEY_PREFIX = 'tournament:schedule:';
/** Redis key for schedule list (sorted set by start time) */
const SCHEDULE_LIST_KEY = 'tournament:schedule:list';
/** Event name for schedule updates */
const SCHEDULE_UPDATE_EVENT = 'schedule_update';
/** Event name for tournament reminders */
const TOURNAMENT_REMINDER_EVENT = 'tournament_reminder';

/** In-memory schedule store (mirrors Redis for fast access) */
interface ScheduleEntry {
  id: string;
  name: string;
  type: TournamentType;
  buyin: number;
  maxPlayers: number;
  smallBlind: number;
  clockIntervalSeconds: number;
  scheduledStartTime: string | null;
  prizeDistribution: readonly [number, number, number];
  totalPrize: number;
  isGuarantee?: boolean;
  registeredCount?: number;
  status: TournamentScheduleStatus;
  roomId: string | null;
  blindSchedule?: { level: number; smallBlind: number; bigBlind: number; durationSeconds: number; }[];
  currentBlindLevel?: number;
  blindLevelStartedAt?: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TournamentScheduleService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TournamentScheduleService.name);
  private readonly scheduleEmitter = new EventEmitter();
  private readonly scheduleStore = new Map<string, ScheduleEntry>();
  private schedulerInterval: NodeJS.Timeout | null = null;
  private reminderTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly roomService: RoomService,
    private readonly tournamentService: TournamentService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  onModuleInit() {
    // Load existing schedules from Redis on startup
    void this.loadSchedulesFromRedis();
    // Start the scheduler interval
    this.startScheduler();
  }

  onModuleDestroy() {
    this.stopScheduler();
    this.scheduleEmitter.removeAllListeners();
    // Clear all reminder timers
    for (const timer of this.reminderTimers.values()) {
      clearTimeout(timer);
    }
    this.reminderTimers.clear();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public API
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Create a new tournament schedule entry
   */
  async createSchedule(
    dto: CreateScheduleDto,
  ): Promise<ScheduleEntryResponseDto> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Check for conflicts
    if (dto.scheduledStartTime) {
      await this.checkScheduleConflict(dto.scheduledStartTime, dto.type);
    }

    const entry: ScheduleEntry = {
      id,
      name: dto.name,
      type: dto.type,
      buyin: dto.buyin,
      maxPlayers: dto.maxPlayers,
      smallBlind: dto.smallBlind,
      clockIntervalSeconds:
        dto.clockIntervalSeconds ??
        (dto.type === TournamentType.BTC ? BTC_CLOCK_INTERVAL_SECONDS : 180),
      scheduledStartTime: dto.scheduledStartTime ?? null,
      prizeDistribution: dto.prizeDistribution ?? [60, 30, 10],
      totalPrize: dto.buyin * dto.maxPlayers,
      isGuarantee: dto.isGuarantee ?? false,
      registeredCount: 0,
      status: TournamentScheduleStatus.SCHEDULED,
      roomId: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory
    this.scheduleStore.set(id, entry);

    // Persist to Redis
    await this.saveScheduleToRedis(entry);

    // Schedule reminder if there's a start time
    if (entry.scheduledStartTime) {
      this.scheduleReminder(entry);
    }

    // Emit schedule update event
    this.emitScheduleUpdate('schedule_created', entry);

    this.logger.log(`Created tournament schedule: ${entry.name} (${id})`);

    return this.toResponseDto(entry);
  }

  /**
   * Get a schedule entry by ID
   */
  async getSchedule(id: string): Promise<ScheduleEntryResponseDto> {
    const entry = this.scheduleStore.get(id);
    if (!entry) {
      // Try to load from Redis
      const fromRedis = await this.loadScheduleFromRedis(id);
      if (!fromRedis) {
        throw new NotFoundException(`Schedule entry ${id} not found`);
      }
      return fromRedis;
    }
    return this.toResponseDto(entry);
  }

  /**
   * List all schedule entries with optional filtering
   */
  async listSchedules(
    query: ListSchedulesQueryDto,
  ): Promise<ScheduleListResponseDto> {
    let entries = Array.from(this.scheduleStore.values());

    // Filter by type
    if (query.type) {
      entries = entries.filter((e) => e.type === query.type);
    }

    // Filter by status
    if (query.status) {
      entries = entries.filter((e) => e.status === query.status);
    }

    // Sort by scheduled start time (nulls last for ASAP)
    entries.sort((a, b) => {
      if (!a.scheduledStartTime && !b.scheduledStartTime) return 0;
      if (!a.scheduledStartTime) return 1;
      if (!b.scheduledStartTime) return -1;
      return (
        new Date(a.scheduledStartTime).getTime() -
        new Date(b.scheduledStartTime).getTime()
      );
    });

    // Paginate
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = entries.length;
    const paginatedEntries = entries.slice((page - 1) * limit, page * limit);

    return {
      entries: paginatedEntries.map((e) => this.toResponseDto(e)),
      total,
    };
  }

  /**
   * Get upcoming tournaments (for calendar display)
   */
  async getUpcomingTournaments(
    limit = 10,
  ): Promise<UpcomingTournamentsResponseDto> {
    const now = new Date();
    const scheduled = Array.from(this.scheduleStore.values())
      .filter(
        (e) =>
          e.status === TournamentScheduleStatus.SCHEDULED &&
          (!e.scheduledStartTime || new Date(e.scheduledStartTime) > now),
      )
      .sort((a, b) => {
        if (!a.scheduledStartTime) return -1;
        if (!b.scheduledStartTime) return 1;
        return (
          new Date(a.scheduledStartTime).getTime() -
          new Date(b.scheduledStartTime).getTime()
        );
      });

    return {
      next: scheduled.length > 0 ? this.toResponseDto(scheduled[0]) : null,
      upcoming: scheduled.slice(0, limit).map((e) => this.toResponseDto(e)),
      totalScheduled: scheduled.length,
    };
  }

  /**
   * Cancel a scheduled tournament
   */
  async cancelSchedule(id: string): Promise<ScheduleEntryResponseDto> {
    const entry = this.scheduleStore.get(id);
    if (!entry) {
      throw new NotFoundException(`Schedule entry ${id} not found`);
    }

    if (entry.status !== TournamentScheduleStatus.SCHEDULED) {
      throw new ConflictException(
        'Only scheduled tournaments can be cancelled',
      );
    }

    entry.status = TournamentScheduleStatus.CANCELLED;
    entry.updatedAt = new Date().toISOString();

    // Clear reminder timer
    const reminderTimer = this.reminderTimers.get(id);
    if (reminderTimer) {
      clearTimeout(reminderTimer);
      this.reminderTimers.delete(id);
    }

    await this.saveScheduleToRedis(entry);
    this.emitScheduleUpdate('schedule_cancelled', entry);

    this.logger.log(`Cancelled tournament schedule: ${entry.name} (${id})`);

    return this.toResponseDto(entry);
  }

  /**
   * Start a scheduled tournament (create room and initialize tournament)
   */
  async startTournament(id: string): Promise<ScheduleEntryResponseDto> {
    const entry = this.scheduleStore.get(id);
    if (!entry) {
      throw new NotFoundException(`Schedule entry ${id} not found`);
    }

    if (entry.status !== TournamentScheduleStatus.SCHEDULED) {
      throw new ConflictException('Only scheduled tournaments can be started');
    }

    // Create a room for this tournament
    const room = await this.createTournamentRoom(entry);

    entry.status = TournamentScheduleStatus.RUNNING;
    entry.roomId = room.id;
    entry.updatedAt = new Date().toISOString();

    await this.saveScheduleToRedis(entry);
    this.emitScheduleUpdate('tournament_started', entry);

    // Emit WebSocket event
    const server = this.getServer();
    if (server) {
      server.emit('tournament_started', {
        id: entry.id,
        name: entry.name,
        type: entry.type,
        roomId: room.id,
        buyin: entry.buyin,
        maxPlayers: entry.maxPlayers,
      });
    }

    this.logger.log(
      `Started tournament: ${entry.name} (${id}), room: ${room.id}`,
    );

    return this.toResponseDto(entry);
  }

  /**
   * Complete a tournament and update its status
   */
  async completeTournament(id: string): Promise<ScheduleEntryResponseDto> {
    const entry = this.scheduleStore.get(id);
    if (!entry) {
      throw new NotFoundException(`Schedule entry ${id} not found`);
    }

    if (entry.status !== TournamentScheduleStatus.RUNNING) {
      throw new ConflictException('Only running tournaments can be completed');
    }

    entry.status = TournamentScheduleStatus.COMPLETED;
    entry.updatedAt = new Date().toISOString();

    await this.saveScheduleToRedis(entry);
    this.emitScheduleUpdate('tournament_completed', entry);

    this.logger.log(`Completed tournament: ${entry.name} (${id})`);

    return this.toResponseDto(entry);
  }

  /**
   * Emit a reminder for an upcoming tournament
   */
  async emitReminder(id: string): Promise<void> {
    const entry = this.scheduleStore.get(id);
    if (!entry || entry.status !== TournamentScheduleStatus.SCHEDULED) {
      return;
    }

    const server = this.getServer();
    if (server) {
      server.emit(TOURNAMENT_REMINDER_EVENT, {
        id: entry.id,
        name: entry.name,
        type: entry.type,
        scheduledStartTime: entry.scheduledStartTime,
        buyin: entry.buyin,
      });
    }

    this.logger.log(`Emitted reminder for tournament: ${entry.name} (${id})`);
  }

  /**
   * Get the event emitter for schedule updates (used by gateway)
   */
  getScheduleEmitter(): EventEmitter {
    return this.scheduleEmitter;
  }

  // ════════════════════════════════════════════════════════════════════════
  // WebSocket Event Emitters
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Emit a schedule update event to all connected clients
   */
  emitScheduleUpdate(action: string, entry: ScheduleEntry): void {
    const payload = {
      action,
      entry: this.toResponseDto(entry),
      timestamp: Date.now(),
    };

    this.scheduleEmitter.emit(SCHEDULE_UPDATE_EVENT, payload);

    // Also emit directly to WebSocket server
    const server = this.getServer();
    if (server) {
      server.emit('schedule_update', payload);
    }

    this.logger.debug(`Emitted schedule_update: ${action} for ${entry.id}`);
  }

  private getServer(): Server | null {
    if (this.appGateway && (this.appGateway as any).server) {
      return (this.appGateway as any).server as Server;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Redis Persistence
  // ════════════════════════════════════════════════════════════════════════

  private async saveScheduleToRedis(entry: ScheduleEntry): Promise<void> {
    if (!this.redisService.isAvailable) {
      this.logger.warn('Redis unavailable - schedule will not be persisted');
      return;
    }

    try {
      const key = `${SCHEDULE_KEY_PREFIX}${entry.id}`;
      await this.redisService.set(key, JSON.stringify(entry), 86400 * 7); // 7 days TTL

      // Add to sorted set by start time
      const score = entry.scheduledStartTime
        ? new Date(entry.scheduledStartTime).getTime()
        : Date.now(); // ASAP tournaments get current time as score
      await this.redisService.zadd(SCHEDULE_LIST_KEY, score, entry.id);
    } catch (err) {
      this.logger.error(
        `Failed to save schedule to Redis: ${(err as Error).message}`,
      );
    }
  }

  private async loadScheduleFromRedis(
    id: string,
  ): Promise<ScheduleEntryResponseDto | null> {
    if (!this.redisService.isAvailable) {
      return null;
    }

    try {
      const key = `${SCHEDULE_KEY_PREFIX}${id}`;
      const data = await this.redisService.get(key);
      if (!data) return null;

      const entry: ScheduleEntry = JSON.parse(data);
      this.scheduleStore.set(id, entry);
      return this.toResponseDto(entry);
    } catch (err) {
      this.logger.error(
        `Failed to load schedule from Redis: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async loadSchedulesFromRedis(): Promise<void> {
    if (!this.redisService.isAvailable) {
      this.logger.warn('Redis unavailable - using in-memory schedule only');
      return;
    }

    try {
      // We store schedules individually, just log the count
      // In production, you'd want to scan for all keys with the prefix
      this.logger.log(
        `Loaded ${this.scheduleStore.size} schedule entries from Redis`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to load schedules from Redis: ${(err as Error).message}`,
      );
    }
  }

  private async deleteScheduleFromRedis(id: string): Promise<void> {
    if (!this.redisService.isAvailable) return;

    try {
      const key = `${SCHEDULE_KEY_PREFIX}${id}`;
      await this.redisService.del(key);
    } catch (err) {
      this.logger.error(
        `Failed to delete schedule from Redis: ${(err as Error).message}`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Scheduler
  // ════════════════════════════════════════════════════════════════════════

  private startScheduler(): void {
    // Run every 30 seconds to check for tournaments to start
    this.schedulerInterval = setInterval(() => {
      void this.processScheduledTournaments();
    }, 30_000);

    this.logger.log('Tournament schedule scheduler started (30s interval)');
  }

  private stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Process scheduled tournaments - start any that are due
   */
  private async processScheduledTournaments(): Promise<void> {
    const now = new Date();

    for (const entry of this.scheduleStore.values()) {
      if (entry.status !== TournamentScheduleStatus.SCHEDULED) continue;
      if (!entry.scheduledStartTime) continue;

      const scheduledTime = new Date(entry.scheduledStartTime);

      // If tournament is due (or overdue), it should be started
      // Note: Actual starting is done via API call, not automatically
      if (scheduledTime <= now) {
        this.logger.log(
          `Tournament ${entry.name} (${entry.id}) is due to start`,
        );
      }
    }
  }

  /**
   * Schedule a reminder for an upcoming tournament
   */
  private scheduleReminder(entry: ScheduleEntry): void {
    if (!entry.scheduledStartTime) return;

    const scheduledTime = new Date(entry.scheduledStartTime).getTime();
    const now = Date.now();
    const fiveMinBefore = scheduledTime - 5 * 60 * 1000;
    const delay = fiveMinBefore - now;

    if (delay <= 0) {
      // Reminder time has passed, skip
      return;
    }

    // Clear any existing timer
    const existing = this.reminderTimers.get(entry.id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.emitReminder(entry.id);
      this.reminderTimers.delete(entry.id);
    }, delay);

    this.reminderTimers.set(entry.id, timer);
    this.logger.debug(
      `Scheduled reminder for tournament ${entry.id} in ${Math.round(delay / 60000)} minutes`,
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Room Creation
  // ════════════════════════════════════════════════════════════════════════

  private async createTournamentRoom(entry: ScheduleEntry): Promise<any> {
    // Create tournament config based on type
    let tournamentConfig: SngConfig | BtcConfig;

    if (entry.type === TournamentType.BTC) {
      tournamentConfig = {
        type: TournamentType.BTC,
        buyin: entry.buyin,
        maxPlayers: entry.maxPlayers,
        prizeDistribution: entry.prizeDistribution,
        blindSchedule: createBtcBlindSchedule(entry.smallBlind),
        currentBlindLevel: 0,
        blindLevelStartedAt: Date.now(),
        totalPrize: entry.buyin * entry.maxPlayers,
        clockIntervalSeconds: entry.clockIntervalSeconds,
        totalLevels: BTC_TOTAL_LEVELS,
        currentTick: 1,
      } as BtcConfig;
    } else {
      // SNG or MTT - use SNG config
      tournamentConfig = {
        type: TournamentType.SNG,
        buyin: entry.buyin,
        maxPlayers: entry.maxPlayers,
        prizeDistribution: entry.prizeDistribution,
        blindSchedule: createDefaultBlindSchedule(entry.smallBlind),
        currentBlindLevel: 0,
        blindLevelStartedAt: Date.now(),
        totalPrize: entry.buyin * entry.maxPlayers,
      } as SngConfig;
    }

    // Create the room via RoomService
    const room = await this.roomService.createRoom({
      name: entry.name,
      blindSmall: entry.smallBlind,
      blindBig: entry.smallBlind * 2,
      maxPlayers: entry.maxPlayers,
      minBuyIn: entry.buyin,
      isTournament: true,
      tournamentConfig: tournamentConfig as any,
    });

    return room;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return crypto.randomUUID();
  }

  private async checkScheduleConflict(
    startTime: string,
    type: TournamentType,
  ): Promise<void> {
    const time = new Date(startTime).getTime();

    for (const entry of this.scheduleStore.values()) {
      if (entry.type !== type) continue;
      if (entry.status === TournamentScheduleStatus.CANCELLED) continue;

      const entryTime = entry.scheduledStartTime
        ? new Date(entry.scheduledStartTime).getTime()
        : null;

      // Check if within 5 minutes of another tournament of same type
      if (entryTime && Math.abs(entryTime - time) < 5 * 60 * 1000) {
        throw new ConflictException(
          `Another ${type} tournament is scheduled within 5 minutes of this time`,
        );
      }
    }
  }

  private toResponseDto(entry: ScheduleEntry): ScheduleEntryResponseDto {
    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      buyin: entry.buyin,
      maxPlayers: entry.maxPlayers,
      smallBlind: entry.smallBlind,
      clockIntervalSeconds: entry.clockIntervalSeconds,
      scheduledStartTime: entry.scheduledStartTime,
      prizeDistribution: entry.prizeDistribution,
      totalPrize: entry.totalPrize,
      isGuarantee: entry.isGuarantee,
      registeredCount: entry.registeredCount,
      status: entry.status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      blindSchedule: entry.blindSchedule ?? [],
      currentBlindLevel: entry.currentBlindLevel ?? 0,
      blindLevelStartedAt: entry.blindLevelStartedAt ?? Date.now(),
    };
  }
}
