import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { AdminUser } from './interfaces/admin-request.interface';

interface AdminRequest extends Request {
  admin: AdminUser;
}

@Controller('admin/rooms')
@UseGuards(AdminGuard)
export class AdminRoomController {
  constructor(private adminService: AdminService) {}

  @Get()
  getRooms(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getRooms({ page, limit, search, status });
  }

  @Get(':id')
  getRoomById(@Param('id') id: string) {
    return this.adminService.getRoomById(id);
  }

  @Post()
  async createRoom(@Body() dto: CreateRoomDto, @Req() req: AdminRequest) {
    // P2-CLUB-007: isClubOnly and clubId must be consistent
    if (dto.isClubOnly === true && !dto.clubId) {
      throw new BadRequestException('俱乐部专属房间必须指定 clubId');
    }
    const room = await this.adminService.createRoom(dto);
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'CREATE_ROOM',
      targetType: 'ROOM',
      targetId: room.id,
      detail: dto,
    });
    return room;
  }

  @Patch(':id')
  async updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @Req() req: AdminRequest,
  ) {
    const result = await this.adminService.updateRoom(id, dto);
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'UPDATE_ROOM',
      targetType: 'ROOM',
      targetId: id,
      detail: dto,
    });
    return result;
  }

  @Delete(':id')
  deleteRoom(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.adminService.deleteRoom(id, req.admin.sub);
  }

  @Post(':id/maintenance')
  async toggleMaintenance(@Param('id') id: string, @Req() req: AdminRequest) {
    const room = await this.adminService.getRoomById(id);
    const newStatus = room.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE';
    const updated = await this.adminService.updateRoom(id, {
      status: newStatus,
    });
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'MAINTENANCE',
      targetType: 'ROOM',
      targetId: id,
      detail: { newStatus },
    });
    return updated;
  }

  @Get(':id/tables')
  getRoomTables(@Param('id') id: string) {
    return this.adminService.getRoomById(id);
  }

  @Post(':id/kick/:userId')
  async kickUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AdminRequest,
  ) {
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'KICK_USER',
      targetType: 'USER',
      targetId: userId,
      detail: { roomId: id },
    });
    return { success: true };
  }
}
