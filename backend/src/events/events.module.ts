import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './event.entity';
import { Batch } from './batch.entity';
import { Seat } from './seat.entity';
import { SeatsController } from './seats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Batch, Seat])],
  controllers: [EventsController, SeatsController],
  providers: [EventsService],
})
export class EventsModule {}
