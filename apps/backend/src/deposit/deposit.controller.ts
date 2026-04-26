import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DepositService } from './deposit.service';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

@Controller('deposit')
@UseGuards(AuthGuard('jwt'))
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

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
  async addWagering(
    @Request() req: { user: JwtUser },
  ) {
    // The actual chips wagered are determined server-side by the table engine;
    // this endpoint is called by the engine after processing a hand.
    // Clients should not call this directly — it is internal.
    throw new ForbiddenException('This endpoint is internal to the server');
  }
}
