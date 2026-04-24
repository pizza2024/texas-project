import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateClubDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
