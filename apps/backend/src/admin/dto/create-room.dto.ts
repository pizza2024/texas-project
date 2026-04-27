import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  blindSmall: number;

  @IsNumber()
  @Min(1)
  blindBig: number;

  @IsNumber()
  @Min(2)
  @Max(9)
  maxPlayers: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBuyIn?: number;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isMatchmaking?: boolean;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsBoolean()
  isClubOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
