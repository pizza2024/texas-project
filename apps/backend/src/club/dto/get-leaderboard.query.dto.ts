import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetLeaderboardQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'allTime'])
  period?: 'daily' | 'weekly' | 'monthly' | 'allTime' = 'allTime';
}
