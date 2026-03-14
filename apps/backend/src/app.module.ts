import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WalletModule } from './wallet/wallet.module';
import { RoomModule } from './room/room.module';
import { TableEngineModule } from './table-engine/table-engine.module';
import { WebsocketModule } from './websocket/websocket.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    WalletModule,
    RoomModule,
    TableEngineModule,
    WebsocketModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
