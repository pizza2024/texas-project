import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { UserService } from './user.service';
import { HandHistoryService } from '../table-engine/hand-history.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

const UPLOADS_DIR = 'uploads/avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/;

@Controller('user')
@ApiTags('User')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly handHistoryService: HandHistoryService,
  ) {}

  @Get('stats/online')
  @ApiOperation({ summary: 'Get online player counts' })
  async getOnlinePlayerStats() {
    return this.userService.getOnlinePlayerCount();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user game statistics' })
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.userService.getUserStats(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('hands')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user hand history' })
  async getHandHistory(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.handHistoryService.getPlayerHandHistory(
      req.user.userId,
      limit,
      offset,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('hands/:handId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detail of a specific hand' })
  async getHandDetail(@Req() req: AuthenticatedRequest) {
    // Hand ID is passed as a query param when navigating from history list
    // The actual endpoint uses /user/hands/export or the detail view
    return { message: 'Use /user/hands endpoint to browse history' };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload or replace user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only image files are allowed (jpeg/png/gif/webp)',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const userId = req.user.userId;

    // Delete old avatar file if it exists
    const oldAvatar = await this.userService.getUserAvatar(userId);
    if (oldAvatar) {
      const oldPath = oldAvatar.replace(/^\//, '');
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const avatarUrl = `/${UPLOADS_DIR}/${file.filename}`;
    await this.userService.updateAvatar(userId, avatarUrl);
    return { avatarUrl };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove user avatar (revert to emoji)' })
  async deleteAvatar(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;

    const oldAvatar = await this.userService.getUserAvatar(userId);
    if (oldAvatar) {
      const oldPath = oldAvatar.replace(/^\//, '');
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await this.userService.updateAvatar(userId, null);
    return { avatarUrl: null };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.userService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }
}
