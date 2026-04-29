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
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WithdrawService } from './withdraw.service';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { ProcessWithdrawDto } from './dto/process-withdraw.dto';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { AdminGuard } from '../admin/guards/admin.guard';

@Controller('withdraw')
@UseGuards(AuthGuard('jwt'))
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  // ── Address book ─────────────────────────────────────────────────────────────

  /**
   * GET withdraw/addresses
   * Returns all saved addresses for the authenticated user.
   */
  @Get('addresses')
  async getSavedAddresses(@Request() req: { user: JwtUser }) {
    return this.withdrawService.getSavedAddresses(req.user.userId);
  }

  /**
   * POST withdraw/addresses
   * Saves a new withdraw address.
   * Body: { address: string; label?: string }
   */
  @Post('addresses')
  async saveAddress(
    @Request() req: { user: JwtUser },
    @Body() body: { address: string; label?: string },
  ) {
    if (!body.address) {
      throw new ForbiddenException('address is required');
    }
    return this.withdrawService.saveAddress(
      req.user.userId,
      body.address,
      body.label,
    );
  }

  /**
   * DELETE withdraw/addresses/:addressId
   * Deletes a saved address.
   */
  @Delete('addresses/:addressId')
  async deleteAddress(
    @Request() req: { user: JwtUser },
    @Param('addressId') addressId: string,
  ) {
    await this.withdrawService.deleteAddress(req.user.userId, addressId);
    return { ok: true };
  }

  /**
   * PATCH withdraw/addresses/:addressId/default
   * Sets an address as the default.
   */
  @Patch('addresses/:addressId/default')
  async setDefaultAddress(
    @Request() req: { user: JwtUser },
    @Param('addressId') addressId: string,
  ) {
    await this.withdrawService.setDefaultAddress(req.user.userId, addressId);
    return { ok: true };
  }

  /** Get available balance for withdraw */
  @Get('balance')
  async getBalance(@Request() req: { user: JwtUser }) {
    return this.withdrawService.getAvailableBalance(req.user.userId);
  }

  /** Get remaining cooldown */
  @Get('cooldown')
  async getCooldown(@Request() req: { user: JwtUser }) {
    return this.withdrawService.getCooldownRemaining(req.user.userId);
  }

  /** Create a new withdraw request */
  @Post('create')
  async createWithdraw(
    @Request() req: { user: JwtUser },
    @Body() dto: CreateWithdrawDto,
  ) {
    return this.withdrawService.createWithdraw(req.user.userId, dto);
  }

  /** Get withdraw status by ID */
  @Get('status/:id')
  async getStatus(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    return this.withdrawService.getWithdrawStatus(id, req.user.userId);
  }

  /** Get withdraw history (paginated) */
  @Get('history')
  async getHistory(
    @Request() req: { user: JwtUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.withdrawService.getWithdrawHistory(
      req.user.userId,
      page,
      limit,
    );
  }
}

@Controller('admin/withdraw')
@UseGuards(AdminGuard)
export class AdminWithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  /** List all withdraw requests */
  @Get('requests')
  async listRequests(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.withdrawService.listRequests({ page, limit, status, userId });
  }

  /** Get withdraw request details */
  @Get(':id')
  async getRequest(@Param('id') id: string) {
    return this.withdrawService.getRequestById(id);
  }

  /** Process withdraw (approve or reject) */
  @Patch(':id/process')
  async processWithdraw(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawDto,
    @Request() req: any,
  ) {
    return this.withdrawService.processWithdraw(
      id,
      req.admin.sub,
      dto.action,
      dto.reason,
    );
  }
}
