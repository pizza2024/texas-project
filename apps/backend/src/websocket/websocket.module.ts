import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { TableEngineModule } from '../table-engine/table-engine.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TableEngineModule,
    AuthModule,
    UserModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
    }),
  ],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class WebsocketModule {}
