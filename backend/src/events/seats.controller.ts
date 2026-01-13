import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('seats')
export class SeatsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':batchId')
  async getSeats(@Param('batchId') batchId: string) {
      return this.eventsService.getSeats(batchId);
  }
}
