import {
  IsNumber,
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
} from 'class-validator';

/** For /admin/users/:id/balance - userId is in URL, not body */
export class AdjustBalanceDto {
  @IsNumber()
  amount: number;

  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @IsString()
  reason: string;
}

export class DepositDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  amount: number;

  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @IsString()
  reason: string;
}

export class WithdrawDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  amount: number;

  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @IsString()
  reason: string;
}
