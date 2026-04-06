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

interface ExchangeToChipsDto {
  amount: number;
}

interface ExchangeFromChipsDto {
  amount: number;
  address: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Request() req: { user: { userId: string } }) {
    const chips = await this.walletService.getBalance(req.user.userId);
    const available = await this.walletService.getAvailableBalance(
      req.user.userId,
    );
    const balance = await this.walletService.getRealBalance(req.user.userId);
    return { chips, availableChips: available, balance };
  }

  @Get('history')
  async getHistory(@Request() req: { user: { userId: string } }) {
    const withdraws = await this.walletService.getWithdrawHistory(
      req.user.userId,
    );
    return { withdraws };
  }

  @Post('exchange/to-chips')
  async exchangeToChips(
    @Request() req: { user: { userId: string } },
    @Body() body: ExchangeToChipsDto,
  ) {
    const { amount } = body;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    return this.walletService.exchangeBalanceToChips(req.user.userId, amount);
  }

  @Post('exchange/to-balance')
  async exchangeToBalance(
    @Request() req: { user: { userId: string } },
    @Body() body: ExchangeFromChipsDto,
  ) {
    const { amount, address } = body;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!address) {
      throw new BadRequestException('Withdraw address is required');
    }
    return this.walletService.exchangeChipsToBalance(
      req.user.userId,
      amount,
      address,
    );
  }
}
