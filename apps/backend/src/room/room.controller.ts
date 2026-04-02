import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

interface CreateRoomDto {
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn?: number;
  password?: string;
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
    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;
    return this.roomService.createRoom({
      name: dto.name,
      blindSmall: dto.blindSmall,
      blindBig: dto.blindBig,
      maxPlayers: dto.maxPlayers,
      minBuyIn: dto.minBuyIn ?? 0,
      password: hashedPassword ?? undefined,
    });
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
  @Post(':id/verify-password')
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
