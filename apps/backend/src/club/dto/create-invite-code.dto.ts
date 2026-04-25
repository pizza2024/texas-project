import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateInviteCodeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168) // max 1 week
  expiresInHours?: number = 72;
}
