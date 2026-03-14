import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, Request,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';

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
  createRoom(@Body() body: any) {
    return this.adminService.createRoom(body);
  }

  @Patch(':id')
  updateRoom(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateRoom(id, body);
  }

  @Delete(':id')
  deleteRoom(@Param('id') id: string, @Request() req: any) {
    return this.adminService.deleteRoom(id, req.admin.sub);
  }

  @Post(':id/maintenance')
  async toggleMaintenance(@Param('id') id: string, @Request() req: any) {
    const room = await this.adminService.getRoomById(id);
    const newStatus = room.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE';
    const updated = await this.adminService.updateRoom(id, { status: newStatus });
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
    @Request() req: any,
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
