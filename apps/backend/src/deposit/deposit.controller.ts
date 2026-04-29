import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DepositService } from './deposit.service';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

@Controller('deposit')
@UseGuards(AuthGuard('jwt'))
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  // ── Address book ─────────────────────────────────────────────────────────────

  /**
   * GET deposit/addresses
   * Returns all saved addresses for the authenticated user.
   */
  @Get('addresses')
  async getSavedAddresses(@Request() req: { user: JwtUser }) {
    return this.depositService.getSavedAddresses(req.user.userId);
  }

  /**
   * POST deposit/addresses
   * Saves a new deposit address (or updates label if already exists).
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
    return this.depositService.saveAddress(
      req.user.userId,
      body.address,
      body.label,
    );
  }

  /**
   * DELETE deposit/addresses/:addressId
   * Deletes a saved address.
   */
  @Delete('addresses/:addressId')
  async deleteAddress(
    @Request() req: { user: JwtUser },
    @Param('addressId') addressId: string,
  ) {
    await this.depositService.deleteAddress(req.user.userId, addressId);
    return { ok: true };
  }

  /**
   * PATCH deposit/addresses/:addressId/default
   * Sets an address as the default.
   */
  @Patch('addresses/:addressId/default')
  async setDefaultAddress(
    @Request() req: { user: JwtUser },
    @Param('addressId') addressId: string,
  ) {
    await this.depositService.setDefaultAddress(req.user.userId, addressId);
    return { ok: true };
  }

  // ── Single deposit address (legacy) ──────────────────────────────────────────

  @Get('address')
  async getDepositAddress(@Request() req: { user: JwtUser }) {
    const address = await this.depositService.getOrCreateDepositAddress(
      req.user.userId,
    );
    return { address, network: 'sepolia', token: 'USDT', rate: 100 };
  }

  @Get('history')
  async getDepositHistory(@Request() req: { user: JwtUser }) {
    return this.depositService.getDepositHistory(req.user.userId);
  }

  @Post('faucet')
  async faucet(@Request() req: { user: JwtUser }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Faucet is not available in production');
    }
    return this.depositService.faucet(req.user.userId);
  }

  // ── Bonus status / progress ────────────────────────────────────────────────

  /**
   * GET deposit/bonus/status
   * Returns the user's first-deposit bonus wagering progress.
   */
  @Get('bonus/status')
  async getBonusStatus(@Request() req: { user: JwtUser }) {
    return this.depositService.getBonusStatus(req.user.userId);
  }

  /**
   * POST deposit/bonus/wagering
   * Records chips wagered at a poker table toward the bonus rollover requirement.
   * Called by the table engine after each hand.
   */
  @Post('bonus/wagering')
  async addWagering(@Request() req: { user: JwtUser }) {
    // The actual chips wagered are determined server-side by the table engine;
    // this endpoint is called by the engine after processing a hand.
    // Clients should not call this directly — it is internal.
    throw new ForbiddenException('This endpoint is internal to the server');
  }
}
