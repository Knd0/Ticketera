import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './event.entity';
import { Batch } from './batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Batch])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
