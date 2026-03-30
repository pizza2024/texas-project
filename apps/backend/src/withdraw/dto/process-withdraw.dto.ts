import { IsString, IsOptional, IsIn } from 'class-validator';

export class ProcessWithdrawDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'], { message: 'action must be APPROVE or REJECT' })
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  reason?: string;
}
