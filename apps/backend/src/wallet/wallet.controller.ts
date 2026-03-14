import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';

type ExchangeDirection = 'balance_to_chips' | 'chips_to_balance';

interface ExchangeDto {
  direction: ExchangeDirection;
  amount: number;
}

@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Request() req: { user: { sub: string } }) {
    const chips = await this.walletService.getBalance(req.user.sub);
    const available = await this.walletService.getAvailableBalance(req.user.sub);
    return { chips, availableChips: available };
  }

  /**
   * Exchange between real-money balance and game chips.
   * Rate: 1:1 (placeholder until USDT top-up is implemented).
   * Currently balance is always 0 for all users — this endpoint is a
   * forward-compatible stub for when top-up is wired in.
   */
  @Post('exchange')
  async exchange(
    @Request() req: { user: { sub: string } },
    @Body() body: ExchangeDto,
  ) {
    const { direction, amount } = body;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // TODO: implement actual balance ↔ chips exchange once top-up exists
    throw new BadRequestException(
      'Exchange not yet available — top-up feature coming soon',
    );

    return { direction, amount };
  }
}
