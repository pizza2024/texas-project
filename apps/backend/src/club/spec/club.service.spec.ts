import { Test, TestingModule } from '@nestjs/testing';
import { ClubService } from '../club.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebSocketManager } from '../../websocket/websocket-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ClubService', () => {
  let service: ClubService;
  let prisma: PrismaService;
  let wsManager: WebSocketManager;

  const mockPrisma = {
    club: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clubMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clubChat: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockWsManager = {
    sendToAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebSocketManager, useValue: mockWsManager },
      ],
    }).compile();

    service = module.get<ClubService>(ClubService);
    prisma = module.get<PrismaService>(PrismaService);
    wsManager = module.get<WebSocketManager>(WebSocketManager);

    jest.clearAllMocks();
  });

  describe('createClub', () => {
    it('should create a club and add creator as OWNER', async () => {
      const userId = 'user-1';
      const dto = { name: 'Test Club', description: 'A test club' };
      const mockClub = {
        id: 'club-1',
        name: dto.name,
        description: dto.description,
        ownerId: userId,
      };

      mockPrisma.club.create.mockResolvedValue(mockClub);

      const result = await service.createClub(userId, dto);

      expect(result).toEqual(mockClub);
      expect(mockPrisma.club.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          ownerId: userId,
          members: {
            create: { userId, role: 'OWNER' },
          },
        }),
      });
    });
  });

  describe('getClub', () => {
    it('should throw NotFoundException if club does not exist', async () => {
      mockPrisma.club.findUnique.mockResolvedValue(null);

      await expect(service.getClub('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return club info with member count', async () => {
      const mockClub = {
        id: 'club-1',
        name: 'Test Club',
        description: null,
        avatar: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        ownerId: 'user-1',
        _count: { members: 5 },
        members: [],
      };

      mockPrisma.club.findUnique.mockResolvedValue(mockClub);

      const result = await service.getClub('club-1');

      expect(result.id).toBe('club-1');
      expect(result.memberCount).toBe(5);
    });
  });

  describe('joinClub', () => {
    it('should throw NotFoundException if club does not exist', async () => {
      mockPrisma.club.findUnique.mockResolvedValue(null);

      await expect(service.joinClub('user-1', 'club-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if already a member', async () => {
      mockPrisma.club.findUnique.mockResolvedValue({
        id: 'club-1',
        status: 'ACTIVE',
      });
      mockPrisma.clubMember.findUnique.mockResolvedValue({
        id: 'membership-1',
      });

      await expect(service.joinClub('user-1', 'club-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create membership successfully', async () => {
      mockPrisma.club.findUnique.mockResolvedValue({
        id: 'club-1',
        status: 'ACTIVE',
      });
      mockPrisma.clubMember.findUnique.mockResolvedValue(null);
      mockPrisma.clubMember.create.mockResolvedValue({
        id: 'membership-1',
        clubId: 'club-1',
        userId: 'user-1',
        role: 'MEMBER',
      });

      const result = await service.joinClub('user-1', 'club-1');

      expect(result.id).toBe('membership-1');
      expect(mockWsManager.sendToAll).toHaveBeenCalledWith(
        'club_member_joined',
        { clubId: 'club-1', userId: 'user-1' },
      );
    });
  });

  describe('leaveClub', () => {
    it('should throw NotFoundException if membership does not exist', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue(null);

      await expect(service.leaveClub('user-1', 'club-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is OWNER', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue({ role: 'OWNER' });

      await expect(service.leaveClub('user-1', 'club-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow MEMBER to leave', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue({
        clubId: 'club-1',
        userId: 'user-1',
        role: 'MEMBER',
      });
      mockPrisma.clubMember.delete.mockResolvedValue({});

      await expect(
        service.leaveClub('user-1', 'club-1'),
      ).resolves.not.toThrow();
      expect(mockWsManager.sendToAll).toHaveBeenCalledWith('club_member_left', {
        clubId: 'club-1',
        userId: 'user-1',
      });
    });
  });

  describe('kickMember', () => {
    it('should throw ForbiddenException if kicker is not admin/owner', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

      await expect(
        service.kickMember('user-1', 'club-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if trying to kick OWNER', async () => {
      mockPrisma.clubMember.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' }) // kicker
        .mockResolvedValueOnce({ role: 'OWNER' }); // target

      await expect(
        service.kickMember('user-1', 'club-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ADMIN to kick MEMBER', async () => {
      mockPrisma.clubMember.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' })
        .mockResolvedValueOnce({ role: 'MEMBER' });
      mockPrisma.clubMember.delete.mockResolvedValue({});

      await expect(
        service.kickMember('user-1', 'club-1', 'user-2'),
      ).resolves.not.toThrow();
      expect(mockWsManager.sendToAll).toHaveBeenCalledWith(
        'club_member_kicked',
        { clubId: 'club-1', kickedUserId: 'user-2' },
      );
    });
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-1', 'club-1', 'Hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should save and broadcast message', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue({
        clubId: 'club-1',
        userId: 'user-1',
        role: 'MEMBER',
      });
      mockPrisma.club.findUnique.mockResolvedValue({
        id: 'club-1',
        status: 'ACTIVE',
      });
      mockPrisma.clubChat.create.mockResolvedValue({
        id: 'chat-1',
        clubId: 'club-1',
        userId: 'user-1',
        message: 'Hello',
        createdAt: new Date(),
        user: { id: 'user-1', nickname: 'Player1', avatar: null },
      });

      const result = await service.sendMessage('user-1', 'club-1', 'Hello');

      expect(result.message).toBe('Hello');
      expect(mockWsManager.sendToAll).toHaveBeenCalledWith(
        'club_chat_message',
        expect.any(Object),
      );
    });
  });

  describe('isClubMember', () => {
    it('should return true if membership exists', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue({ id: 'm-1' });

      const result = await service.isClubMember('user-1', 'club-1');

      expect(result).toBe(true);
    });

    it('should return false if membership does not exist', async () => {
      mockPrisma.clubMember.findUnique.mockResolvedValue(null);

      const result = await service.isClubMember('user-1', 'club-1');

      expect(result).toBe(false);
    });
  });
});
