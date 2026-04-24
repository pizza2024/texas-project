import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketManager } from '../websocket/websocket-manager';
import { Club, ClubMember, ClubChat } from '@prisma/client';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
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
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebSocketManager))
    private wsManager: WebSocketManager,
  ) {}

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
}
