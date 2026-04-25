import { IsOptional, IsIn } from 'class-validator';

export class GetStatsQueryDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'allTime'])
  period?: 'daily' | 'weekly' | 'monthly' | 'allTime' = 'allTime';
}
