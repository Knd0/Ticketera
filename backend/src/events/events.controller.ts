import { Controller, Get, Param, UseGuards, Post, Body, Request, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createEventDto: any, @Request() req) {
    return this.eventsService.create(createEventDto, req.user);
  }

  @Get()
  findAll(@Query('category') category: string) {
      return this.eventsService.findAll(category);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/all')
  findMyEvents(@Request() req) {
      return this.eventsService.findByProducer(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
      return this.eventsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id') 
  updateEvent(@Param('id') id: string, @Body() updateData: any, @Request() req) {
      return this.eventsService.update(id, updateData, req.user);
  }
}
