import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 'b6db7a18-3ce1-4784-8026-c7cf7c8c35df' })
  id: string;

  @ApiProperty({ example: 'poker_ace' })
  nickname: string;

  @ApiProperty({ example: 'https://cdn.example.com/avatar.png', nullable: true, required: false })
  avatar: string | null;

  @ApiProperty({ example: 10000 })
  coinBalance: number;
}
