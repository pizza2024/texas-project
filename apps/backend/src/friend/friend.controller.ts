import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FriendService } from './friend.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendListQueryDto } from './dto/friend-list.dto';
import { FriendRequestListQueryDto } from './dto/friend-request-list.dto';
import { AcceptFriendRequestDto } from './dto/accept-friend-request.dto';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@ApiTags('Friend')
@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a friend request' })
  async sendFriendRequest(
    @Body() dto: SendFriendRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const friend = await this.friendService.sendFriendRequest(
      req.user.userId,
      dto.usernameOrEmail,
    );
    return {
      id: friend.id,
      status: friend.status,
      addresseeId: friend.addresseeId,
      createdAt: friend.createdAt,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get accepted friend list' })
  async getFriends(
    @Query() query: FriendListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.friendService.getFriends(
      req.user.userId,
      query.search,
      query.cursor,
      query.limit ?? 20,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an accepted friend' })
  async deleteFriend(
    @Param('id') friendId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.friendService.deleteFriend(req.user.userId, friendId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get received friend requests' })
  async getReceivedRequests(
    @Query() query: FriendRequestListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.friendService.getReceivedRequests(
      req.user.userId,
      query.status ?? 'PENDING',
      query.cursor,
      query.limit ?? 20,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a friend request' })
  async acceptFriendRequest(
    @Param('id') friendRequestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const record = await this.friendService.acceptFriendRequest(
      req.user.userId,
      friendRequestId,
    );
    return {
      id: record.id,
      status: record.status,
      addresseeId: record.addresseeId,
      createdAt: record.createdAt,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a friend request' })
  async rejectFriendRequest(
    @Param('id') friendRequestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const record = await this.friendService.rejectFriendRequest(
      req.user.userId,
      friendRequestId,
    );
    return {
      id: record.id,
      status: record.status,
      addresseeId: record.addresseeId,
      createdAt: record.createdAt,
    };
  }
}
