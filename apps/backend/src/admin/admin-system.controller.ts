import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { BroadcastService } from './broadcast.service';
import { SystemStateService } from './system-state.service';
import { AdminUser } from './interfaces/admin-request.interface';

interface AdminRequest extends Request {
  admin: AdminUser;
}

@Controller('admin/system')
@UseGuards(AdminGuard)
export class AdminSystemController {
  constructor(
    private adminService: AdminService,
    private broadcastService: BroadcastService,
    private systemState: SystemStateService,
  ) {}

  @Get('status')
  getStatus() {
    const mem = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memoryUsed: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(mem.heapTotal / 1024 / 1024),
      maintenanceMode: this.systemState.isMaintenanceMode(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  @Post('maintenance')
  async toggleMaintenance(
    @Req() req: AdminRequest,
    @Body() body: { enable?: boolean },
  ) {
    const current = this.systemState.isMaintenanceMode();
    const newValue = body.enable !== undefined ? body.enable : !current;
    await this.systemState.setMaintenanceMode(newValue);
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'MAINTENANCE',
      targetType: 'SYSTEM',
      detail: { maintenanceMode: newValue },
    });
    return { maintenanceMode: newValue };
  }

  @Get('logs')
  getAdminLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAdminLogs(page, limit);
  }

  @Post('broadcast')
  async broadcast(
    @Req() req: AdminRequest,
    @Body() body: { message: string; type?: 'info' | 'warning' | 'error' },
  ) {
    this.broadcastService.sendSystemMessage(body.message, body.type || 'info');
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'BROADCAST',
      targetType: 'SYSTEM',
      detail: { message: body.message, type: body.type || 'info' },
    });
    return {
      success: true,
      connectedCount: this.broadcastService.getConnectedCount(),
    };
  }
}
