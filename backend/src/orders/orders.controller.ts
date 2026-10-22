import { Inject, Controller, Post, Get, Body, UseGuards, Request, Param, Query, Headers, HttpCode, UnauthorizedException, ParseUUIDPipe, Logger } from '@nestjs/common';
import { OrdersService, serviceFeeRate, PAYMENT_WINDOW_MINUTES } from './orders.service';
import type { PaymentProvider } from './payments/payment.provider';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard, ProducerGuard } from '../common/guards';


@Controller('orders')
export class OrdersController {
    private readonly logger = new Logger(OrdersController.name);

    constructor(
        private readonly ordersService: OrdersService,
        @Inject('PaymentProvider') private readonly paymentProvider: PaymentProvider,
    ) { }

    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    @Post()
    @UseGuards(OptionalJwtAuthGuard)
    create(@Body() body: any, @Request() req: any) {
        // Sólo se toman los campos del carrito: el comprador no puede fijar
        // estado, montos ni a qué usuario queda asociada la orden.
        return this.ordersService.createOrder({
            items: body?.items,
            customerInfo: body?.customerInfo,
            promoCode: body?.promoCode,
            paymentMethod: body?.paymentMethod,
            user: req.user,
        });
    }

    /**
     * Notificaciones de Mercado Pago (webhooks e IPN). Se verifica la firma si
     * hay MP_WEBHOOK_SECRET y, en todos los casos, el pago se consulta a
     * Mercado Pago antes de emitir entradas. Responde 200 para que MP no reintente
     * notificaciones que no nos interesan.
     */
    @Post('webhook/mercadopago')
    @HttpCode(200)
    async handleWebhook(@Body() body: any, @Query() query: any, @Headers() headers: Record<string, any>) {
        const type = query?.type || query?.topic || body?.type || body?.topic;
        const dataId = String(query?.['data.id'] || body?.data?.id || query?.id || '');
        if (type !== 'payment' || !dataId) return { received: true };

        if (!this.paymentProvider.verifyWebhookSignature(headers, dataId)) {
            throw new UnauthorizedException('Firma inválida.');
        }
        try {
            const result = await this.ordersService.handlePaymentNotification(dataId);
            return { received: true, ...result };
        } catch (err) {
            // 500 → Mercado Pago reintenta más tarde.
            this.logger.error(`Webhook de Mercado Pago (pago ${dataId}) falló`, err as Error);
            throw err;
        }
    }

    /** Lo que el checkout necesita saber para mostrar precios y medios de pago. */
    @Get('config')
    getConfig() {
        return {
            serviceFeePercent: Math.round(serviceFeeRate() * 10000) / 100,
            mercadoPago: this.paymentProvider.isConfigured(),
            paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
        };
    }

    /** Estado de una orden para la página de resultado del pago. */
    @Get(':id/estado')
    getPublicOrder(@Param('id', ParseUUIDPipe) id: string, @Query('payment_id') paymentId?: string) {
        return this.ordersService.getPublicOrder(id, paymentId || undefined);
    }

    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @Post('validate-promo')
    async validatePromo(@Body('code') code: string) {
        const promo = await this.ordersService.validatePromoCode(String(code ?? '').trim());
        return { valid: true, discountPercentage: promo.discountPercentage, code: promo.code };
    }

    @Post('analytics')
    @UseGuards(AuthGuard('jwt'), ProducerGuard)
    async getAnalytics(@Request() req: any) {
        return this.ordersService.getSalesAnalytics(req.user.id);
    }

    @Post('pending')
    @UseGuards(AuthGuard('jwt'), ProducerGuard)
    async getPending(@Request() req: any) {
        return this.ordersService.getPendingOrders(req.user.id);
    }

    @Post('event/:id/pending')
    @UseGuards(AuthGuard('jwt'), ProducerGuard)
    async getEventPending(@Request() req: any, @Param('id', ParseUUIDPipe) eventId: string) {
        return this.ordersService.getEventReservations(eventId, req.user.id);
    }

    @Post(':id/approve')
    @UseGuards(AuthGuard('jwt'), ProducerGuard)
    async approve(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.ordersService.approveOrder(id, req.user.id);
    }

    @Post(':id/reject')
    @UseGuards(AuthGuard('jwt'), ProducerGuard)
    async reject(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.ordersService.rejectOrder(id, req.user.id);
    }
}
