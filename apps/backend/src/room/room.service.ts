import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Room, Prisma } from '@prisma/client';
import { ROOM_CREATED_EVENT, roomEvents } from '../websocket/room-events';

export interface PaginatedRooms {
  data: Room[];
  total: number;
}

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(
    data: Prisma.RoomCreateInput,
  ): Promise<Omit<Room, 'password'>> {
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

    const { password: _omitted, ...safeRoom } = room;
    return safeRoom;
  }

  async findAll(clubId?: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { isMatchmaking: false, ...(clubId && { clubId }) },
    });
  }

  async findAllTournamentRooms(): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: {
        isTournament: true,
        isMatchmaking: false,
      },
    });
  }

  async findAllPaginated(
    page: number,
    limit: number,
    clubId?: string,
  ): Promise<PaginatedRooms> {
    const where = { isMatchmaking: false, ...(clubId && { clubId }) };
    const [data, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.room.count({ where }),
    ]);
    return { data, total };
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
