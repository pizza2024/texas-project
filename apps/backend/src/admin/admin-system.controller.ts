import {
  Controller, Get, Post, Body, UseGuards, Request,
  ParseIntPipe, DefaultValuePipe, Query,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';

let maintenanceMode = false;

@Controller('admin/system')
@UseGuards(AdminGuard)
export class AdminSystemController {
  constructor(private adminService: AdminService) {}

  @Get('status')
  getStatus() {
    const mem = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memoryUsed: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(mem.heapTotal / 1024 / 1024),
      maintenanceMode,
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  @Post('maintenance')
  async toggleMaintenance(@Request() req: any, @Body() body: { enable?: boolean }) {
    maintenanceMode = body.enable !== undefined ? body.enable : !maintenanceMode;
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'MAINTENANCE',
      targetType: 'SYSTEM',
      detail: { maintenanceMode },
    });
    return { maintenanceMode };
  }

  @Get('logs')
  getAdminLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAdminLogs(page, limit);
  }
}
