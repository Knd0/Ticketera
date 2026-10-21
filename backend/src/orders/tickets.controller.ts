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
    ) { }

    @Get('my')
    @UseGuards(AuthGuard('jwt'))
    async getMyTickets(@Request() req: any) {
        // Si el token no trae email, `{ customerEmail: undefined }` no filtra
        // nada en TypeORM y devolvería las entradas de todos los clientes.
        const where: any[] = [{ order: { user: { id: req.user.id } } }];
        if (req.user.email) where.push({ order: { customerEmail: req.user.email } });
        const tickets = await this.ticketsRepo.find({
            where,
            relations: ['batch', 'batch.event', 'order'],
            order: { id: 'DESC' }
        });

        // Generate QR codes for display
        const ticketsWithQr: any[] = [];
        for (const ticket of tickets) {
            let qrCode = '';

            // Lazy generation for old/seeded tickets - ONLY IF PAID
            if (!ticket.signedToken && ticket.order?.status === 'PAID') {
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

            // Una entrada sólo entra si su orden está pagada (o aprobada por el
            // productor, que también la deja en PAID).
            if (ticket.order?.status !== 'PAID') {
                return { valid: false, message: 'Order not paid', data: { status: ticket.order?.status } };
            }

            // Marca la entrada como usada en el mismo paso que la valida. Antes
            // nadie ponía `isUsed = true`: el mismo QR (o una captura de
            // pantalla) entraba todas las veces que se escaneara. El UPDATE
            // condicional evita que dos escaneos simultáneos pasen los dos.
            const result = await this.ticketsRepo.update({ id: ticket.id, isUsed: false }, { isUsed: true });
            if (!result.affected) {
                // Sin `data: ticket`: incluía order.user con el hash de la contraseña del comprador.
                return {
                    valid: false,
                    message: 'Ticket already used',
                    data: { code: ticket.code, holder: ticket.order?.customerName },
                };
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
