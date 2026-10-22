import { Controller, Get, Param, UseGuards, Post, Body, Request, Query, ParseUUIDPipe } from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard, ProducerGuard } from '../common/guards';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(AuthGuard('jwt'), ProducerGuard)
  @Post()
  create(@Body() createEventDto: any, @Request() req) {
    return this.eventsService.create(createEventDto, req.user);
  }

  @Get()
  findAll(@Query('category') category: string, @Query('search') search: string) {
    return this.eventsService.findAll(category, search);
  }

  @UseGuards(AuthGuard('jwt'), ProducerGuard)
  @Get('my/all')
  findMyEvents(@Request() req) {
    return this.eventsService.findByProducer(req.user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.eventsService.findPublic(id, req.user);
  }

  @UseGuards(AuthGuard('jwt'), ProducerGuard)
  @Post(':id')
  updateEvent(@Param('id', ParseUUIDPipe) id: string, @Body() updateData: any, @Request() req) {
    return this.eventsService.update(id, updateData, req.user);
  }
}
