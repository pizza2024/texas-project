import { Module, forwardRef } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { WebSocketManager } from './websocket-manager';
import { TableEngineModule } from '../table-engine/table-engine.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { BotModule } from '../bot/bot.module';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [
    TableEngineModule,
    AuthModule,
    UserModule,
    MatchmakingModule,
    BotModule,
    forwardRef(() => FriendModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
    }),
  ],
  providers: [AppGateway, WebSocketManager],
  exports: [AppGateway, WebSocketManager],
})
export class WebsocketModule {}
