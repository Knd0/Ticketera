import { Controller, Get, Param, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { JwtService } from '@nestjs/jwt';

import { NotificationsService } from '../notifications/notifications.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
    private jwtService: JwtService,
    private notificationsService: NotificationsService
  ) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyTickets(@Request() req: any) {
      const tickets = await this.ticketsRepo.find({
          where: { order: { user: { id: req.user.id } } },
          relations: ['batch', 'batch.event', 'order'],
          order: { id: 'DESC' }
      });

      // Generate QR codes for display
      const ticketsWithQr: any[] = [];
      for (const ticket of tickets) {
          let qrCode = '';
          
          // Lazy generation for old/seeded tickets
          if (!ticket.signedToken) {
               const payload = { 
                  sub: ticket.id, 
                  code: ticket.code, 
                  batchId: ticket.batch.id,
                  orderId: ticket.order?.id 
              };
              ticket.signedToken = this.jwtService.sign(payload);
              await this.ticketsRepo.save(ticket);
          }

          if (ticket.signedToken) {
              qrCode = await this.notificationsService.generateQRCode(ticket.signedToken);
          }
          ticketsWithQr.push({ ...ticket, qrCode });
      }

      return ticketsWithQr;
  }

  @Get('validate/:token')
  @UseGuards(AuthGuard('jwt'))
  async validateTicket(@Param('token') token: string, @Request() req: any) {
    try {
      // 1. Verify Signature
      const decoded = this.jwtService.verify(token); // Throws if invalid

      // 2. Helper check: Does ticket exist in DB?
      const ticket = await this.ticketsRepo.findOne({ 
          where: { id: decoded.sub },
          relations: ['batch', 'batch.event', 'batch.event.producer', 'order', 'order.user']
      });

      if (!ticket) {
          throw new UnauthorizedException('Ticket not found in system');
      }

      // 3. Authorization Check: Does the producer own this event?
      // Assuming admins can scan any.
      if (req.user.role !== 'admin') {
          const eventProducerId = ticket.batch.event.producer?.id;
          if (eventProducerId !== req.user.id) {
               throw new UnauthorizedException('You are not authorized to scan tickets for this event.');
          }
      }

      if (ticket.isUsed) {
          return { valid: false, message: 'Ticket already used', data: ticket };
      }

      return { 
          valid: true, 
          message: 'Valid Ticket', 
          data: {
              code: ticket.code,
              tier: ticket.batch.name,
              event: ticket.batch.event?.title || 'Unknown Event', 
              holder: ticket.order?.customerName
          }
      };

    } catch (e) {
      if (e instanceof UnauthorizedException) {
          return { valid: false, message: e.message };
      }
      return { valid: false, message: 'Invalid Token', error: e.message };
    }
  }
}
