import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TableManagerService } from './table-manager.service';
import { HandHistoryService } from './hand-history.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('tables')
export class TableEngineController {
  constructor(
    private readonly tableManagerService: TableManagerService,
    private readonly handHistoryService: HandHistoryService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me/current-room')
  async getCurrentRoom(@Req() req: AuthenticatedRequest) {
    const room = await this.tableManagerService.getUserCurrentRoom(
      req.user.userId,
    );
    return {
      roomId: room?.roomId ?? null,
      isMatchmaking: room?.isMatchmaking ?? false,
      isInActiveGame: room?.isInActiveGame ?? false,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/leave-room')
  async leaveCurrentRoom(@Req() req: AuthenticatedRequest) {
    const result = await this.tableManagerService.leaveCurrentRoom(
      req.user.userId,
    );
    return {
      roomId: result?.roomId ?? null,
      left: !!result,
      dissolved: result?.dissolved ?? false,
    };
  }

  @Get('rooms/:roomId/status')
  async getRoomStatus(@Param('roomId') roomId: string) {
    const status = await this.tableManagerService.getRoomStatus(roomId);
    if (!status) {
      throw new NotFoundException('Room not found');
    }
    return status;
  }
}

@Controller('hands')
export class HandController {
  constructor(private readonly handHistoryService: HandHistoryService) {}

  /**
   * GET /hands/:id/replay
   * Returns full hand replay data for the GGPoker Squash-style UI.
   * Includes: hole cards, community cards, timeline of all actions,
   * per-player net profit, and hand strength at showdown.
   */
  @Get(':id/replay')
  async getHandReplay(@Param('id') handId: string) {
    const replay = await this.handHistoryService.getHandReplay(handId);
    if (!replay) {
      throw new NotFoundException('Hand not found');
    }
    return replay;
  }
}
