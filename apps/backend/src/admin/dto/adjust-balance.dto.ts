import { IsNumber, IsString, IsOptional } from 'class-validator';

export class AdjustBalanceDto {
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
