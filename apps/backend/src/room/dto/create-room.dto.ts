import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: 'Room name', maxLength: 30 })
  @IsString()
  @MaxLength(30, { message: '房间名称最多30个字符' })
  @MinLength(1)
  name: string;

  @ApiProperty({ description: 'Small blind amount' })
  @IsNumber()
  @Min(1, { message: '小盲注至少为1' })
  blindSmall: number;

  @ApiProperty({ description: 'Big blind amount' })
  @IsNumber()
  @Min(1, { message: '大盲注至少为1' })
  blindBig: number;

  @ApiProperty({ description: 'Maximum players (2-9)' })
  @IsNumber()
  @Min(2, { message: '最少2个玩家' })
  @Max(9, { message: '最多9个玩家' })
  maxPlayers: number;

  @ApiPropertyOptional({ description: 'Minimum buy-in (defaults to big blind)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBuyIn?: number;

  @ApiPropertyOptional({ description: 'Room password (creates private room)' })
  @IsOptional()
  @IsString()
  password?: string;
}
