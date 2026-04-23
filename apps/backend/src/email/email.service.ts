import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { randomInt } from 'crypto';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM || 'noreply@chips-poker.com';
    this.initResend();
  }

  private initResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email client initialized');
    } else {
      this.logger.log(
        'RESEND_API_KEY not configured — emails will be logged to console. ' +
          'Set RESEND_API_KEY to enable real email delivery.',
      );
    }
  }

  async sendEmail(
    options: SendEmailOptions,
  ): Promise<{ success: boolean; previewUrl?: string }> {
    // Console logging for non-production or no Resend configured
    if (!this.resend) {
      this.logToConsole(options);
      return { success: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
      });

      if (error) {
        this.logger.error(
          `Failed to send email to ${options.to}: ${error.message}`,
          error,
        );
        return { success: false };
      }

      this.logger.log(
        `Email sent to ${options.to}: ${options.subject}, ID: ${data?.id}`,
      );
      return { success: true, previewUrl: undefined };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return { success: false };
    }
  }

  private logToConsole(options: SendEmailOptions) {
    const divider = '═'.repeat(60);
    const timestamp = new Date().toISOString();
    this.logger.log(`\n${divider}`);
    this.logger.log(`📧 EMAIL [${timestamp}]`);
    this.logger.log(`From: ${this.fromEmail}`);
    this.logger.log(`To: ${options.to}`);
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(divider);
    this.logger.log(options.html);
    this.logger.log(`${divider}\n`);
  }

  generateOtp(): string {
    // 6-digit OTP using cryptographically secure random
    return randomInt(100000, 999999).toString();
  }
}
