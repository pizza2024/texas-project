import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.userService.user({ nickname: username }); // Assuming username is nickname for simplicity
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException();
    }
    const payload = { username: user.nickname, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.toAuthUser(user),
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthUserDto> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.createUser({
      nickname: registerDto.nickname,
      password: hashedPassword,
      wallet: {
        create: {
          balance: 10000, // Starting balance
        },
      },
    });
    return this.toAuthUser(user);
  }

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.userService.user({ id: userId });
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toAuthUser(user);
  }

  private toAuthUser(user: {
    id: string;
    nickname: string;
    avatar: string | null;
    coinBalance: number;
  }): AuthUserDto {
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      coinBalance: user.coinBalance,
    };
  }
}
