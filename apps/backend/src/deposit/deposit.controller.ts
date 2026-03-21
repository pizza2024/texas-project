import { Controller, Get, Post, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
}
