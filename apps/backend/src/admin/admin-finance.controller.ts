import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { DepositDto, WithdrawDto } from './dto/adjust-balance.dto';
import { AdminUser } from './interfaces/admin-request.interface';

interface AdminRequest extends Request {
  admin: AdminUser;
}

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
  deposit(@Body() dto: DepositDto, @Req() req: AdminRequest) {
    return this.adminService.adjustBalance(
      dto.userId,
      Math.abs(dto.amount),
      dto.reason ?? 'Admin deposit',
      req.admin.sub,
    );
  }

  @Post('withdraw')
  withdraw(@Body() dto: WithdrawDto, @Req() req: AdminRequest) {
    return this.adminService.adjustBalance(
      dto.userId,
      -Math.abs(dto.amount),
      dto.reason ?? 'Admin withdraw',
      req.admin.sub,
    );
  }
}
