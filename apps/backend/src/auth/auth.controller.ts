import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard } from '@nestjs/passport';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { JwtUser } from './interfaces/jwt-user.interface';
import { RequestEmailCodeDto } from './dto/request-email-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { RegisterWithEmailDto } from './dto/register-with-email.dto';
import { RateLimitGuard, ApplyRateLimit } from './rate-limit.guard';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @ApplyRateLimit({ limit: 5, windowSeconds: 900, keyPrefix: 'rl:login' })
  @ApiOperation({ summary: 'User login' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @UseGuards(RateLimitGuard)
  @ApplyRateLimit({ limit: 10, windowSeconds: 3600, keyPrefix: 'rl:register' })
  @ApiOperation({ summary: 'User registration (username + password)' })
  @ApiOkResponse({ type: AuthUserDto })
  async register(@Body() registerDto: RegisterDto): Promise<AuthUserDto> {
    return this.authService.register(registerDto);
  }

  @Post('request-email-code')
  @UseGuards(RateLimitGuard)
  @ApplyRateLimit({
    limit: 3,
    windowSeconds: 3600,
    keyPrefix: 'rl:email-code',
    keyType: 'emailOrIp',
  })
  @ApiOperation({
    summary: 'Request email verification code (Step 1 of email registration)',
  })
  @ApiOkResponse({ description: 'Verification code sent to email' })
  async requestEmailCode(
    @Body() dto: RequestEmailCodeDto,
  ): Promise<{ message: string }> {
    return this.authService.requestEmailCode(dto.email);
  }

  @Post('verify-email-code')
  @ApiOperation({
    summary: 'Verify email code and get temporary registration token (Step 2)',
  })
  @ApiOkResponse({ description: 'Returns emailVerifyToken for registration' })
  async verifyEmailCode(
    @Body() dto: VerifyEmailCodeDto,
  ): Promise<{ emailVerifyToken: string }> {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @Post('register-with-email')
  @ApiOperation({
    summary:
      'Register with email + verified token (Step 3 — after email verification)',
  })
  @ApiOkResponse({ type: AuthUserDto })
  async registerWithEmail(
    @Body() dto: RegisterWithEmailDto,
  ): Promise<AuthUserDto> {
    return this.authService.registerWithEmail(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getProfile(@Req() req: AuthenticatedRequest): Promise<AuthUserDto> {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    await this.authService.logout(req.user.userId);
    return { message: 'Logged out successfully' };
  }
}
