import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketManager } from '../websocket/websocket-manager';
import { FriendStatus } from '@texas/shared';

describe('FriendService', () => {
  let service: FriendService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    friend: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockWsManager = {
    emitToUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebSocketManager, useValue: mockWsManager },
      ],
    }).compile();

    service = module.get<FriendService>(FriendService);
  });

  // ─── sendFriendRequest ───────────────────────────────────────────────────────

  describe('sendFriendRequest', () => {
    const requesterId = 'user-1';
    const usernameOrEmail = 'alice';
    const addressee = {
      id: 'user-2',
      username: 'alice',
      email: 'alice@example.com',
      nickname: 'Alice',
      avatar: null,
      status: 'ONLINE',
    };

    it('should throw NotFoundException when target user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException when sending request to yourself', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...addressee,
        id: requesterId,
      });

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow('Cannot send friend request to yourself');
    });

    it('should throw ConflictException when friend request already exists (requester → addressee)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue({
        id: 'friend-1',
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING',
      });

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow('Friend request already exists');
    });

    it('should throw ConflictException when friend request already exists (addressee → requester)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue({
        id: 'friend-1',
        requesterId: addressee.id,
        addresseeId: requesterId,
        status: 'PENDING',
      });

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when existing friendship is ACCEPTED', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue({
        id: 'friend-1',
        requesterId,
        addresseeId: addressee.id,
        status: 'ACCEPTED',
      });

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when existing relationship is BLOCKED', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue({
        id: 'friend-1',
        requesterId,
        addresseeId: addressee.id,
        status: 'BLOCKED',
      });

      await expect(
        service.sendFriendRequest(requesterId, usernameOrEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a PENDING friend request successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue(null);
      const createdFriend = {
        id: 'friend-new',
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING',
        createdAt: new Date(),
      };
      mockPrisma.friend.create.mockResolvedValue(createdFriend);
      mockPrisma.user.findUnique.mockResolvedValue({
        nickname: 'User One',
        avatar: null,
      });

      const result = await service.sendFriendRequest(
        requesterId,
        usernameOrEmail,
      );

      expect(result).toEqual(createdFriend);
      expect(mockPrisma.friend.create).toHaveBeenCalledWith({
        data: {
          requesterId,
          addresseeId: addressee.id,
          status: 'PENDING',
        },
      });
    });

    it('should emit friend_request_received event to addressee via WebSocket', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue(null);
      const createdFriend = {
        id: 'friend-new',
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING',
        createdAt: new Date(),
      };
      mockPrisma.friend.create.mockResolvedValue(createdFriend);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ nickname: 'User One' })
        .mockResolvedValueOnce({ avatar: 'avatar-url' });

      await service.sendFriendRequest(requesterId, usernameOrEmail);

      expect(mockWsManager.emitToUser).toHaveBeenCalledWith(
        addressee.id,
        'friend_request_received',
        expect.objectContaining({
          friendId: 'friend-new',
          fromUserId: requesterId,
        }),
      );
    });

    it('should find user by email when username does not match', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(addressee);
      mockPrisma.friend.findFirst.mockResolvedValue(null);
      const createdFriend = {
        id: 'friend-new',
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING',
        createdAt: new Date(),
      };
      mockPrisma.friend.create.mockResolvedValue(createdFriend);
      mockPrisma.user.findUnique.mockResolvedValue({
        nickname: 'User One',
        avatar: null,
      });

      await service.sendFriendRequest(requesterId, 'alice@example.com');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'alice@example.com' },
            { email: 'alice@example.com' },
          ],
        },
      });
    });
  });

  // ─── getReceivedRequests ────────────────────────────────────────────────────

  describe('getReceivedRequests', () => {
    const userId = 'user-1';

    it('should return paginated received friend requests with requester info', async () => {
      const records = [
        {
          id: 'friend-1',
          status: 'PENDING',
          createdAt: new Date(),
          requester: {
            id: 'user-2',
            nickname: 'Bob',
            avatar: null,
          },
        },
        {
          id: 'friend-2',
          status: 'PENDING',
          createdAt: new Date(),
          requester: {
            id: 'user-3',
            nickname: 'Charlie',
            avatar: 'avatar-3',
          },
        },
      ];
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getReceivedRequests(userId);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].requester.nickname).toBe('Bob');
      expect(result.data[1].requester.nickname).toBe('Charlie');
      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { addresseeId: userId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { id: true, nickname: true, avatar: true } },
          },
        }),
      );
    });

    it('should return nextCursor when more results exist than limit', async () => {
      const records = Array(21)
        .fill(null)
        .map((_, i) => ({
          id: `friend-${i}`,
          status: 'PENDING',
          createdAt: new Date(),
          requester: { id: `user-${i}`, nickname: `User ${i}`, avatar: null },
        }));
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getReceivedRequests(
        userId,
        'PENDING',
        undefined,
        20,
      );

      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe('friend-19');
    });

    it('should return null nextCursor when no more results', async () => {
      const records = [
        {
          id: 'friend-1',
          status: 'PENDING',
          createdAt: new Date(),
          requester: { id: 'user-2', nickname: 'Bob', avatar: null },
        },
      ];
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getReceivedRequests(userId);

      expect(result.nextCursor).toBeNull();
    });

    it('should use cursor for pagination', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getReceivedRequests(userId, 'PENDING', 'cursor-id', 10);

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11,
          skip: 1,
          cursor: { id: 'cursor-id' },
        }),
      );
    });

    it('should query with custom status filter', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getReceivedRequests(userId, 'REJECTED');

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { addresseeId: userId, status: 'REJECTED' },
        }),
      );
    });
  });

  // ─── acceptFriendRequest ────────────────────────────────────────────────────

  describe('acceptFriendRequest', () => {
    const userId = 'user-2';
    const friendRequestId = 'friend-1';

    it('should throw NotFoundException when friend request does not exist', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow('Friend request not found');
    });

    it('should throw ForbiddenException when user is not the addressee', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: 'user-3',
        status: 'PENDING',
      });

      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow('You are not the recipient of this friend request');
    });

    it('should throw BadRequestException when request is not PENDING', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: userId,
        status: 'ACCEPTED',
      });

      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow('Friend request is not pending');
    });

    it('should throw BadRequestException when request is REJECTED', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: userId,
        status: 'REJECTED',
      });

      await expect(
        service.acceptFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update friend request status to ACCEPTED successfully', async () => {
      const existingRecord = {
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: userId,
        status: 'PENDING',
        createdAt: new Date(),
      };
      const updatedRecord = {
        ...existingRecord,
        status: 'ACCEPTED',
      };
      mockPrisma.friend.findUnique.mockResolvedValue(existingRecord);
      mockPrisma.friend.update.mockResolvedValue(updatedRecord);

      const result = await service.acceptFriendRequest(userId, friendRequestId);

      expect(result.status).toBe('ACCEPTED');
      expect(mockPrisma.friend.update).toHaveBeenCalledWith({
        where: { id: friendRequestId },
        data: { status: 'ACCEPTED' },
      });
    });
  });

  // ─── rejectFriendRequest ────────────────────────────────────────────────────

  describe('rejectFriendRequest', () => {
    const userId = 'user-2';
    const friendRequestId = 'friend-1';

    it('should throw NotFoundException when friend request does not exist', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the addressee', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: 'user-3',
        status: 'PENDING',
      });

      await expect(
        service.rejectFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when request is not PENDING', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: userId,
        status: 'ACCEPTED',
      });

      await expect(
        service.rejectFriendRequest(userId, friendRequestId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update friend request status to REJECTED successfully', async () => {
      const existingRecord = {
        id: friendRequestId,
        requesterId: 'user-1',
        addresseeId: userId,
        status: 'PENDING',
        createdAt: new Date(),
      };
      const updatedRecord = {
        ...existingRecord,
        status: 'REJECTED',
      };
      mockPrisma.friend.findUnique.mockResolvedValue(existingRecord);
      mockPrisma.friend.update.mockResolvedValue(updatedRecord);

      const result = await service.rejectFriendRequest(userId, friendRequestId);

      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.friend.update).toHaveBeenCalledWith({
        where: { id: friendRequestId },
        data: { status: 'REJECTED' },
      });
    });
  });

  // ─── getFriends ─────────────────────────────────────────────────────────────

  describe('getFriends', () => {
    const userId = 'user-1';

    it('should return accepted friends with user info', async () => {
      const records = [
        {
          id: 'friend-1',
          status: 'ACCEPTED',
          createdAt: new Date(),
          requesterId: userId,
          addresseeId: 'user-2',
          requester: {
            id: userId,
            nickname: 'Me',
            avatar: null,
            status: 'ONLINE',
          },
          addressee: {
            id: 'user-2',
            nickname: 'Bob',
            avatar: 'avatar-bob',
            status: 'ONLINE',
          },
        },
        {
          id: 'friend-2',
          status: 'ACCEPTED',
          createdAt: new Date(),
          requesterId: 'user-3',
          addresseeId: userId,
          requester: {
            id: 'user-3',
            nickname: 'Charlie',
            avatar: null,
            status: 'OFFLINE',
          },
          addressee: {
            id: userId,
            nickname: 'Me',
            avatar: null,
            status: 'ONLINE',
          },
        },
      ];
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getFriends(userId);

      expect(result.data).toHaveLength(2);
      // user-2 is the friend in friend-1 (requester = userId, addressee = user-2)
      expect(result.data[0].user.nickname).toBe('Bob');
      expect(result.data[0].user.id).toBe('user-2');
      // user-3 is the friend in friend-2 (requester = user-3, addressee = userId)
      expect(result.data[1].user.nickname).toBe('Charlie');
      expect(result.data[1].user.id).toBe('user-3');
    });

    it('should filter by status=ACCEPTED', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getFriends(userId);

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACCEPTED',
          }),
        }),
      );
    });

    it('should return nextCursor when more results exist than limit', async () => {
      const records = Array(21)
        .fill(null)
        .map((_, i) => ({
          id: `friend-${i}`,
          status: 'ACCEPTED',
          createdAt: new Date(),
          requesterId: userId,
          addresseeId: `user-${i}`,
          requester: {
            id: userId,
            nickname: 'Me',
            avatar: null,
            status: 'ONLINE',
          },
          addressee: {
            id: `user-${i}`,
            nickname: `User ${i}`,
            avatar: null,
            status: 'ONLINE',
          },
        }));
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getFriends(userId, undefined, undefined, 20);

      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe('friend-19');
    });

    it('should return null nextCursor when no more results', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      const result = await service.getFriends(userId);

      expect(result.nextCursor).toBeNull();
    });

    it('should apply nickname search filter with case-insensitive mode', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getFriends(userId, 'bob');

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    requester: expect.objectContaining({
                      nickname: expect.objectContaining({
                        contains: 'bob',
                        mode: 'insensitive',
                      }),
                    }),
                  }),
                  expect.objectContaining({
                    addressee: expect.objectContaining({
                      nickname: expect.objectContaining({
                        contains: 'bob',
                        mode: 'insensitive',
                      }),
                    }),
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('should order results by createdAt descending', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getFriends(userId);

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should include both requester and addressee user info', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getFriends(userId);

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            requester: {
              select: { id: true, nickname: true, avatar: true, status: true },
            },
            addressee: {
              select: { id: true, nickname: true, avatar: true, status: true },
            },
          },
        }),
      );
    });
  });

  // ─── getAcceptedFriends ─────────────────────────────────────────────────────

  describe('getAcceptedFriends', () => {
    const userId = 'user-1';

    it('should return accepted friends with friendId, nickname, and avatar', async () => {
      const records = [
        {
          id: 'friend-1',
          requesterId: userId,
          addresseeId: 'user-2',
          status: 'ACCEPTED',
          requester: { id: userId, nickname: 'Me', avatar: null },
          addressee: { id: 'user-2', nickname: 'Bob', avatar: 'avatar-bob' },
        },
        {
          id: 'friend-2',
          requesterId: 'user-3',
          addresseeId: userId,
          status: 'ACCEPTED',
          requester: {
            id: 'user-3',
            nickname: 'Charlie',
            avatar: 'avatar-charlie',
          },
          addressee: { id: userId, nickname: 'Me', avatar: null },
        },
      ];
      mockPrisma.friend.findMany.mockResolvedValue(records);

      const result = await service.getAcceptedFriends(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        friendId: 'user-2',
        nickname: 'Bob',
        avatar: 'avatar-bob',
      });
      expect(result[1]).toEqual({
        friendId: 'user-3',
        nickname: 'Charlie',
        avatar: 'avatar-charlie',
      });
    });

    it('should return empty array when user has no friends', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      const result = await service.getAcceptedFriends(userId);

      expect(result).toEqual([]);
    });

    it('should only query ACCEPTED status friends', async () => {
      mockPrisma.friend.findMany.mockResolvedValue([]);

      await service.getAcceptedFriends(userId);

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        include: {
          requester: { select: { id: true, nickname: true, avatar: true } },
          addressee: { select: { id: true, nickname: true, avatar: true } },
        },
      });
    });
  });

  // ─── deleteFriend ───────────────────────────────────────────────────────────

  describe('deleteFriend', () => {
    const userId = 'user-1';
    const friendId = 'friend-1';

    it('should throw NotFoundException when friend record does not exist', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue(null);

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        'Friend record not found',
      );
    });

    it('should throw ForbiddenException when friend status is not ACCEPTED', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: userId,
        addresseeId: 'user-2',
        status: 'PENDING',
      });

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        'Can only delete accepted friends',
      );
    });

    it('should throw ForbiddenException when user is not part of the friendship', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: 'user-3',
        addresseeId: 'user-4',
        status: 'ACCEPTED',
      });

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        'You are not part of this friend relationship',
      );
    });

    it('should throw ForbiddenException when user is neither requester nor addressee', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: 'user-3',
        addresseeId: 'user-4',
        status: 'ACCEPTED',
      });

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        'You are not part of this friend relationship',
      );
    });

    it('should delete friend successfully when user is requester', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: userId,
        addresseeId: 'user-2',
        status: 'ACCEPTED',
      });
      mockPrisma.friend.delete.mockResolvedValue({});

      await service.deleteFriend(userId, friendId);

      expect(mockPrisma.friend.delete).toHaveBeenCalledWith({
        where: { id: friendId },
      });
    });

    it('should delete friend successfully when user is addressee', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: 'user-2',
        addresseeId: userId,
        status: 'ACCEPTED',
      });
      mockPrisma.friend.delete.mockResolvedValue({});

      await service.deleteFriend(userId, friendId);

      expect(mockPrisma.friend.delete).toHaveBeenCalledWith({
        where: { id: friendId },
      });
    });

    it('should throw ForbiddenException for REJECTED status', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: userId,
        addresseeId: 'user-2',
        status: 'REJECTED',
      });

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for BLOCKED status', async () => {
      mockPrisma.friend.findUnique.mockResolvedValue({
        id: friendId,
        requesterId: userId,
        addresseeId: 'user-2',
        status: 'BLOCKED',
      });

      await expect(service.deleteFriend(userId, friendId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
