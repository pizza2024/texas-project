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
import { Friend, User } from '@prisma/client';
import { FriendStatus } from '@texas/shared';

export interface FriendInfo {
  id: string;
  status: FriendStatus;
  createdAt: Date;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    status: string;
  };
}

export interface FriendRequestInfo {
  id: string;
  status: FriendStatus;
  createdAt: Date;
  requester: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
}

@Injectable()
export class FriendService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebSocketManager))
    private wsManager: WebSocketManager,
  ) {}

  /**
   * 发送好友请求
   * - 查找目标用户（不能是自己）
   * - 冲突检测（已有任何状态的记录则返回 409）
   * - 创建 Friend 记录（status=PENDING）
   */
  async sendFriendRequest(
    requesterId: string,
    usernameOrEmail: string,
  ): Promise<Friend> {
    // 查找目标用户
    const addressee = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail.toLowerCase() },
        ],
      },
    });

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    if (addressee.id === requesterId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // 冲突检测：已有任何状态的记录
    const existing = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Friend request already exists');
    }

    const friend = await this.prisma.friend.create({
      data: {
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING',
      },
    });

    // Push friend_request_received to addressee if online
    this.wsManager.emitToUser(addressee.id, 'friend_request_received', {
      friendId: friend.id,
      fromUserId: requesterId,
      fromNickname: (await this.prisma.user.findUnique({ where: { id: requesterId }, select: { nickname: true } }))?.nickname ?? '',
      fromAvatar: (await this.prisma.user.findUnique({ where: { id: requesterId }, select: { avatar: true } }))?.avatar ?? null,
    });

    return friend;
  }

  /**
   * 获取收到的好友请求列表
   * - 仅返回当前用户是 addresseeId 的记录
   * - 联表查询 requester 的 nickname、avatar
   */
  async getReceivedRequests(
    userId: string,
    status: FriendStatus = 'PENDING',
    cursor?: string,
    limit: number = 20,
  ): Promise<{ data: FriendRequestInfo[]; nextCursor: string | null }> {
    const whereClause = {
      addresseeId: userId,
      status,
    };

    const records = await this.prisma.friend.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const data: FriendRequestInfo[] = items.map((r) => ({
      id: r.id,
      status: r.status as FriendStatus,
      createdAt: r.createdAt,
      requester: {
        id: r.requester.id,
        nickname: r.requester.nickname,
        avatar: r.requester.avatar,
      },
    }));

    return { data, nextCursor };
  }

  /**
   * 接受好友请求
   * - 验证当前用户是 addresseeId 且 status=PENDING
   * - 更新 status 为 ACCEPTED
   */
  async acceptFriendRequest(
    userId: string,
    friendRequestId: string,
  ): Promise<Friend> {
    const record = await this.prisma.friend.findUnique({
      where: { id: friendRequestId },
    });

    if (!record) {
      throw new NotFoundException('Friend request not found');
    }

    if (record.addresseeId !== userId) {
      throw new ForbiddenException('You are not the recipient of this friend request');
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException('Friend request is not pending');
    }

    return this.prisma.friend.update({
      where: { id: friendRequestId },
      data: { status: 'ACCEPTED' },
    });
  }

  /**
   * 拒绝好友请求
   * - 验证当前用户是 addresseeId 且 status=PENDING
   * - 更新 status 为 REJECTED
   */
  async rejectFriendRequest(
    userId: string,
    friendRequestId: string,
  ): Promise<Friend> {
    const record = await this.prisma.friend.findUnique({
      where: { id: friendRequestId },
    });

    if (!record) {
      throw new NotFoundException('Friend request not found');
    }

    if (record.addresseeId !== userId) {
      throw new ForbiddenException('You are not the recipient of this friend request');
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException('Friend request is not pending');
    }

    return this.prisma.friend.update({
      where: { id: friendRequestId },
      data: { status: 'REJECTED' },
    });
  }
  
    /**
     * 获取好友列表
     * - 仅返回 status=ACCEPTED 的记录
     * - 联表查询对方的 User 信息（nickname, avatar, status）
     * - 支持按 nickname 模糊搜索
     */
    async getFriends(
      userId: string,
      search?: string,
      cursor?: string,
      limit: number = 20,
    ): Promise<{ data: FriendInfo[]; nextCursor: string | null }> {
      const whereClause = search
        ? {
            status: 'ACCEPTED',
            OR: [
              { requesterId: userId },
              { addresseeId: userId },
            ],
            AND: [
              {
                OR: [
                  {
                    requester: {
                      nickname: { contains: search, mode: 'insensitive' as const },
                      id: { not: userId },
                    },
                  },
                  {
                    addressee: {
                      nickname: { contains: search, mode: 'insensitive' as const },
                      id: { not: userId },
                    },
                  },
                ],
              },
            ],
          }
        : {
            status: 'ACCEPTED',
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          };
  
      const friends = await this.prisma.friend.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, nickname: true, avatar: true, status: true } },
          addressee: { select: { id: true, nickname: true, avatar: true, status: true } },
        },
      });
  
      const hasMore = friends.length > limit;
      const items = hasMore ? friends.slice(0, limit) : friends;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
  
      const data: FriendInfo[] = items.map((f) => {
        const isRequester = f.requesterId === userId;
        const friendUser = isRequester ? f.addressee : f.requester;
        return {
          id: f.id,
          status: f.status as FriendStatus,
          createdAt: f.createdAt,
          user: {
            id: friendUser.id,
            nickname: friendUser.nickname,
            avatar: friendUser.avatar,
            status: friendUser.status,
          },
        };
      });
  
      return { data, nextCursor };
    }
  
    /**
     * 获取用户所有已接受的好友（供 AppGateway 推送上下线通知使用）
     */
    async getAcceptedFriends(userId: string): Promise<
      { friendId: string; nickname: string; avatar: string | null }[]
    > {
      const records = await this.prisma.friend.findMany({
        where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: {
          requester: { select: { id: true, nickname: true, avatar: true } },
          addressee: { select: { id: true, nickname: true, avatar: true } },
        },
      });
  
      return records.map((r) => {
        const isRequester = r.requesterId === userId;
        return {
          friendId: isRequester ? r.addresseeId : r.requesterId,
          nickname: isRequester ? r.addressee.nickname : r.requester.nickname,
          avatar: isRequester ? r.addressee.avatar : r.requester.avatar,
        };
      });
    }
  
    /**
     * 删除好友
     * - 验证当前用户是 requesterId 或 addresseeId 且 status=ACCEPTED
     * - 直接删除记录（物理删除）
     */
    async deleteFriend(userId: string, friendId: string): Promise<void> {
      const friend = await this.prisma.friend.findUnique({
        where: { id: friendId },
      });
  
      if (!friend) {
        throw new NotFoundException('Friend record not found');
      }
  
      if (friend.status !== 'ACCEPTED') {
        throw new ForbiddenException('Can only delete accepted friends');
      }
  
      if (friend.requesterId !== userId && friend.addresseeId !== userId) {
        throw new ForbiddenException('You are not part of this friend relationship');
      }
  
      await this.prisma.friend.delete({ where: { id: friendId } });
    }
  }
