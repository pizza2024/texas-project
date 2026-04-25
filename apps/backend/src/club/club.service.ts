import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketManager } from '../websocket/websocket-manager';
import { RedisService } from '../redis/redis.service';
import { Club, ClubMember as PrismaClubMember, ClubChat } from '@prisma/client';
import type { ClubMember as SharedClubMember } from '@texas/shared';
type ClubMember = PrismaClubMember;
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { CreateInviteCodeDto } from './dto/create-invite-code.dto';
import { ClubStatus } from './entity/club-status.enum';
import { MemberRole } from './entity/member-role.enum';

// ── Info interfaces ─────────────────────────────────────────────────────────

export interface ClubInfo {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  status: ClubStatus;
  createdAt: Date;
  ownerId: string;
  memberCount?: number;
  isMember?: boolean;
  myRole?: MemberRole;
}

export interface ClubMemberInfo {
  id: string;
  role: MemberRole;
  joinedAt: Date;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    status: string;
  };
}

export interface ClubChatInfo {
  id: string;
  message: string;
  createdAt: Date;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ClubService {
  private readonly INVITE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebSocketManager))
    private wsManager: WebSocketManager,
    private redis: RedisService,
  ) {}

  private generateInviteCode(): string {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += this.INVITE_CHARS[randomInt(0, this.INVITE_CHARS.length)];
    }
    return code;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Club CRUD
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Create a new club. The creator becomes the OWNER automatically.
   */
  async createClub(userId: string, dto: CreateClubDto): Promise<Club> {
    const club = await this.prisma.club.create({
      data: {
        name: dto.name,
        description: dto.description,
        avatar: dto.avatar,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: MemberRole.OWNER,
          },
        },
      },
    });
    return club;
  }

  /**
   * Get club details. Optionally include current user's membership info.
   */
  async getClub(clubId: string, userId?: string): Promise<ClubInfo> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        _count: { select: { members: true } },
        members: userId ? { where: { userId }, select: { role: true } } : false,
      },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    const membership = Array.isArray(club.members) ? club.members[0] : null;

    return {
      id: club.id,
      name: club.name,
      description: club.description,
      avatar: club.avatar,
      status: club.status as ClubStatus,
      createdAt: club.createdAt,
      ownerId: club.ownerId,
      memberCount: club._count.members,
      isMember: !!membership,
      myRole: membership?.role as MemberRole | undefined,
    };
  }

  /**
   * List clubs with pagination and optional name search.
   */
  async listClubs(
    search?: string,
    cursor?: string,
    limit: number = 20,
    userId?: string,
  ): Promise<{ data: ClubInfo[]; nextCursor: string | null }> {
    const whereClause = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const clubs = await this.prisma.club.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true } },
        members: userId ? { where: { userId }, select: { role: true } } : false,
      },
    });

    const hasMore = clubs.length > limit;
    const items = hasMore ? clubs.slice(0, limit) : clubs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const data: ClubInfo[] = items.map((club) => {
      const membership = Array.isArray(club.members) ? club.members[0] : null;
      return {
        id: club.id,
        name: club.name,
        description: club.description,
        avatar: club.avatar,
        status: club.status as ClubStatus,
        createdAt: club.createdAt,
        ownerId: club.ownerId,
        memberCount: club._count.members,
        isMember: !!membership,
        myRole: membership?.role as MemberRole | undefined,
      };
    });

    return { data, nextCursor };
  }

  /**
   * Update club info. Only owner can do this.
   */
  async updateClub(
    userId: string,
    clubId: string,
    dto: UpdateClubDto,
  ): Promise<Club> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId !== userId) {
      throw new ForbiddenException('Only the club owner can update the club');
    }

    return this.prisma.club.update({
      where: { id: clubId },
      data: {
        name: dto.name,
        description: dto.description,
        avatar: dto.avatar,
      },
    });
  }

  /**
   * Delete a club. Only owner can do this.
   */
  async deleteClub(userId: string, clubId: string): Promise<void> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.ownerId !== userId) {
      throw new ForbiddenException('Only the club owner can delete the club');
    }

    await this.prisma.club.delete({ where: { id: clubId } });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Membership management
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Join a club (public). Creates a MEMBER record.
   */
  async joinClub(userId: string, clubId: string): Promise<ClubMember> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.status !== ClubStatus.ACTIVE) {
      throw new BadRequestException('Club is not active');
    }

    const existing = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (existing) {
      throw new ConflictException('Already a member of this club');
    }

    const membership = await this.prisma.clubMember.create({
      data: { clubId, userId, role: MemberRole.MEMBER },
    });

    // Notify club members
    this.wsManager.sendToAll('club_member_joined', {
      clubId,
      userId,
    });

    return membership;
  }

  /**
   * Leave a club. Owner cannot leave (must delete or transfer ownership).
   */
  async leaveClub(userId: string, clubId: string): Promise<void> {
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.role === MemberRole.OWNER) {
      throw new BadRequestException(
        'Owner cannot leave the club. Delete or transfer ownership first.',
      );
    }

    await this.prisma.clubMember.delete({
      where: { clubId_userId: { clubId, userId } },
    });

    this.wsManager.sendToAll('club_member_left', {
      clubId,
      userId,
    });
  }

  /**
   * Get club members with pagination and optional nickname search.
   */
  async getMembers(
    clubId: string,
    search?: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{ data: ClubMemberInfo[]; nextCursor: string | null }> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException('Club not found');
    }

    const whereClause = search
      ? {
          clubId,
          user: {
            nickname: { contains: search, mode: 'insensitive' as const },
          },
        }
      : { clubId };

    const members = await this.prisma.clubMember.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { joinedAt: 'asc' },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true, status: true },
        },
      },
    });

    const hasMore = members.length > limit;
    const items = hasMore ? members.slice(0, limit) : members;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const data: ClubMemberInfo[] = items.map((m) => ({
      id: m.id,
      role: m.role as MemberRole,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        nickname: m.user.nickname,
        avatar: m.user.avatar,
        status: m.user.status,
      },
    }));

    return { data, nextCursor };
  }

  /**
   * Change a member's role. Only OWNER can do this, and cannot change own role.
   */
  async changeMemberRole(
    userId: string,
    clubId: string,
    targetUserId: string,
    newRole: MemberRole,
  ): Promise<ClubMember> {
    const myMembership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!myMembership || myMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only the club owner can change roles');
    }

    if (targetUserId === userId) {
      throw new BadRequestException('Cannot change your own role');
    }

    const targetMembership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Target member not found');
    }

    if (targetMembership.role === MemberRole.OWNER) {
      throw new BadRequestException("Cannot change the owner's role");
    }

    return this.prisma.clubMember.update({
      where: { clubId_userId: { clubId, userId: targetUserId } },
      data: { role: newRole },
    });
  }

  /**
   * Kick a member. OWNER or ADMIN can kick MEMBERs.
   */
  async kickMember(
    userId: string,
    clubId: string,
    targetUserId: string,
  ): Promise<void> {
    const myMembership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!myMembership) {
      throw new ForbiddenException('You are not a member of this club');
    }

    if (myMembership.role === MemberRole.MEMBER) {
      throw new ForbiddenException('Only admins and owners can kick members');
    }

    const targetMembership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Target member not found');
    }

    if (targetMembership.role === MemberRole.OWNER) {
      throw new BadRequestException('Cannot kick the club owner');
    }

    if (
      myMembership.role === MemberRole.ADMIN &&
      targetMembership.role === MemberRole.ADMIN
    ) {
      throw new ForbiddenException('Admins cannot kick other admins');
    }

    await this.prisma.clubMember.delete({
      where: { clubId_userId: { clubId, userId: targetUserId } },
    });

    this.wsManager.sendToAll('club_member_kicked', {
      clubId,
      kickedUserId: targetUserId,
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Chat
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Send a chat message to the club.
   */
  async sendMessage(
    userId: string,
    clubId: string,
    message: string,
  ): Promise<ClubChat> {
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a member to send messages');
    }

    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club || club.status !== ClubStatus.ACTIVE) {
      throw new BadRequestException('Club is not active');
    }

    const chat = await this.prisma.clubChat.create({
      data: { clubId, userId, message },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    this.wsManager.sendToAll('club_chat_message', {
      clubId,
      chatId: chat.id,
      userId,
      nickname: chat.user.nickname,
      avatar: chat.user.avatar,
      message: chat.message,
      createdAt: chat.createdAt,
    });

    return chat;
  }

  /**
   * Get club chat history with cursor pagination.
   */
  async getChatHistory(
    clubId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<{ data: ClubChatInfo[]; nextCursor: string | null }> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException('Club not found');
    }

    const records = await this.prisma.clubChat.findMany({
      where: { clubId },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Return in chronological order
    const data: ClubChatInfo[] = items
      .slice()
      .reverse()
      .map((c) => ({
        id: c.id,
        message: c.message,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          nickname: c.user.nickname,
          avatar: c.user.avatar,
        },
      }));

    return { data, nextCursor };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Club lookup helpers (used by WebSocket gateway)
  // ════════════════════════════════════════════════════════════════════════

  async getUserClubs(userId: string): Promise<ClubInfo[]> {
    const memberships = await this.prisma.clubMember.findMany({
      where: { userId },
      include: {
        club: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.club.id,
      name: m.club.name,
      description: m.club.description,
      avatar: m.club.avatar,
      status: m.club.status as ClubStatus,
      createdAt: m.club.createdAt,
      ownerId: m.club.ownerId,
      memberCount: m.club._count.members,
      isMember: true,
      myRole: m.role as MemberRole,
    }));
  }

  async isClubMember(userId: string, clubId: string): Promise<boolean> {
    const m = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    return !!m;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Invite Codes
  // ════════════════════════════════════════════════════════════════════════

  async createInviteCode(
    userId: string,
    clubId: string,
    dto: CreateInviteCodeDto,
  ): Promise<{
    code: string;
    url: string;
    maxUses: number;
    expiresAt: Date | null;
    club: { id: string; name: string; avatar: string | null };
  }> {
    // Verify ownership/Admin
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException(
        'Only owner or admin can create invite codes',
      );
    }

    let code = this.generateInviteCode();
    // Ensure uniqueness with retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.prisma.clubInviteCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      code = this.generateInviteCode();
    }

    const expiresAt = dto.expiresInHours
      ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
      : null;

    const inviteCode = await this.prisma.clubInviteCode.create({
      data: {
        clubId,
        code,
        creatorId: userId,
        maxUses: dto.maxUses ?? 5,
        expiresAt,
      },
      include: { club: { select: { id: true, name: true, avatar: true } } },
    });

    return {
      code: inviteCode.code,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.texas.com'}/club/join?code=${inviteCode.code}`,
      maxUses: inviteCode.maxUses,
      expiresAt: inviteCode.expiresAt,
      club: inviteCode.club,
    };
  }

  async listInviteCodes(
    userId: string,
    clubId: string,
  ): Promise<
    Array<{
      id: string;
      code: string;
      maxUses: number;
      usedCount: number;
      expiresAt: Date | null;
      isActive: boolean;
      createdAt: Date;
    }>
  > {
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException('Only owner or admin can list invite codes');
    }
    return this.prisma.clubInviteCode.findMany({
      where: { clubId },
      select: {
        id: true,
        code: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteInviteCode(
    userId: string,
    clubId: string,
    codeId: string,
  ): Promise<void> {
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException(
        'Only owner or admin can delete invite codes',
      );
    }
    await this.prisma.clubInviteCode.deleteMany({
      where: { id: codeId, clubId },
    });
  }

  async validateInviteCode(code: string): Promise<{
    valid: boolean;
    club?: { id: string; name: string; avatar: string | null };
  }> {
    const inviteCode = await this.prisma.clubInviteCode.findUnique({
      where: { code },
    });
    if (!inviteCode || !inviteCode.isActive) return { valid: false };
    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date())
      return { valid: false };
    if (inviteCode.maxUses > 0 && inviteCode.usedCount >= inviteCode.maxUses)
      return { valid: false };
    return {
      valid: true,
      club: { id: inviteCode.clubId, name: '', avatar: null }, // caller should fetch full club
    };
  }

  /**
   * Join a club by invite code.
   */
  async joinByCode(userId: string, code: string): Promise<SharedClubMember> {
    const inviteCode = await this.prisma.clubInviteCode.findUnique({
      where: { code },
      include: { club: true },
    });

    if (!inviteCode || !inviteCode.isActive) {
      throw new BadRequestException('Invalid invite code');
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    if (inviteCode.maxUses > 0 && inviteCode.usedCount >= inviteCode.maxUses) {
      throw new BadRequestException('Invite code has reached max uses');
    }

    const club = inviteCode.club;
    if (club.status !== ClubStatus.ACTIVE) {
      throw new BadRequestException('Club is not active');
    }

    const existing = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: club.id, userId } },
    });

    if (existing) {
      throw new ConflictException('Already a member of this club');
    }

    // Increment usedCount
    await this.prisma.clubInviteCode.update({
      where: { id: inviteCode.id },
      data: { usedCount: { increment: 1 } },
    });

    const membership = await this.prisma.clubMember.create({
      data: { clubId: club.id, userId, role: MemberRole.MEMBER },
      include: {
        user: { select: { nickname: true, avatar: true, status: true } },
      },
    });

    this.wsManager.sendToAll('club_member_joined', {
      clubId: club.id,
      userId,
    });

    // Transform to match packages/shared ClubMember interface
    return {
      id: membership.id,
      userId: membership.userId,
      nickname: membership.user.nickname,
      avatar: membership.user.avatar,
      role: membership.role as 'OWNER' | 'ADMIN' | 'MEMBER',
      status: membership.user.status as 'OFFLINE' | 'ONLINE' | 'PLAYING',
      joinedAt: membership.joinedAt.toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Leaderboard & Stats
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Get club leaderboard — top members by a given metric within a period.
   * Metrics: elo, chips, hands, winrate
   * Periods: daily, weekly, monthly, all
   * Cached in Redis for 5 minutes.
   */
  async getLeaderboard(
    clubId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly',
    metric: 'elo' | 'chips' | 'hands' | 'winrate' = 'elo',
    limit: number = 20,
  ): Promise<
    Array<{
      userId: string;
      nickname: string;
      avatar: string | null;
      value: number;
    }>
  > {
    const cacheKey = `club:${clubId}:leaderboard:${period}:${metric}:${limit}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // malformed cache — fall through
      }
    }

    // Verify club exists
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');

    // Date filter
    const now = new Date();
    let dateFilter: Date | undefined;
    if (period === 'daily') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'monthly') {
      dateFilter = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate(),
      );
    }
    // 'all' = no date filter

    // Get club member user IDs
    const members = await this.prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);
    if (userIds.length === 0) return [];

    let result: Array<{
      userId: string;
      nickname: string;
      avatar: string | null;
      value: number;
    }> = [];

    if (metric === 'elo') {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nickname: true, avatar: true, elo: true },
        orderBy: { elo: 'desc' },
        take: limit,
      });
      result = users.map((u) => ({
        userId: u.id,
        nickname: u.nickname,
        avatar: u.avatar,
        value: u.elo,
      }));
    } else if (metric === 'chips') {
      // chips are stored on Wallet, not User
      const wallets = await this.prisma.wallet.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, chips: true },
        orderBy: { chips: 'desc' },
        take: limit,
      });
      const userIdsWithChips = wallets.map((w) => w.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIdsWithChips } },
        select: { id: true, nickname: true, avatar: true },
      });
      const userMap: Record<
        string,
        { nickname: string; avatar: string | null }
      > = {};
      for (const u of users) {
        userMap[u.id] = { nickname: u.nickname, avatar: u.avatar };
      }
      result = wallets.map((w) => ({
        userId: w.userId,
        nickname: userMap[w.userId]?.nickname ?? '',
        avatar: userMap[w.userId]?.avatar ?? null,
        value: w.chips,
      }));
    } else if (metric === 'hands') {
      const settlements = await this.prisma.settlement.findMany({
        where: {
          userId: { in: userIds },
          ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
        },
        select: { userId: true, handId: true },
      });
      const counts: Record<string, Set<string>> = {};
      for (const s of settlements) {
        if (!counts[s.userId]) counts[s.userId] = new Set();
        counts[s.userId].add(s.handId);
      }
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nickname: true, avatar: true },
      });
      result = users
        .map((u) => ({
          userId: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          value: counts[u.id]?.size ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    } else if (metric === 'winrate') {
      const settlements = await this.prisma.settlement.findMany({
        where: {
          userId: { in: userIds },
          ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
        },
        select: { userId: true, handId: true, amount: true },
      });
      const stats: Record<string, { won: Set<string>; total: Set<string> }> =
        {};
      for (const s of settlements) {
        if (!stats[s.userId])
          stats[s.userId] = { won: new Set(), total: new Set() };
        stats[s.userId].total.add(s.handId);
        if (s.amount > 0) stats[s.userId].won.add(s.handId);
      }
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nickname: true, avatar: true },
      });
      result = users
        .map((u) => {
          const s = stats[u.id];
          const total = s?.total.size ?? 0;
          const won = s?.won.size ?? 0;
          return {
            userId: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            value: total > 0 ? Math.round((won / total) * 10000) / 100 : 0,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }

    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  /**
   * Get detailed statistics for a club.
   * Aggregates Settlement + Hand + Room data.
   * Optionally returns per-user stats when userId is provided.
   */
  async getClubStats(
    clubId: string,
    userId?: string,
  ): Promise<{
    clubId: string;
    totalHands: number;
    netProfit: number;
    averagePot: number;
    activeMembers: number;
    totalMembers: number;
    popularRooms: Array<{ tableId: string; name: string; handCount: number }>;
    userStats?: {
      userId: string;
      totalHands: number;
      netProfit: number;
      winRate: number;
    };
  }> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');

    const members = await this.prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true },
    });
    const memberUserIds = members.map((m) => m.userId);

    // All hands at this club's rooms
    const hands = await this.prisma.hand.findMany({
      where: { table: { room: { clubId } } },
      select: { id: true, potSize: true },
    });
    const handIds = hands.map((h) => h.id);
    const totalHands = handIds.length;
    const totalPot = hands.reduce((sum, h) => sum + h.potSize, 0);

    // Settlements for club members
    const settlements = await this.prisma.settlement.findMany({
      where: { userId: { in: memberUserIds }, handId: { in: handIds } },
      select: { userId: true, amount: true, handId: true },
    });

    const netProfit = settlements.reduce((sum, s) => sum + s.amount, 0);

    // Popular rooms (top 5 by hand count)
    const roomCounts = await this.prisma.hand.groupBy({
      by: ['tableId'],
      where: { table: { room: { clubId } } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });
    const tableIds = roomCounts.map((r) => r.tableId);
    const tables = await this.prisma.table.findMany({
      where: { id: { in: tableIds } },
      include: { room: { select: { id: true, name: true } } },
    });
    const roomMap: Record<string, { name: string }> = {};
    for (const t of tables) {
      roomMap[t.id] = { name: t.room.name };
    }
    const popularRooms = roomCounts.map((r) => ({
      tableId: r.tableId,
      name: roomMap[r.tableId]?.name ?? '',
      handCount: r._count.id,
    }));

    // Active members (played in last 30 days — have non-zero settlement amounts)
    const activeMemberIds = new Set(
      settlements.filter((s) => s.amount !== 0).map((s) => s.userId),
    );

    const result: ReturnType<typeof this.getClubStats> extends Promise<infer T>
      ? T
      : never = {
      clubId,
      totalHands,
      netProfit: Math.round(netProfit * 100) / 100,
      averagePot:
        totalHands > 0 ? Math.round((totalPot / totalHands) * 100) / 100 : 0,
      activeMembers: activeMemberIds.size,
      totalMembers: memberUserIds.length,
      popularRooms,
    };

    // Per-user stats
    if (userId) {
      const userSettlements = settlements.filter((s) => s.userId === userId);
      const userHands = new Set(userSettlements.map((s) => s.handId));
      const wins = userSettlements.filter((s) => s.amount > 0).length;
      result.userStats = {
        userId,
        totalHands: userHands.size,
        netProfit:
          Math.round(
            userSettlements.reduce((sum, s) => sum + s.amount, 0) * 100,
          ) / 100,
        winRate:
          userHands.size > 0
            ? Math.round((wins / userHands.size) * 10000) / 100
            : 0,
      };
    }

    return result;
  }
}
