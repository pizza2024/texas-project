import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { RegisterWithEmailDto } from './dto/register-with-email.dto';
import { TableManagerService } from '../table-engine/table-manager.service';

@Injectable()
export class AuthService {
  private static readonly STARTING_BALANCE = 10000;
  private static readonly SESSION_KEY_PREFIX = 'user_session:';
  private static readonly SESSION_TTL_SECONDS = 3600;
  private static readonly OTP_TTL_SECONDS = 600; // 10 minutes
  private static readonly OTP_RATE_LIMIT_PREFIX = 'otp_rate:';
  private static readonly OTP_RATE_LIMIT_SECONDS = 60; // 1 per 60 seconds
  private static readonly OTP_ATTEMPTS_PREFIX = 'otp_attempts:';
  private static readonly OTP_MAX_ATTEMPTS = 5;
  private static readonly OTP_ATTEMPTS_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private walletService: WalletService,
    private redisService: RedisService,
    private emailService: EmailService,
    private tableManagerService: TableManagerService,
  ) {}

  async validateUser(
    identifier: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    // Optimize: identifiers containing '@' are emails, skip username lookup
    if (identifier.includes('@')) {
      const emailUser = await this.userService.findByEmail(identifier);
      if (emailUser && (await bcrypt.compare(pass, emailUser.password))) {
        const { password, ...result } = emailUser;
        return result;
      }
      return null;
    }

    const user = await this.userService.user({ username: identifier });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const identifier = loginDto.username || loginDto.email;
    if (!identifier) {
      throw new BadRequestException('Username or email is required');
    }
    const user = await this.validateUser(identifier, loginDto.password);
    if (!user) {
      throw new UnauthorizedException();
    }
    const sessionId = randomUUID();
    await this.redisService.set(
      `${AuthService.SESSION_KEY_PREFIX}${user.id}`,
      sessionId,
      AuthService.SESSION_TTL_SECONDS,
    );
    const payload = {
      username: user.username,
      nickname: user.nickname,
      sub: user.id,
      role: user.role ?? 'PLAYER',
      sessionId,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: await this.toAuthUser(user),
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthUserDto> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    let user: User;
    try {
      user = await this.userService.createUser({
        username: registerDto.username,
        nickname: registerDto.nickname || registerDto.username,
        coinBalance: AuthService.STARTING_BALANCE,
        password: hashedPassword,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - extract which field
          const meta = error.meta as { target?: string[] };
          const target = meta?.target;
          if (target && target.includes('username')) {
            throw new BadRequestException('Username already taken');
          }
          if (target && target.includes('nickname')) {
            throw new BadRequestException('Nickname already taken');
          }
          throw new BadRequestException('Username or nickname already taken');
        }
      }
      throw error;
    }

    // Create wallet separately with explicit chips value to ensure it starts at 10000
    await this.walletService.setBalance(user.id, AuthService.STARTING_BALANCE);

    // Re-fetch user with wallet to return correct balance
    const userWithWallet = await this.userService.user({ id: user.id });
    return this.toAuthUser(userWithWallet!);
  }

  async requestEmailCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Rate limit check
    const rateLimitKey = `${AuthService.OTP_RATE_LIMIT_PREFIX}${normalizedEmail}`;
    const existingCode = await this.redisService.get(rateLimitKey);
    if (existingCode) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting another code',
      );
    }

    // Check if email already registered
    const existingUser = await this.userService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('This email is already registered');
    }

    // Generate OTP
    const otp = this.emailService.generateOtp();
    const expiry = new Date(Date.now() + AuthService.OTP_TTL_SECONDS * 1000);

    // Store in Redis with rate limit key
    await this.redisService.set(
      `email_verify:${normalizedEmail}`,
      JSON.stringify({ code: otp, expiresAt: expiry.toISOString() }),
      AuthService.OTP_TTL_SECONDS,
    );
    await this.redisService.set(
      rateLimitKey,
      '1',
      AuthService.OTP_RATE_LIMIT_SECONDS,
    );

    // Send email
    await this.emailService.sendEmail({
      to: normalizedEmail,
      subject: 'Your CHIPS Poker Verification Code',
      html: this.buildOtpEmailHtml(otp),
    });

    return { message: 'Verification code sent to your email' };
  }

  async verifyEmailCode(
    email: string,
    code: string,
  ): Promise<{ emailVerifyToken: string }> {
    const normalizedEmail = email.toLowerCase();
    const attemptsKey = AuthService.OTP_ATTEMPTS_PREFIX + normalizedEmail;

    // Check failed attempt count
    const attempts = await this.redisService.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= AuthService.OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed attempts. Please try again after 5 minutes.',
      );
    }

    const stored = await this.redisService.get(
      `email_verify:${normalizedEmail}`,
    );
    if (!stored) {
      // Delete attempts counter on expiry
      await this.redisService.del(attemptsKey);
      throw new BadRequestException(
        'No verification code found. Please request a new one.',
      );
    }

    let storedCode: string;
    let expiresAt: number;
    try {
      const parsed = JSON.parse(stored);
      storedCode = parsed.code;
      expiresAt = parsed.expiresAt;
    } catch {
      throw new BadRequestException(
        'Verification data corrupted. Please request a new code.',
      );
    }
    if (storedCode !== code) {
      // Increment failed attempts counter
      await this.redisService.incr(
        attemptsKey,
        AuthService.OTP_ATTEMPTS_TTL_SECONDS,
      );
      const currentAttempts = (await this.redisService.get(attemptsKey)) || '1';
      const remaining =
        AuthService.OTP_MAX_ATTEMPTS - parseInt(currentAttempts, 10);
      throw new BadRequestException(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Invalid verification code.',
      );
    }

    if (new Date(expiresAt) < new Date()) {
      // Delete attempts counter on expiry
      await this.redisService.del(attemptsKey);
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // Invalidate the code and clear attempts counter
    await this.redisService.del(`email_verify:${normalizedEmail}`);
    await this.redisService.del(attemptsKey);

    // Generate a short-lived token for registration
    const emailVerifyToken = randomUUID();
    await this.redisService.set(
      `email_reg_token:${emailVerifyToken}`,
      normalizedEmail,
      900, // 15 minutes
    );

    return { emailVerifyToken };
  }

  async registerWithEmail(dto: RegisterWithEmailDto): Promise<AuthUserDto> {
    const normalizedEmail = dto.email.toLowerCase();

    // Verify the token
    const storedEmail = await this.redisService.get(
      `email_reg_token:${dto.emailVerifyToken}`,
    );
    if (!storedEmail || storedEmail !== normalizedEmail) {
      throw new BadRequestException(
        'Invalid or expired verification token. Please start again.',
      );
    }

    // Clean up token
    await this.redisService.del(`email_reg_token:${dto.emailVerifyToken}`);

    // Check username uniqueness
    const existingUsername = await this.userService.user({
      username: dto.username,
    });
    if (existingUsername) {
      throw new BadRequestException('Username already taken');
    }

    // Check nickname uniqueness
    const existingNickname = await this.userService.user({
      nickname: dto.nickname,
    });
    if (existingNickname) {
      throw new BadRequestException('Nickname already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.userService.createUser({
      username: dto.username,
      nickname: dto.nickname,
      email: normalizedEmail,
      emailVerified: true,
      coinBalance: AuthService.STARTING_BALANCE,
      password: hashedPassword,
    });

    // Create wallet separately with explicit chips value to ensure it starts at 10000
    await this.walletService.setBalance(user.id, AuthService.STARTING_BALANCE);

    // Re-fetch user with wallet to return correct balance
    const userWithWallet = await this.userService.user({ id: user.id });
    return this.toAuthUser(userWithWallet!);
  }

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.userService.user({ id: userId });
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toAuthUser(user);
  }

  async logout(userId: string): Promise<void> {
    // Explicit logout should always release table seat/frozen chips.
    await this.tableManagerService.leaveCurrentRoom(userId).catch(() => null);
    await this.redisService.del(`${AuthService.SESSION_KEY_PREFIX}${userId}`);
  }

  private async toAuthUser(user: {
    id: string;
    nickname: string;
    avatar: string | null;
    coinBalance: number;
    elo: number;
  }): Promise<AuthUserDto> {
    const balance = await this.walletService.getBalance(user.id);

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      coinBalance: balance,
      elo: user.elo,
    };
  }

  private buildOtpEmailHtml(code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #060e10; color: #f0f0f0; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #0d1a14; border: 1px solid #d97706; border-radius: 12px; padding: 40px; text-align: center; }
    .logo { font-size: 2.5rem; margin-bottom: 8px; }
    .title { font-size: 1.5rem; font-weight: bold; color: #fcd34d; margin-bottom: 24px; }
    .code { font-size: 3rem; font-weight: bold; letter-spacing: 0.3em; color: #f59e0b; margin: 30px 0; }
    .subtitle { color: #9ca3af; font-size: 0.9rem; line-height: 1.6; }
    .footer { margin-top: 30px; font-size: 0.75rem; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🃏</div>
    <div class="title">CHIPS POKER</div>
    <p class="subtitle">Your verification code is:</p>
    <div class="code">${code}</div>
    <p class="subtitle">This code expires in <strong>10 minutes</strong>.<br>Do not share it with anyone.</p>
    <div class="footer">If you didn't request this code, you can safely ignore this email.</div>
  </div>
</body>
</html>
    `;
  }
}
