import { IsNumber, IsString, IsOptional, IsUUID } from 'class-validator';

/** For /admin/users/:id/balance - userId is in URL, not body */
export class AdjustBalanceDto {
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DepositDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class WithdrawDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
