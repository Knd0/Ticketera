import {
    Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, ConflictException,
    Logger, OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThan } from 'typeorm';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { OrderItem } from './order-item.entity';
import { Batch } from '../events/batch.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';
import { PaymentInfo, PaymentProvider } from './payments/payment.provider';
import { JwtService } from '@nestjs/jwt';
import { PromoCode } from './promo-code.entity';
import { Seat } from '../events/seat.entity';

/** Cargo por servicio sobre el subtotal (configurable con SERVICE_FEE_PERCENT, 15 % por defecto). */
export function serviceFeeRate(): number {
    const pct = Number(process.env.SERVICE_FEE_PERCENT ?? 15);
    return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct / 100 : 0.15;
}
export const CASH_PAYMENT_METHOD = 'Cash / Bank Transfer';
export const MERCADOPAGO_METHOD = 'MercadoPago';
export const MAX_TICKETS_PER_ITEM = 50;
/** Minutos que tiene el comprador para pagar en Mercado Pago. */
export const PAYMENT_WINDOW_MINUTES = 30;
/** Margen extra antes de liberar las entradas de una orden sin pagar. */
const EXPIRY_GRACE_MINUTES = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Valida el carrito antes de tocar stock: cantidades enteras y positivas. */
export function assertValidOrderItems(items: unknown): asserts items is { batchId: string; quantity: number; seats?: string }[] {
    if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestException('La orden no tiene entradas.');
    }
    for (const item of items as any[]) {
        if (!item || typeof item.batchId !== 'string' || item.batchId.length === 0) {
            throw new BadRequestException('Falta el lote de una de las entradas.');
        }
        // Una cantidad negativa "devolvía" stock y restaba del total a cobrar.
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_TICKETS_PER_ITEM) {
            throw new BadRequestException(`La cantidad debe ser un número entero entre 1 y ${MAX_TICKETS_PER_ITEM}.`);
        }
    }
}

function parseSeatIds(raw: unknown): string[] {
    if (!raw) return [];
    try {
        const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(list)) throw new Error();
        return list.map((s: any) => (typeof s === 'string' ? s : s?.id)).filter((id: any) => typeof id === 'string');
    } catch {
        throw new BadRequestException('La selección de butacas no es válida.');
    }
}

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OrdersService.name);
    private expiryTimer?: NodeJS.Timeout;

    constructor(
        @InjectRepository(Order) private ordersRepo: Repository<Order>,
        @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
        @InjectRepository(Batch) private batchesRepo: Repository<Batch>,
        @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
        @InjectRepository(PromoCode) private promoRepo: Repository<PromoCode>,
        @InjectRepository(Seat) private seatRepo: Repository<Seat>,
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
        @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
        private jwtService: JwtService,
    ) { }

    onModuleInit() {
        if (process.env.NODE_ENV === 'test') return;
        // Libera cada 5 minutos las entradas de órdenes que no se pagaron a tiempo.
        this.expiryTimer = setInterval(() => {
            this.expireUnpaidOrders().catch(err => this.logger.error('Falló la expiración de órdenes', err));
        }, 5 * 60 * 1000);
        this.expiryTimer.unref?.();
    }

    onModuleDestroy() {
        if (this.expiryTimer) clearInterval(this.expiryTimer);
    }

    async validatePromoCode(code: string): Promise<PromoCode> {
        const promo = await this.promoRepo.findOne({ where: { code } });
        if (!promo || !promo.isActive) throw new BadRequestException('El código de descuento no existe o no está activo.');
        if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new BadRequestException('El código de descuento ya se usó todas las veces permitidas.');
        if (promo.validUntil && new Date() > promo.validUntil) throw new BadRequestException('El código de descuento venció.');
        return promo;
    }

    async createOrder(data: { items: { batchId: string; quantity: number; seats?: string }[]; user?: any; customerInfo?: any; promoCode?: string; paymentMethod?: string }) {
        const { items, user, customerInfo, paymentMethod } = data;
        assertValidOrderItems(items);

        const isCash = paymentMethod === CASH_PAYMENT_METHOD;
        const isMercadoPago = paymentMethod === MERCADOPAGO_METHOD;
        if (!isCash && !isMercadoPago) {
            throw new BadRequestException('Elegí un medio de pago.');
        }
        if (isMercadoPago && !this.paymentProvider.isConfigured()) {
            throw new BadRequestException('El pago con Mercado Pago todavía no está disponible. Elegí efectivo o transferencia.');
        }

        const customer = {
            name: String(customerInfo?.name || user?.fullName || '').trim(),
            email: String(customerInfo?.email || user?.email || '').trim().toLowerCase(),
            phone: String(customerInfo?.phone || '').trim(),
            docId: String(customerInfo?.docId || '').trim(),
        };
        if (!customer.name) throw new BadRequestException('Falta el nombre de quien compra.');
        if (!EMAIL_PATTERN.test(customer.email)) throw new BadRequestException('Falta un email válido: ahí llegan las entradas.');

        const eventTitle = await this.assertSameOpenEvent(items, paymentMethod!);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let totalAmount = 0;
            const orderItems: OrderItem[] = [];
            const ticketsToCreate: { batchId: string; seatRow?: string; seatNumber?: string }[] = [];

            for (const item of items) {
                // Bloquea el lote para que dos compras simultáneas no vendan la misma entrada.
                const batch = await queryRunner.manager.findOne(Batch, {
                    where: { id: item.batchId },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!batch) throw new NotFoundException('Uno de los lotes ya no existe.');
                if (batch.isManualSoldOut) {
                    throw new ConflictException(`El lote "${batch.name}" está agotado.`);
                }
                if (batch.salesEndDate && new Date() > batch.salesEndDate) {
                    throw new ConflictException(`La venta del lote "${batch.name}" ya cerró.`);
                }
                if (batch.totalQuantity - batch.soldQuantity < item.quantity) {
                    const left = Math.max(0, batch.totalQuantity - batch.soldQuantity);
                    throw new ConflictException(`SoldOutException: quedan ${left} entradas en "${batch.name}".`);
                }

                batch.soldQuantity += item.quantity;
                await queryRunner.manager.save(batch);

                const price = Number(batch.price);
                totalAmount += price * item.quantity;
                orderItems.push(this.orderItemsRepo.create({ batch, quantity: item.quantity, price }));

                const seatIds = parseSeatIds(item.seats);
                if (batch.hasSeating || seatIds.length > 0) {
                    if (seatIds.length !== item.quantity) {
                        throw new BadRequestException(`Elegí ${item.quantity} butaca(s) en "${batch.name}".`);
                    }
                    for (const seatId of seatIds) {
                        const seat = await queryRunner.manager.findOne(Seat, {
                            where: { id: seatId, batch: { id: batch.id } },
                            lock: { mode: 'pessimistic_write' }
                        });
                        if (!seat) throw new NotFoundException('Una de las butacas no existe en este lote.');
                        if (seat.status !== 'AVAILABLE') throw new ConflictException(`La butaca ${seat.row}-${seat.number} ya está ocupada.`);
                        seat.status = 'SOLD';
                        await queryRunner.manager.save(seat);
                        ticketsToCreate.push({ batchId: batch.id, seatRow: seat.row, seatNumber: seat.number });
                    }
                } else {
                    for (let i = 0; i < item.quantity; i++) ticketsToCreate.push({ batchId: batch.id });
                }
            }

            // El descuento se aplica sobre el precio de las entradas, no sobre el cargo por servicio.
            let discount = 0;
            if (data.promoCode) {
                const promo = await queryRunner.manager.findOne(PromoCode, {
                    where: { code: data.promoCode },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!promo || !promo.isActive) throw new BadRequestException('El código de descuento no existe o no está activo.');
                if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new BadRequestException('El código de descuento ya se usó todas las veces permitidas.');
                if (promo.validUntil && new Date() > promo.validUntil) throw new BadRequestException('El código de descuento venció.');

                discount = totalAmount * (promo.discountPercentage / 100);
                promo.usedCount += 1;
                await queryRunner.manager.save(PromoCode, promo);
            }

            const serviceFee = totalAmount * serviceFeeRate();
            const finalTotal = round2((totalAmount - discount) + serviceFee);

            const order = this.ordersRepo.create({
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                customerDocId: customer.docId,
                totalAmount: finalTotal,
                status: isCash ? 'PENDING_APPROVAL' : 'PENDING',
                items: orderItems,
                user: user?.id ? { id: user.id } : undefined,
                paymentMethod,
            });
            const savedOrder = await queryRunner.manager.save(Order, order);

            // Las entradas se crean dentro de la misma transacción: si algo falla,
            // no quedan butacas vendidas sin entrada ni entradas sin orden.
            for (const t of ticketsToCreate) {
                await queryRunner.manager.save(Ticket, this.ticketsRepo.create({
                    code: uuidv4(),
                    order: { id: savedOrder.id } as Order,
                    batch: { id: t.batchId } as Batch,
                    seatRow: t.seatRow,
                    seatNumber: t.seatNumber,
                }));
            }

            await queryRunner.commitTransaction();

            let paymentLink = '';
            if (isMercadoPago) {
                const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000);
                try {
                    const checkout = await this.paymentProvider.createCheckout({
                        orderId: savedOrder.id,
                        title: `Entradas — ${eventTitle}`,
                        amount: finalTotal,
                        payerEmail: customer.email,
                        expiresAt,
                    });
                    paymentLink = checkout.url;
                } catch (err) {
                    // Sin link de pago la reserva no sirve: se liberan las entradas ya mismo.
                    await this.releaseOrder(savedOrder.id, 'EXPIRED');
                    throw err;
                }
            }

            return {
                order: { id: savedOrder.id, status: savedOrder.status, totalAmount: finalTotal, paymentMethod },
                tickets: [] as any[],
                paymentLink,
            };
        } catch (err) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw err;
        } finally {
            // Antes sólo se liberaba en el catch: cada orden exitosa dejaba tomada
            // una conexión del pool y, con ~10 ventas, la API dejaba de responder.
            if (!queryRunner.isReleased) await queryRunner.release();
        }
    }

    /**
     * Todas las entradas de una orden tienen que ser de un mismo evento, visible,
     * que no haya terminado y que acepte el medio de pago elegido.
     */
    private async assertSameOpenEvent(items: { batchId: string }[], paymentMethod: string): Promise<string> {
        const ids = [...new Set(items.map(i => i.batchId))];
        const batches = await this.batchesRepo.find({ where: { id: In(ids) }, relations: ['event'] });
        if (batches.length !== ids.length) throw new NotFoundException('Uno de los lotes ya no existe.');

        const eventIds = new Set(batches.map(b => b.event?.id));
        if (eventIds.size !== 1) throw new BadRequestException('Comprá las entradas de cada evento por separado.');

        const event = batches[0].event;
        if (!event?.isVisible) throw new BadRequestException('Este evento no está a la venta.');
        const end = event.endDate ?? event.date;
        if (end && new Date(end) < new Date()) throw new BadRequestException('Este evento ya terminó.');
        const methods = event.paymentMethods?.length ? event.paymentMethods : [CASH_PAYMENT_METHOD];
        if (!methods.includes(paymentMethod)) throw new BadRequestException('Este evento no acepta ese medio de pago.');
        return event.title;
    }

    /**
     * Procesa un pago de Mercado Pago (webhook o regreso del comprador). Siempre
     * consulta el pago a Mercado Pago: nunca confía en lo que dice la notificación.
     */
    async handlePaymentNotification(paymentId: string): Promise<{ orderId: string | null; status: string }> {
        const payment = await this.paymentProvider.getPayment(paymentId);
        const orderId = payment.externalReference;
        if (!orderId) return { orderId: null, status: 'ignored' };

        const order = await this.ordersRepo.findOne({ where: { id: orderId } });
        if (!order) return { orderId, status: 'ignored' };

        if (payment.status === 'approved') {
            if (!this.amountMatches(payment, order)) {
                this.logger.error(`Pago ${payment.id} de la orden ${order.id}: importe ${payment.amount} ${payment.currency}, esperado ${order.totalAmount} ARS. No se emiten entradas.`);
                return { orderId, status: 'amount_mismatch' };
            }
            if (order.status === 'PAID') return { orderId, status: 'PAID' };
            if (order.status === 'PENDING') {
                await this.confirmPayment(order.id, payment.id);
                return { orderId, status: 'PAID' };
            }
            // Pagó una orden que ya se había liberado: hay que devolverle la plata.
            this.logger.error(`ATENCIÓN: pago aprobado ${payment.id} para la orden ${order.id} en estado ${order.status}. Revisar y devolver desde Mercado Pago.`);
            return { orderId, status: order.status };
        }

        if ((payment.status === 'refunded' || payment.status === 'charged_back') && order.status === 'PAID') {
            await this.releaseOrder(order.id, 'REFUNDED');
            return { orderId, status: 'REFUNDED' };
        }

        // Rechazado o cancelado: el comprador puede reintentar desde Mercado Pago
        // mientras dure la ventana de pago; si no, la orden vence sola.
        return { orderId, status: order.status };
    }

    private amountMatches(payment: PaymentInfo, order: Order) {
        return payment.currency === 'ARS' && Math.abs(Number(payment.amount) - Number(order.totalAmount)) < 0.01;
    }

    /**
     * Estado público de una orden. El id es un UUID que sólo conoce quien compró
     * (llega en el link de regreso de Mercado Pago), y funciona como comprobante.
     * Si viene `paymentId` y la orden sigue pendiente, se consulta el pago: así la
     * compra se confirma aunque el webhook todavía no haya llegado.
     */
    async getPublicOrder(orderId: string, paymentId?: string) {
        let order = await this.ordersRepo.findOne({ where: { id: orderId }, relations: ['items', 'items.batch', 'items.batch.event'] });
        if (!order) throw new NotFoundException('La orden no existe.');

        if (paymentId && order.status === 'PENDING') {
            try {
                await this.handlePaymentNotification(paymentId);
            } catch (err) {
                this.logger.warn(`No se pudo consultar el pago ${paymentId}: ${(err as Error).message}`);
            }
            order = (await this.ordersRepo.findOne({ where: { id: orderId }, relations: ['items', 'items.batch', 'items.batch.event'] }))!;
        }

        const event = order.items?.[0]?.batch?.event;
        const tickets = order.status === 'PAID' ? await this.ticketsWithQr(order.id) : [];
        return {
            id: order.id,
            status: order.status,
            totalAmount: Number(order.totalAmount),
            paymentMethod: order.paymentMethod,
            customerName: order.customerName,
            event: event ? { id: event.id, title: event.title, date: event.date, location: event.location } : null,
            tickets,
        };
    }

    private async ticketsWithQr(orderId: string) {
        const tickets = await this.ticketsRepo.find({ where: { order: { id: orderId } }, relations: ['batch'] });
        const out: any[] = [];
        for (const t of tickets) {
            if (!t.signedToken) continue;
            out.push({
                code: t.code,
                batch: t.batch?.name,
                seat: t.seatRow ? `${t.seatRow}-${t.seatNumber}` : null,
                isUsed: t.isUsed,
                qrCode: await this.notificationsService.generateQRCode(t.signedToken),
            });
        }
        return out;
    }

    async confirmPayment(orderId: string, paymentId?: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['user', 'tickets'],
        });
        if (!order) throw new NotFoundException('La orden no existe.');
        if (order.status === 'PAID') return order;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let tickets: Ticket[] = [];
        try {
            order.status = 'PAID';
            if (paymentId) order.paymentId = paymentId;
            await queryRunner.manager.save(Order, order);

            tickets = await this.ticketsRepo.find({
                where: { order: { id: order.id } },
                relations: ['batch', 'batch.event', 'order']
            });

            for (const ticket of tickets) {
                ticket.signedToken = this.jwtService.sign({
                    sub: ticket.id,
                    code: ticket.code,
                    batchId: ticket.batch.id,
                    orderId: order.id
                });
                await queryRunner.manager.save(Ticket, ticket);
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }

        // Los avisos van DESPUÉS de confirmar: si el mail falla, la venta igual
        // queda aprobada y las entradas se ven en la página de la orden.
        try {
            if (order.customerEmail) {
                const withQr: { code: string; label: string; qrCode: string }[] = [];
                for (const t of tickets) {
                    withQr.push({
                        code: t.code,
                        label: [t.batch?.name, t.seatRow ? `Butaca ${t.seatRow}-${t.seatNumber}` : null].filter(Boolean).join(' · '),
                        qrCode: await this.notificationsService.generateQRCode(t.signedToken),
                    });
                }
                const event = tickets[0]?.batch?.event;
                await this.notificationsService.sendTicketsEmail({
                    to: order.customerEmail,
                    customerName: order.customerName,
                    orderId: order.id,
                    eventTitle: event?.title ?? 'tu evento',
                    eventDate: event?.date ?? null,
                    eventLocation: event?.location ?? null,
                    tickets: withQr,
                });
            }
        } catch (notifyErr) {
            this.logger.error(`No se pudo enviar el mail de la orden ${order.id}`, notifyErr as Error);
        }

        return order;
    }

    /**
     * Libera el stock de una orden (lotes y butacas) y la deja en `status`.
     * Para órdenes sin pagar borra las entradas; en un reintegro las conserva
     * como registro, pero dejan de ser válidas porque la orden ya no está PAID.
     */
    async releaseOrder(orderId: string, status: 'REJECTED' | 'EXPIRED' | 'REFUNDED') {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const order = await queryRunner.manager.findOne(Order, { where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
            if (!order) throw new NotFoundException('La orden no existe.');
            if (['REJECTED', 'EXPIRED', 'REFUNDED'].includes(order.status)) {
                await queryRunner.rollbackTransaction();
                return order;
            }

            const items = await queryRunner.manager.find(OrderItem, { where: { order: { id: orderId } }, relations: ['batch'] });
            for (const item of items) {
                const batch = await queryRunner.manager.findOne(Batch, { where: { id: item.batch.id }, lock: { mode: 'pessimistic_write' } });
                if (batch) {
                    batch.soldQuantity = Math.max(0, batch.soldQuantity - item.quantity);
                    await queryRunner.manager.save(Batch, batch);
                }
            }

            const tickets = await queryRunner.manager.find(Ticket, { where: { order: { id: orderId } }, relations: ['batch'] });
            for (const t of tickets) {
                if (t.seatRow && t.seatNumber) {
                    await queryRunner.manager.update(Seat,
                        { batch: { id: t.batch.id }, row: t.seatRow, number: t.seatNumber },
                        { status: 'AVAILABLE' });
                }
            }
            if (status !== 'REFUNDED') await queryRunner.manager.remove(Ticket, tickets);

            order.status = status;
            await queryRunner.manager.save(Order, order);
            await queryRunner.commitTransaction();
            return order;
        } catch (err) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            if (!queryRunner.isReleased) await queryRunner.release();
        }
    }

    /** Órdenes de Mercado Pago que no se pagaron en la ventana: devuelven sus entradas al stock. */
    async expireUnpaidOrders(now = new Date()): Promise<number> {
        const cutoff = new Date(now.getTime() - (PAYMENT_WINDOW_MINUTES + EXPIRY_GRACE_MINUTES) * 60_000);
        const stale = await this.ordersRepo.find({ where: { status: 'PENDING', createdAt: LessThan(cutoff) }, select: ['id'] });
        for (const o of stale) {
            await this.releaseOrder(o.id, 'EXPIRED');
        }
        if (stale.length) this.logger.log(`Se liberaron ${stale.length} órdenes sin pagar.`);
        return stale.length;
    }

    async getSalesAnalytics(userId: string) {
        // Sólo cuenta lo cobrado: antes sumaba también reservas en efectivo sin aprobar.
        const salesByEvent = await this.orderItemsRepo.createQueryBuilder('item')
            .innerJoin('item.batch', 'batch')
            .innerJoin('batch.event', 'event')
            .innerJoin('item.order', 'order')
            .where('event.producerId = :userId', { userId })
            .andWhere('order.status = :status', { status: 'PAID' })
            .select('event.title', 'title')
            .addSelect('SUM(item.price * item.quantity)', 'revenue')
            .addSelect('SUM(item.quantity)', 'tickets')
            .groupBy('event.id')
            .addGroupBy('event.title')
            .getRawMany();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyStats = await this.orderItemsRepo.createQueryBuilder('item')
            .innerJoin('item.batch', 'batch')
            .innerJoin('batch.event', 'event')
            .innerJoin('item.order', 'order')
            .where('event.producerId = :userId', { userId })
            .andWhere('order.createdAt >= :date', { date: thirtyDaysAgo })
            .andWhere('order.status = :status', { status: 'PAID' })
            .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", 'date')
            .addSelect('SUM(item.price * item.quantity)', 'revenue')
            .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
            .orderBy('date', 'ASC')
            .getRawMany();

        return {
            salesByEvent: salesByEvent.map(r => ({ title: r.title, revenue: Number(r.revenue), tickets: Number(r.tickets) })),
            dailyStats,
        };
    }

    async getPendingOrders(producerId: string) {
        return this.ordersRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'item')
            .leftJoinAndSelect('item.batch', 'batch')
            .leftJoinAndSelect('batch.event', 'event')
            .where('event.producerId = :producerId', { producerId })
            .andWhere('order.status = :status', { status: 'PENDING_APPROVAL' })
            .orderBy('order.createdAt', 'DESC')
            .getMany();
    }

    private async assertProducerOwnsOrder(orderId: string, producerId: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.batch', 'items.batch.event', 'items.batch.event.producer']
        });
        if (!order) throw new NotFoundException('La orden no existe.');
        const isOwner = order.items.some(i => i.batch?.event?.producer?.id === producerId);
        if (!isOwner) throw new ForbiddenException('Esta orden no es de uno de tus eventos.');
        if (order.status !== 'PENDING_APPROVAL') {
            throw new BadRequestException('Esta orden ya fue procesada.');
        }
        return order;
    }

    async approveOrder(orderId: string, producerId: string) {
        await this.assertProducerOwnsOrder(orderId, producerId);
        return this.confirmPayment(orderId);
    }

    async rejectOrder(orderId: string, producerId: string) {
        await this.assertProducerOwnsOrder(orderId, producerId);
        await this.releaseOrder(orderId, 'REJECTED');
        return { message: 'Reserva rechazada: las entradas volvieron a la venta.' };
    }

    async getEventReservations(eventId: string, producerId: string) {
        return this.ordersRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'item')
            .leftJoinAndSelect('item.batch', 'batch')
            .leftJoinAndSelect('batch.event', 'event')
            .where('event.id = :eventId', { eventId })
            .andWhere('event.producerId = :producerId', { producerId })
            .andWhere('order.status = :status', { status: 'PENDING_APPROVAL' })
            .orderBy('order.createdAt', 'DESC')
            .getMany();
    }
}

