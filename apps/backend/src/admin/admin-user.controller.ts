import {
  Controller, Get, Patch, Post, Delete,
  Param, Query, Body, UseGuards, Request,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

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
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Post(':id/ban')
  async banUser(@Param('id') id: string, @Request() req: any) {
    const user = await this.adminService.updateUser(id, { status: 'BANNED' });
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'BAN_USER',
      targetType: 'USER',
      targetId: id,
    });
    return user;
  }

  @Post(':id/unban')
  async unbanUser(@Param('id') id: string, @Request() req: any) {
    const user = await this.adminService.updateUser(id, { status: 'OFFLINE' });
    await this.adminService.log({
      adminId: req.admin.sub,
      action: 'UNBAN_USER',
      targetType: 'USER',
      targetId: id,
    });
    return user;
  }

  @Post(':id/balance')
  adjustBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @Request() req: any,
  ) {
    return this.adminService.adjustBalance(id, dto.amount, dto.reason ?? '', req.admin.sub);
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
