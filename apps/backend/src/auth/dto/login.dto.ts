import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
