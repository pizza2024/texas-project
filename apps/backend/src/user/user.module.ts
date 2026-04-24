import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PassportModule } from '@nestjs/passport';
import { TableEngineModule } from '../table-engine/table-engine.module';
import { RakebackModule } from '../rakeback/rakeback.module';

@Module({
  imports: [PassportModule, TableEngineModule, RakebackModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
