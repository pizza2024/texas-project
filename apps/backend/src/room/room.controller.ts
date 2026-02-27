import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createRoomDto: Prisma.RoomCreateInput) {
    return this.roomService.createRoom(createRoomDto);
  }

  @Get()
  findAll() {
    return this.roomService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findOne(id);
  }
}
