import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ClubService } from './club.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { CreateInviteCodeDto } from './dto/create-invite-code.dto';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import { ClubListQueryDto } from './dto/club-list.query.dto';
import { ClubMemberListQueryDto } from './dto/club-member-list.query.dto';
import { ClubChatListQueryDto } from './dto/club-chat-list.query.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@ApiTags('Club')
@Controller('clubs')
export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  // ── Club CRUD ───────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new club' })
  async createClub(
    @Body() dto: CreateClubDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.createClub(req.user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get club details' })
  async getClub(@Param('id') clubId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    return this.clubService.getClub(clubId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List clubs' })
  async listClubs(@Query() query: ClubListQueryDto) {
    return this.clubService.listClubs(
      query.search,
      query.cursor,
      query.limit ?? 20,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update club info (owner only)' })
  async updateClub(
    @Param('id') clubId: string,
    @Body() dto: UpdateClubDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.updateClub(req.user.userId, clubId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a club (owner only)' })
  async deleteClub(
    @Param('id') clubId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.clubService.deleteClub(req.user.userId, clubId);
  }

  // ── Membership ───────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a club' })
  async joinClub(
    @Param('id') clubId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.joinClub(req.user.userId, clubId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a club (owner cannot leave)' })
  async leaveClub(
    @Param('id') clubId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.clubService.leaveClub(req.user.userId, clubId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List club members' })
  async getMembers(
    @Param('id') clubId: string,
    @Query() query: ClubMemberListQueryDto,
  ) {
    return this.clubService.getMembers(
      clubId,
      query.search,
      query.cursor,
      query.limit ?? 20,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id/members/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change member role (owner only)' })
  async changeMemberRole(
    @Param('id') clubId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.changeMemberRole(
      req.user.userId,
      clubId,
      targetUserId,
      dto.role,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kick a member (admin/owner only)' })
  async kickMember(
    @Param('id') clubId: string,
    @Param('userId') targetUserId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.clubService.kickMember(req.user.userId, clubId, targetUserId);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/chat')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a chat message' })
  async sendMessage(
    @Param('id') clubId: string,
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.sendMessage(req.user.userId, clubId, dto.message);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get chat history' })
  async getChatHistory(
    @Param('id') clubId: string,
    @Query() query: ClubChatListQueryDto,
  ) {
    return this.clubService.getChatHistory(
      clubId,
      query.cursor,
      query.limit ?? 50,
    );
  }

  // ── My clubs ─────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('me/clubs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get clubs the current user belongs to' })
  async getMyClubs(@Req() req: AuthenticatedRequest) {
    return this.clubService.getUserClubs(req.user.userId);
  }

  // ── Invite Codes ─────────────────────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/invite-codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an invite code for the club' })
  async createInviteCode(
    @Param('id') clubId: string,
    @Body() dto: CreateInviteCodeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.createInviteCode(req.user.userId, clubId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/invite-codes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all invite codes for the club' })
  async listInviteCodes(
    @Param('id') clubId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.listInviteCodes(req.user.userId, clubId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/invite-codes/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete/revoke an invite code' })
  async deleteInviteCode(
    @Param('id') clubId: string,
    @Param('codeId') codeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.clubService.deleteInviteCode(req.user.userId, clubId, codeId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('join-by-code')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a club by invite code' })
  async joinByCode(
    @Body() dto: JoinByCodeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clubService.joinByCode(req.user.userId, dto.code);
  }

  @Get('validate-code')
  @ApiOperation({ summary: 'Validate an invite code (returns club info if valid)' })
  async validateCode(@Query('code') code: string) {
    const result = await this.clubService.validateInviteCode(code);
    if (!result.valid) {
      return { valid: false };
    }
    // Fetch full club info
    const club = await this.clubService.getClub(result.club!.id, undefined);
    return { valid: true, club: { id: club.id, name: club.name, avatar: club.avatar } };
  }
}
