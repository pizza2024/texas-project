import {
  Controller, Get, Post, Query, Body, UseGuards, Request,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

@Controller('admin/finance')
@UseGuards(AdminGuard)
export class AdminFinanceController {
  constructor(private adminService: AdminService) {}

  @Get('transactions')
  getTransactions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getTransactions({ page, limit, type, userId });
  }

  @Get('summary')
  getSummary() {
    return this.adminService.getFinanceSummary();
  }

  @Post('deposit')
  deposit(@Body() dto: { userId: string; amount: number; reason?: string }, @Request() req: any) {
    return this.adminService.adjustBalance(dto.userId, Math.abs(dto.amount), dto.reason ?? 'Admin deposit', req.admin.sub);
  }

  @Post('withdraw')
  withdraw(@Body() dto: { userId: string; amount: number; reason?: string }, @Request() req: any) {
    return this.adminService.adjustBalance(dto.userId, -Math.abs(dto.amount), dto.reason ?? 'Admin withdraw', req.admin.sub);
  }
}
