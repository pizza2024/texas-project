/**
 * Rakeback Controller Unit Test
 *
 * Tests RakebackController with mocked RakebackService and JWT auth.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RakebackController } from './rakeback.controller';
import { RakebackService } from './rakeback.service';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

describe('RakebackController', () => {
  let controller: RakebackController;
  let rakebackService: jest.Mocked<RakebackService>;

  const mockUser = {
    userId: 'user-1',
    username: 'testuser',
    role: 'PLAYER' as const,
  };

  beforeEach(async () => {
    const mockRakebackService = {
      getRakeback: jest.fn(),
      claimRakeback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RakebackController],
      providers: [
        { provide: RakebackService, useValue: mockRakebackService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-token') },
        },
      ],
    }).compile();

    controller = module.get<RakebackController>(RakebackController);
    rakebackService = module.get(RakebackService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRakeback', () => {
    it('should return rakeback info for authenticated user', async () => {
      const mockResult = {
        rakebackBalance: 1500,
        tier: 'GOLD' as const,
        rate: 0.3,
        totalRake: 6000,
        minRakeForNextTier: null,
        rakeToNextTier: null,
      };
      rakebackService.getRakeback.mockResolvedValue(mockResult);

      const req = { user: mockUser } as { user: typeof mockUser };
      const result = await controller.getRakeback(req);

      expect(result).toEqual(mockResult);
      expect(rakebackService.getRakeback).toHaveBeenCalledWith('user-1');
    });

    it('should return BRONZE tier info for low rake user', async () => {
      const mockResult = {
        rakebackBalance: 10,
        tier: 'BRONZE' as const,
        rate: 0.1,
        totalRake: 100,
        minRakeForNextTier: 1000,
        rakeToNextTier: 900,
      };
      rakebackService.getRakeback.mockResolvedValue(mockResult);

      const req = { user: mockUser } as { user: typeof mockUser };
      const result = await controller.getRakeback(req);

      expect(result).toEqual(mockResult);
    });

    it('should return SILVER tier info for mid-level rake user', async () => {
      const mockResult = {
        rakebackBalance: 300,
        tier: 'SILVER' as const,
        rate: 0.2,
        totalRake: 3000,
        minRakeForNextTier: 5000,
        rakeToNextTier: 2000,
      };
      rakebackService.getRakeback.mockResolvedValue(mockResult);

      const req = { user: mockUser } as { user: typeof mockUser };
      const result = await controller.getRakeback(req);

      expect(result).toEqual(mockResult);
    });
  });

  describe('claimRakeback', () => {
    it('should return claim result with new chips balance', async () => {
      const mockResult = { claimedAmount: 500, newChipsBalance: 5500 };
      rakebackService.claimRakeback.mockResolvedValue(mockResult);

      const req = { user: mockUser } as { user: typeof mockUser };
      const result = await controller.claimRakeback(req);

      expect(result).toEqual(mockResult);
      expect(rakebackService.claimRakeback).toHaveBeenCalledWith('user-1');
    });

    it('should propagate BadRequestException when no balance to claim', async () => {
      rakebackService.claimRakeback.mockRejectedValue(
        new BadRequestException('No rakeback balance to claim'),
      );

      const req = { user: mockUser } as { user: typeof mockUser };
      await expect(controller.claimRakeback(req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
