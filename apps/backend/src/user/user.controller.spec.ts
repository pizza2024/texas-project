import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { HandHistoryService } from '../table-engine/hand-history.service';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const mockUserService = {
      getUserAvatar: jest.fn(),
      updateAvatar: jest.fn(),
    };

    const mockHandHistoryService = {
      getPlayerHandHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: HandHistoryService, useValue: mockHandHistoryService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
