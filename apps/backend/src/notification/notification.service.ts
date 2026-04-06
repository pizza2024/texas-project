import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

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
  async sendMessage(msg: TelegramMessage): Promise<void> {
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
}
