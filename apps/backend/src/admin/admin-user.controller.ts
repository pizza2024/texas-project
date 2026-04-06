import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { AdminUser } from './interfaces/admin-request.interface';

interface AdminRequest extends Request {
  admin: AdminUser;
}

const LARGE_ADJUSTMENT_THRESHOLD = 10_000; // chips

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUserController {
  constructor(private adminService: AdminService) {}

  @Get()
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, status });
  }

  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AdminRequest,
  ) {
    const result = await this.adminService.updateUser(id, dto);
    const isSelfEdit = id === req.admin.sub;
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'UPDATE_USER',
      targetType: 'USER',
      targetId: id,
      detail: { ...dto, ...(isSelfEdit ? { selfEdit: true } : {}) },
    });
    return result;
  }

  @Post(':id/ban')
  async banUser(@Param('id') id: string, @Req() req: AdminRequest) {
    const isSelfBan = id === req.admin.sub;
    const user = await this.adminService.updateUser(id, { status: 'BANNED' });
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'BAN_USER',
      targetType: 'USER',
      targetId: id,
      detail: isSelfBan ? { selfBan: true } : undefined,
    });
    return user;
  }

  @Post(':id/unban')
  async unbanUser(@Param('id') id: string, @Req() req: AdminRequest) {
    const isSelfEdit = id === req.admin.sub;
    const user = await this.adminService.updateUser(id, { status: 'OFFLINE' });
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'UNBAN_USER',
      targetType: 'USER',
      targetId: id,
      detail: isSelfEdit ? { selfEdit: true } : undefined,
    });
    return user;
  }

  @Post(':id/balance')
  adjustBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @Req() req: AdminRequest,
  ) {
    // Large adjustments require SUPER_ADMIN role for additional oversight
    const absAmount = Math.abs(dto.amount);
    if (
      absAmount > LARGE_ADJUSTMENT_THRESHOLD &&
      req.admin.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        `Large adjustments (>${LARGE_ADJUSTMENT_THRESHOLD} chips) require SUPER_ADMIN confirmation`,
      );
    }

    return this.adminService.adjustBalance(
      id,
      dto.amount,
      dto.reason,
      req.admin.sub,
    );
  }

  @Get(':id/transactions')
  getUserTransactions(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUserTransactions(id, page, limit);
  }

  @Get(':id/hands')
  getUserHands(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUserHands(id, page, limit);
  }
}
