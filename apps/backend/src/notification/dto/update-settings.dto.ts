import { IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  doNotDisturb?: boolean;

  @IsInt()
  @Min(0)
  @Max(1439)
  @IsOptional()
  dndStart?: number; // minutes from midnight

  @IsInt()
  @Min(0)
  @Max(1439)
  @IsOptional()
  dndEnd?: number;

  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;
}
