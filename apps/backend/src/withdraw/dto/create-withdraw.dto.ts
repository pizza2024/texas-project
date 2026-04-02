import { IsString, IsNumber, IsPositive, Min, Matches } from 'class-validator';

export class CreateWithdrawDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'toAddress must be a valid ETH address',
  })
  toAddress!: string;

  @IsNumber()
  @IsPositive({ message: 'amountChips must be positive' })
  @Min(1000, { message: 'Minimum withdraw is 1000 chips (10 USDT)' })
  amountChips!: number;
}
