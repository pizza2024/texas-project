import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Room, Prisma } from '@prisma/client';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(data: Prisma.RoomCreateInput): Promise<Room> {
    return this.prisma.room.create({
      data,
    });
  }

  async findAll(): Promise<Room[]> {
    return this.prisma.room.findMany();
  }

  async findOne(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({
      where: { id },
    });
  }
}
