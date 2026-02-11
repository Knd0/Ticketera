import { Controller, Post, Body, UseGuards, Request, Param, Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err, user, info) {
        // No error if no user
        return user;
    }
}

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    @UseGuards(OptionalJwtAuthGuard)
    create(@Body() createOrderDto: any, @Request() req: any) {
        if (req.user) {
            createOrderDto.user = req.user;
        }
        return this.ordersService.createOrder(createOrderDto);
    }

    @Post('webhook/mercadopago')
    async handleWebhook(@Body() body: any) {
        console.log('Received Webhook:', body);
        // Mock logic: assume body has { id: orderId, status: 'approved' }
        // In real scenario, verify signature and fetch payment details
        if (body.status === 'approved' && body.id) {
            await this.ordersService.confirmPayment(body.id);
        }
        return { received: true };
    }

    @Post('validate-promo')
    async validatePromo(@Body('code') code: string) {
        const promo = await this.ordersService.validatePromoCode(code);
        return {
            valid: true,
            discountPercentage: promo.discountPercentage,
            code: promo.code
        };
    }

    @Post('analytics') // Using POST or GET with User decorator
    @UseGuards(AuthGuard('jwt'))
    async getAnalytics(@Request() req: any) {
        // req.user.id is the producer
        return this.ordersService.getSalesAnalytics(req.user.id);
    }

    @Post('pending')
    @UseGuards(AuthGuard('jwt'))
    async getPending(@Request() req: any) {
        return this.ordersService.getPendingOrders(req.user.id);
    }

    @Post('event/:id/pending')
    @UseGuards(AuthGuard('jwt'))
    async getEventPending(@Request() req: any, @Param('id') eventId: string) {
        return this.ordersService.getEventReservations(eventId, req.user.id);
    }

    @Post(':id/approve')
    @UseGuards(AuthGuard('jwt'))
    async approve(@Request() req: any, @Param('id') id: string) {
        return this.ordersService.approveOrder(id, req.user.id);
    }

    @Post(':id/reject')
    @UseGuards(AuthGuard('jwt'))
    async reject(@Request() req: any, @Param('id') id: string) {
        return this.ordersService.rejectOrder(id, req.user.id);
    }
}
