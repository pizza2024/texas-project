import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Room, Prisma } from '@prisma/client';
import { ROOM_CREATED_EVENT, roomEvents } from '../websocket/room-events';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(data: Prisma.RoomCreateInput): Promise<Room> {
    const room = await this.prisma.room.create({
      data,
    });

    roomEvents.emit(ROOM_CREATED_EVENT, {
      id: room.id,
      name: room.name,
      blindSmall: room.blindSmall,
      blindBig: room.blindBig,
      maxPlayers: room.maxPlayers,
      minBuyIn: room.minBuyIn > 0 ? room.minBuyIn : room.blindBig,
      isPrivate: !!room.password,
    });

    return room;
  }

  async findAll(): Promise<Room[]> {
    return this.prisma.room.findMany({ where: { isMatchmaking: false } });
  }

  async findOne(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({
      where: { id },
    });
  }

  async deleteRoom(id: string): Promise<Room> {
    return this.prisma.room.delete({
      where: { id },
    });
  }
}
