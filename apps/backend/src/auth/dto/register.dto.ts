import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(20, { message: '用户名最多20个字符' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '用户名只能包含字母、数字和下划线',
  })
  username: string;

  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  password: string;

  @IsString()
  @MinLength(2, { message: '昵称至少2个字符' })
  @MaxLength(30, { message: '昵称最多30个字符' })
  nickname: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;
}
