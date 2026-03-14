import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { UserService } from './user.service';
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
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload or replace user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed (jpeg/png/gif/webp)'), false);
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
}
