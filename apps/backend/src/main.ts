import * as dotenv from 'dotenv';
// 先加载基础配置，再用 .local 覆盖（.local 不提交 Git，存放敏感值）
dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
dotenv.config({
  path: `.env.${process.env.NODE_ENV ?? 'development'}.local`,
  override: true,
});

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // CORS 配置 - 生产环境建议限制 origin
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const normalizeOrigin = (value: string) =>
    value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');

  const parsedCorsOrigin =
    corsOrigin === '*'
      ? '*'
      : corsOrigin
          .split(',')
          .map((origin) => normalizeOrigin(origin))
          .filter((origin) => origin.length > 0);

  if (parsedCorsOrigin !== '*') {
    logger.log(`CORS allowed origins: ${parsedCorsOrigin.join(', ')}`);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (parsedCorsOrigin === '*') {
        callback(null, true);
        return;
      }

      // Allow non-browser requests without an Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      const requestOrigin = normalizeOrigin(origin);
      if (parsedCorsOrigin.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `CORS blocked for origin: ${requestOrigin}. Allowed: ${parsedCorsOrigin.join(', ')}`,
        ),
        false,
      );
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Serve uploaded files (avatars etc.) as static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const config = new DocumentBuilder()
    .setTitle('Texas Project API')
    .setDescription('Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
