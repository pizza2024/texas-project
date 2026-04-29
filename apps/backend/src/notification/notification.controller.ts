import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Req() req: any, @Query() query: QueryNotificationDto) {
    const { page = 1, limit = 20 } = query;
    const result = await this.notificationService.findAll(req.user.userId, page, limit);
    const unreadCount = await this.notificationService.getUnreadCount(req.user.userId);
    return { ...result, unreadCount };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('read')
  async markRead(@Req() req: any, @Body() dto: MarkReadDto) {
    await this.notificationService.markRead(dto.ids, req.user.userId);
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    const count = await this.notificationService.markAllRead(req.user.userId);
    return { markedCount: count };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationService.getUnreadCount(req.user.userId);
    return { count };
  }
}
