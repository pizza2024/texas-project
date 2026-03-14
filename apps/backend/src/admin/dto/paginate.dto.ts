import { IsNumber, IsString, IsOptional } from 'class-validator';

export class PaginateDto {
  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  search?: string;

  @IsOptional()
  status?: string;
}
