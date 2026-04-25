import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RakebackService } from './rakeback.service';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('user/rakeback')
@ApiTags('Rakeback')
export class RakebackController {
  constructor(private readonly rakebackService: RakebackService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user rakeback info' })
  async getRakeback(@Request() req: { user: JwtUser }) {
    return this.rakebackService.getRakeback(req.user.userId);
  }

  @Post('claim')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim rakeback balance to chips' })
  async claimRakeback(@Request() req: { user: JwtUser }) {
    return this.rakebackService.claimRakeback(req.user.userId);
  }
}
