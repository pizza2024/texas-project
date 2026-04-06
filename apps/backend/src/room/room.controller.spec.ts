import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { RateLimitGuard } from '../auth/rate-limit.guard';
import { RedisService } from '../redis/redis.service';

describe('RoomController', () => {
  let controller: RoomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        {
          provide: RoomService,
          useValue: {
            createRoom: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
        RateLimitGuard,
        {
          provide: RedisService,
          useValue: { incr: jest.fn(), ttl: jest.fn(), get: jest.fn(), set: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<RoomController>(RoomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
