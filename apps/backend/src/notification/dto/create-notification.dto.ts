import { Prisma } from '@prisma/client';

export class CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
}
