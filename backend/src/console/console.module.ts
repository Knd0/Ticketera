import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ConsoleController],
  providers: [ConsoleService],
})
export class ConsoleModule {}
