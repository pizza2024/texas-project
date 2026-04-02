import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  blindSmall?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  blindBig?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(9)
  maxPlayers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBuyIn?: number;

  @IsOptional()
  @IsString()
  password?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tier?: string;
}
