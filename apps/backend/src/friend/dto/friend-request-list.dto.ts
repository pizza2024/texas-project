import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { FriendStatus } from '@texas/shared';

export class FriendRequestListQueryDto {
  @IsOptional()
  @IsString()
  status?: FriendStatus = 'PENDING';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
