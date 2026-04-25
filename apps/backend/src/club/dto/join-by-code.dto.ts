import { IsString, Length, Matches } from 'class-validator';

export class JoinByCodeDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
  code: string;
}
