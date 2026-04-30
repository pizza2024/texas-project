import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Telegram Admin Alerts (existing) ───────────────────────────────────────

  private get botToken(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    return token;
  }

  private get adminChatId(): string {
    return process.env.TELEGRAM_ADMIN_CHAT_ID ?? '6241972492';
  }

  /**
   * Send a message to the admin Telegram chat.
   * Silently fails if bot token is not configured (non-blocking).
   */
  async sendAdminAlert(message: string): Promise<void> {
    try {
      await this.sendMessage({
        chatId: this.adminChatId,
        text: this.formatAlert(message),
        parseMode: 'Markdown',
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send Telegram alert: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Send a Telegram message to a specific chat.
   */
  async sendMessage(msg: {
    chatId: string;
    text: string;
    parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  }): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: msg.chatId,
        text: msg.text,
        parse_mode: msg.parseMode ?? 'Markdown',
        disable_web_page_preview: true,
      });
      this.logger.debug(`Telegram message sent to ${msg.chatId}`);
    } catch (err) {
      const error = err as { response?: { data?: { description?: string } } };
      const desc = error.response?.data?.description ?? (err as Error).message;
      throw new Error(`Telegram send failed: ${desc}`);
    }
  }

  private formatAlert(message: string): string {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });
    return `🔴 *Withdraw Alert* 🔴\n\n${message}\n\n⏰ ${timestamp}`;
  }

  // ── In-App Notification Center ─────────────────────────────────────────────

  /**
   * Create a new notification and persist to DB.
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata ?? undefined,
      },
    });
  }

  /**
   * Find all notifications for a user with pagination.
   * Sorted by createdAt descending.
   */
  async findAll(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Batch mark notifications as read for a specific user.
   * Only updates notifications that belong to the user.
   */
  async markRead(ids: string[], userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId,
        read: false,
      },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   * Returns the count of updated records.
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Cleanup old notifications per retention policy:
   * - Max 100 per user (delete oldest read notifications first)
   * - Delete notifications older than 30 days
   */
  async cleanupOld(userId: string): Promise<{ deleted: number }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleteOldResult = await this.prisma.notification.deleteMany({
      where: {
        userId,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    const countResult = await this.prisma.notification.count({
      where: { userId },
    });

    let deleted = deleteOldResult.count;

    if (countResult > 100) {
      const excess = countResult - 100;
      const toDelete = await this.prisma.notification.findMany({
        where: { userId, read: true },
        orderBy: { createdAt: 'asc' },
        take: excess,
        select: { id: true },
      });

      if (toDelete.length > 0) {
        const deleteResult = await this.prisma.notification.deleteMany({
          where: {
            id: { in: toDelete.map((n) => n.id) },
          },
        });
        deleted += deleteResult.count;
      }
    }

    return { deleted };
  }

  // ── User Notification Settings ─────────────────────────────────────────────

  async getSettings(userId: string) {
    return this.prisma.userNotificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.userNotificationSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }

  async isPushAllowed(userId: string): Promise<boolean> {
    const settings = await this.getSettings(userId);
    if (!settings.doNotDisturb) return true;

    if (settings.dndStart == null || settings.dndEnd == null) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (settings.dndStart > settings.dndEnd) {
      if (
        currentMinutes >= settings.dndStart ||
        currentMinutes < settings.dndEnd
      ) {
        return false;
      }
    } else {
      if (
        currentMinutes >= settings.dndStart &&
        currentMinutes < settings.dndEnd
      ) {
        return false;
      }
    }
    return true;
  }
}
