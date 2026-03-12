import { Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TableManagerService } from './table-manager.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('tables')
export class TableEngineController {
  constructor(private readonly tableManagerService: TableManagerService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me/current-room')
  getCurrentRoom(@Req() req: AuthenticatedRequest) {
    const roomId = this.tableManagerService.getUserCurrentRoomId(req.user.userId);
    return { roomId };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/leave-room')
  async leaveCurrentRoom(@Req() req: AuthenticatedRequest) {
    const result = await this.tableManagerService.leaveCurrentRoom(req.user.userId);
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
