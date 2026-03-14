import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AuthService {
  private static readonly STARTING_BALANCE = 10000;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private walletService: WalletService,
  ) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.userService.user({ username });
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
    const payload = { username: user.username, nickname: user.nickname, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: await this.toAuthUser(user),
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthUserDto> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.createUser({
      username: registerDto.username,
      nickname: registerDto.nickname || registerDto.username,
      coinBalance: AuthService.STARTING_BALANCE,
      password: hashedPassword,
      wallet: {
        create: {
          balance: AuthService.STARTING_BALANCE,
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

  private async toAuthUser(user: {
    id: string;
    nickname: string;
    avatar: string | null;
    coinBalance: number;
  }): Promise<AuthUserDto> {
    const balance = await this.walletService.getBalance(user.id);

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      coinBalance: balance,
    };
  }
}
