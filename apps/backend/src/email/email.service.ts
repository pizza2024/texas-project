import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: any = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = require('nodemailer');
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        this.logger.log('Email transporter initialized with SMTP');
      } catch (e) {
        this.logger.warn(
          'Failed to initialize nodemailer, using console logging',
          e,
        );
      }
    } else {
      this.logger.log(
        'SMTP not configured — emails will be logged to console. ' +
          'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable real email delivery.',
      );
    }
  }

  async sendEmail(
    options: SendEmailOptions,
  ): Promise<{ success: boolean; previewUrl?: string }> {
    const from = process.env.SMTP_FROM || 'noreply@chips-poker.com';

    // Console logging for non-production or no SMTP configured
    if (!this.transporter) {
      this.logToConsole(options, from);
      return { success: true };
    }

    try {
      const nodemailer = require('nodemailer');
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
      });

      const previewUrl = nodemailer.getTestMessageUrl
        ? nodemailer.getTestMessageUrl(info)
        : null;

      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
      return { success: true, previewUrl: previewUrl || undefined };
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return { success: false };
    }
  }

  private logToConsole(options: SendEmailOptions, from: string) {
    const divider = '═'.repeat(60);
    const timestamp = new Date().toISOString();
    console.log(`\n${divider}`);
    console.log(`📧 EMAIL [${timestamp}]`);
    console.log(`From: ${from}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(divider);
    console.log(options.html);
    console.log(`${divider}\n`);
  }

  generateOtp(): string {
    // 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
