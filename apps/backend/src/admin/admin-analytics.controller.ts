import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin/analytics')
@UseGuards(AdminGuard)
export class AdminAnalyticsController {
  constructor(private adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  getUserGrowth(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.adminService.getUserGrowth(days);
  }

  @Get('revenue')
  getRevenue(
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
    @Query('n', new DefaultValuePipe(30), ParseIntPipe) n: number,
  ) {
    return this.adminService.getRevenueByPeriod(period, n);
  }

  @Get('rooms')
  getRoomHotList() {
    return this.adminService.getRoomHotList();
  }

  @Get('hands')
  getHandsStats() {
    return this.adminService.getHandsStats();
  }
}
