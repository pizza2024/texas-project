import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';

interface CreateRoomDto {
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn?: number;
  password?: string;
}

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() dto: CreateRoomDto) {
    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 10) : null;
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
  async findAll() {
    const rooms = await this.roomService.findAll();
    // Never expose password hash to clients
    return rooms.map(({ password, ...room }) => ({
      ...room,
      isPrivate: !!password,
    }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const room = await this.roomService.findOne(id);
    if (!room) return null;
    const { password, ...rest } = room;
    return { ...rest, isPrivate: !!password };
  }
}
