import {
  IsEmail,
  IsString,
  MinLength,
  Length,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterWithEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({ example: 'abc123token' })
  @IsString()
  @MinLength(10, { message: 'Invalid verification token' })
  emailVerifyToken: string;

  @ApiProperty({ example: 'coolplayer' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'Cool Player' })
  @IsString()
  @MinLength(2)
  nickname: string;

  @ApiProperty({ example: 'securepassword' })
  @IsString()
  @MinLength(6)
  password: string;
}
