import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplyRateLimit, RateLimitGuard } from '../auth/rate-limit.guard';
class CreateRoomDto {
  @IsString()
  @MaxLength(30)
  name: string;

  @IsNumber()
  @Min(1)
  @Max(9999)
  @Type(() => Number)
  blindSmall: number;

  @IsNumber()
  @Min(2)
  @Max(99999)
  @Type(() => Number)
  blindBig: number;

  @IsNumber()
  @Min(2)
  @Max(9)
  @Type(() => Number)
  maxPlayers: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minBuyIn?: number;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  clubId?: string;

  @IsBoolean()
  @IsOptional()
  isClubOnly?: boolean;
}

interface VerifyPasswordDto {
  password: string;
}

@Controller('rooms')
@ApiTags('Rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new room' })
  async create(@Body() dto: CreateRoomDto) {
    // P2-CLUB-007: isClubOnly and clubId must be consistent
    if (dto.isClubOnly === true && !dto.clubId) {
      throw new BadRequestException('俱乐部专属房间必须指定 clubId');
    }
    if (dto.blindBig < dto.blindSmall * 2) {
      throw new BadRequestException('大盲注必须大于等于小盲注的两倍');
    }
    const effectiveMinBuyIn = dto.minBuyIn ?? dto.blindBig;
    if (effectiveMinBuyIn < dto.blindBig) {
      throw new BadRequestException('最小买入必须大于等于大盲注');
    }
    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;
    const room = await this.roomService.createRoom({
      name: dto.name,
      blindSmall: dto.blindSmall,
      blindBig: dto.blindBig,
      maxPlayers: dto.maxPlayers,
      minBuyIn: effectiveMinBuyIn,
      password: hashedPassword ?? undefined,
      ...(dto.clubId && { clubId: dto.clubId }),
      ...(dto.isClubOnly !== undefined && { isClubOnly: dto.isClubOnly }),
    });
    // Never return password hash to client
    const { password: _password, ...safeRoom } = room as any;
    return { ...safeRoom, isPrivate: !!dto.password };
  }

  @Get()
  @ApiOperation({ summary: 'List all public rooms' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const result = await this.roomService.findAllPaginated(page, limit);
    return {
      data: result.data.map(({ password, ...room }) => ({
        ...room,
        isPrivate: !!password,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by ID' })
  async findOne(@Param('id') id: string) {
    const room = await this.roomService.findOne(id);
    if (!room) return null;
    const { password, ...rest } = room;
    return { ...rest, isPrivate: !!password };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a room by ID' })
  async delete(@Param('id') id: string) {
    await this.roomService.deleteRoom(id);
    return { id };
  }

  @Post(':id/verify-password')
  @UseGuards(AuthGuard('jwt'), RateLimitGuard)
  @ApplyRateLimit({
    limit: 10,
    windowSeconds: 60,
    keyPrefix: 'room_pw_verify',
    keyType: 'user',
  })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify room password for private rooms' })
  async verifyPassword(
    @Param('id') id: string,
    @Body() dto: VerifyPasswordDto,
  ): Promise<{ valid: boolean }> {
    const room = await this.roomService.findOne(id);
    if (!room || !room.password) {
      // Public rooms always return valid
      return { valid: true };
    }
    const valid = await bcrypt.compare(dto.password, room.password);
    return { valid };
  }
}
