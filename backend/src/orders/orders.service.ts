import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm'; // DataSource for transactions
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { OrderItem } from './order-item.entity';
import { Batch } from '../events/batch.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

import { PaymentProvider } from './payments/payment.provider';

import { JwtService } from '@nestjs/jwt';

import { PromoCode } from './promo-code.entity';
import { Seat } from '../events/seat.entity';

@Injectable()
export class OrdersService {
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

    async validatePromoCode(code: string): Promise<PromoCode> {
        const promo = await this.promoRepo.findOne({ where: { code } });
        if (!promo || !promo.isActive) throw new Error('Invalid or inactive promo code');
        if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new Error('Promo code limit reached');
        if (promo.validUntil && new Date() > promo.validUntil) throw new Error('Promo code expired');
        return promo;
    }

    async createOrder(data: { items: { batchId: string; quantity: number; seats?: string }[]; user?: any; customerInfo?: any; promoCode?: string; paymentMethod?: string }) {
        // ... existing logic ...
        // After creating order (at the end of try block), generate link

        const { items, user, customerInfo, paymentMethod } = data;
        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let totalAmount = 0;
            const orderItems: OrderItem[] = [];
            const ticketsToCreate: any[] = []; // Temporary holding for ticket data

            // 1. Validate & Deduct Stock
            for (const item of items) {
                // Lock the batch row for update to prevent race conditions
                const batch = await queryRunner.manager.findOne(Batch, {
                    where: { id: item.batchId },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!batch) throw new NotFoundException(`Batch ${item.batchId} not found`);

                // Validation: Sold Out & Sales End Date
                if (batch.isManualSoldOut) {
                    throw new BadRequestException(`Batch ${batch.name} is currently sold out (Manual)`);
                }
                if (batch.salesEndDate && new Date() > batch.salesEndDate) {
                    throw new BadRequestException(`Sales for batch ${batch.name} have ended`);
                }

                if (batch.totalQuantity - batch.soldQuantity < item.quantity) {
                    throw new Error(`SoldOutException: Not enough tickets for batch ${batch.name}`);
                }

                batch.soldQuantity += item.quantity;
                await queryRunner.manager.save(batch);

                const price = Number(batch.price);
                totalAmount += price * item.quantity;

                // Create Order Item
                const orderItem = this.orderItemsRepo.create({
                    batch: batch,
                    quantity: item.quantity,
                    price: price
                });
                orderItems.push(orderItem);

                if ((item as any).seats && (item as any).seats.length > 0) {
                    // Handle Seated Tickets
                    const rawSeats = JSON.parse((item as any).seats);
                    const seatIds: string[] = rawSeats.map((s: any) => s.id);

                    if (seatIds.length !== item.quantity) {
                        throw new BadRequestException(`Mismatch between quantity (${item.quantity}) and selected seats (${seatIds.length})`);
                    }

                    for (const seatId of seatIds) {
                        const seat = await queryRunner.manager.findOne(Seat, {
                            where: { id: seatId },
                            lock: { mode: 'pessimistic_write' }
                        });

                        if (!seat) throw new NotFoundException(`Seat not found`);
                        if (seat.status !== 'AVAILABLE') throw new BadRequestException(`Seat ${seat.row}-${seat.number} is already taken`);

                        seat.status = 'SOLD';
                        await queryRunner.manager.save(seat);

                        ticketsToCreate.push({ batchId: batch.id, seatId: seat.id, seatRow: seat.row, seatNumber: seat.number });
                    }

                } else {
                    // General Admission
                    for (let i = 0; i < item.quantity; i++) {
                        ticketsToCreate.push({ batchId: batch.id });
                    }
                }
            }

            // Apply Promo Code (on Subtotal)
            let discount = 0;
            if (data.promoCode) {
                const promo = await queryRunner.manager.findOne(PromoCode, {
                    where: { code: data.promoCode },
                    lock: { mode: 'pessimistic_write' }
                });

                if (!promo || !promo.isActive) throw new Error('Invalid promo code');
                if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new Error('Promo code limit reached');

                discount = totalAmount * (promo.discountPercentage / 100);

                promo.usedCount += 1;
                await queryRunner.manager.save(PromoCode, promo);
            }

            const serviceFee = totalAmount * 0.15; // 15% Service Fee
            const finalTotal = (totalAmount - discount) + serviceFee;

            // Determine Status based on Payment Method
            const initialStatus = (paymentMethod === 'Cash / Bank Transfer') ? 'PENDING_APPROVAL' : 'PENDING';

            // 2. Create Order
            const order = this.ordersRepo.create({
                customerName: customerInfo?.name || user?.fullName || user?.username || 'Guest',
                customerEmail: customerInfo?.email || user?.email || 'guest@example.com',
                customerPhone: customerInfo?.phone || '',
                customerDocId: customerInfo?.docId || '',
                totalAmount: finalTotal,
                status: initialStatus,
                items: orderItems, // Cascade should handle this if configured, else save manually
                user: user,
                paymentId: paymentMethod // Store method name for reference
            });

            const savedOrder = await queryRunner.manager.save(Order, order);

            // 3. Commit Transaction
            await queryRunner.commitTransaction();

            // 4. Post-Transaction: Generate Tickets
            const savedTickets: Ticket[] = [];
            for (const t of ticketsToCreate) {
                const tick = this.ticketsRepo.create({
                    code: uuidv4(),
                    order: savedOrder,
                    batch: { id: t.batchId } as Batch,
                    seatRow: t.seatRow,
                    seatNumber: t.seatNumber
                });
                savedTickets.push(await this.ticketsRepo.save(tick));
            }

            // Logic branch based on status
            const ticketsWithQr: any[] = [];
            let paymentLink = '';

            if (initialStatus === 'PENDING') {
                // MERCADO PAGO FLOW
                const paymentInfo = await this.paymentProvider.generatePaymentLink(savedOrder);

                // Update Order with real paymentId
                savedOrder.paymentId = paymentInfo.paymentId;
                await this.ordersRepo.save(savedOrder); // Update outside transaction

                paymentLink = paymentInfo.url;

                // For immediate display (Demo/Mock flow), generate QR codes now
                for (const t of savedTickets) {
                    const payload = {
                        sub: t.id,
                        code: t.code,
                        batchId: t.batch.id,
                        orderId: savedOrder.id
                    };
                    const token = this.jwtService.sign(payload);
                    t.signedToken = token;
                    await this.ticketsRepo.save(t);

                    const qrCode = await this.notificationsService.generateQRCode(token);
                    ticketsWithQr.push({ ...t, qrCode });
                }
            } else {
                // PENDING_APPROVAL FLOW
                // Do NOT generate QR or signed token yet.
            }

            return { order: savedOrder, tickets: ticketsWithQr, paymentLink: paymentLink };

        } catch (err) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            await queryRunner.release();
            throw err;
        }
    }

    async confirmPayment(orderId: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['user', 'tickets'], // Ensure relations are loaded
        });
        if (!order) throw new Error('Order not found');

        if (order.status === 'PAID') return order;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            order.status = 'PAID';
            await queryRunner.manager.save(Order, order);

            // Generate Tickets (if not already generated) or Update them with Signed Token
            // In createOrder we generated tickets but without signedToken.
            // Let's fetch them
            const tickets = await this.ticketsRepo.find({
                where: { order: { id: order.id } },
                relations: ['batch', 'order']
            });

            for (const ticket of tickets) {
                // Generate Signed Token
                const payload = {
                    sub: ticket.id,
                    code: ticket.code,
                    batchId: ticket.batch.id,
                    orderId: order.id
                };
                const token = this.jwtService.sign(payload);
                ticket.signedToken = token;

                await queryRunner.manager.save(Ticket, ticket);

                // Generate QR (Data URL)
                const qrCode = await this.notificationsService.generateQRCode(token);

                // Send Notifications
                const email = order.customerEmail || 'no-email@test.com';
                await this.notificationsService.sendTicketEmail(email, ticket.code, qrCode);

                if (order.customerPhone) {
                    await this.notificationsService.sendTicketWhatsApp(
                        order.customerPhone,
                        ticket.batch.name || 'Event',
                        qrCode
                    );
                }
            }

            await queryRunner.commitTransaction();
            return order;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
    async getSalesAnalytics(userId: string) {
        // 1. Total Stats (Revenue, Tickets)
        // We assume 'userId' is the PRODUCER. We need to find events owned by this user.
        // However, orders are linked to batches -> events.
        // Let's filter by events where producer.id = userId.

        const events = await this.dataSource.getRepository('Event').find({
            where: { producer: { id: userId } },
            relations: ['batches']
        });

        // Manual aggregation (simpler for now than complex QB with relations)
        // For large scale, use QB. 

        // A. Revenue per Event
        const salesByEvent = events.map((event: any) => {
            let revenue = 0;
            let tickets = 0;
            event.batches.forEach((b: any) => {
                revenue += Number(b.price) * b.soldQuantity;
                tickets += b.soldQuantity;
            });
            return { title: event.title, revenue, tickets };
        });

        // B. Daily Sales (Last 30 Days)
        // This requires querying Orders directly.
        // Query: Orders -> Items -> Batch -> Event -> Producer (userId)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const data = await this.ordersRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'item')
            .leftJoinAndSelect('item.batch', 'batch')
            .leftJoinAndSelect('batch.event', 'event')
            .where('event.producerId = :userId', { userId }) // Assuming relation ID column
            .andWhere('order.createdAt >= :date', { date: thirtyDaysAgo })
            .andWhere('order.status = :status', { status: 'PAID' }) // Only paid
            .select("DATE(order.createdAt)", "date")
            .addSelect("SUM(order.totalAmount)", "dailyRevenue") // Note: Order total might include multiple events? 
            // Taking Order Total is risky if mixed cart. 
            // Better: SUM(item.price * item.quantity)
            .groupBy("DATE(order.createdAt)")
            .orderBy("date", "ASC")
            .getRawMany();

        // Refined Daily Query using Items summation for accuracy
        const dailyStats = await this.orderItemsRepo.createQueryBuilder('item')
            .leftJoin('item.batch', 'batch')
            .leftJoin('batch.event', 'event')
            .leftJoin('item.order', 'order')
            .where('event.producerId = :userId', { userId })
            .andWhere('order.createdAt >= :date', { date: thirtyDaysAgo })
            .andWhere('order.status = :status', { status: 'PAID' })
            .select("TO_CHAR(order.createdAt, 'YYYY-MM-DD')", "date") // Postgres specific
            .addSelect("SUM(item.price * item.quantity)", "revenue")
            .groupBy("TO_CHAR(order.createdAt, 'YYYY-MM-DD')")
            .orderBy("date", "ASC")
            .getRawMany();

        return {
            salesByEvent,
            dailyStats // { date: '2023-01-01', revenue: '100.00' }
        };
    }

    async getPendingOrders(producerId: string) {
        return this.ordersRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'item')
            .leftJoinAndSelect('item.batch', 'batch')
            .leftJoinAndSelect('batch.event', 'event')
            .leftJoinAndSelect('order.user', 'buyer')
            .where('event.producerId = :producerId', { producerId })
            .andWhere('order.status = :status', { status: 'PENDING_APPROVAL' })
            .orderBy('order.createdAt', 'DESC')
            .getMany();
    }

    async approveOrder(orderId: string, producerId: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.batch', 'items.batch.event', 'items.batch.event.producer']
        });

        if (!order) throw new NotFoundException('Order not found');

        const isOwner = order.items.some(i => i.batch.event.producer.id === producerId);
        if (!isOwner) throw new BadRequestException('You do not have permission to approve this order');

        if (order.status !== 'PENDING_APPROVAL') throw new BadRequestException(`Order status is ${order.status}, cannot approve`);

        return this.confirmPayment(orderId);
    }

    async rejectOrder(orderId: string, producerId: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'items.batch', 'items.batch.event', 'items.batch.event.producer']
        });

        if (!order) throw new NotFoundException('Order not found');

        const isOwner = order.items.some(i => i.batch.event.producer.id === producerId);
        if (!isOwner) throw new BadRequestException('You do not have permission to reject this order');

        if (order.status !== 'PENDING_APPROVAL') throw new BadRequestException(`Order status is ${order.status}, cannot reject`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            order.status = 'REJECTED';
            await queryRunner.manager.save(Order, order);

            for (const item of order.items) {
                const batch = await queryRunner.manager.findOne(Batch, { where: { id: item.batch.id }, lock: { mode: 'pessimistic_write' } });
                if (batch) {
                    batch.soldQuantity -= item.quantity;
                    if (batch.soldQuantity < 0) batch.soldQuantity = 0;
                    await queryRunner.manager.save(Batch, batch);
                }

                const tickets = await this.ticketsRepo.find({ where: { order: { id: order.id } }, relations: ['batch'] });
                for (const t of tickets) {
                    if (t.seatRow && t.seatNumber) {
                        const seat = await this.seatRepo.findOne({
                            where: {
                                batch: { id: t.batch.id },
                                row: t.seatRow,
                                number: t.seatNumber
                            }
                        });
                        if (seat) {
                            seat.status = 'AVAILABLE';
                            await queryRunner.manager.save(Seat, seat);
                        }
                    }
                    await queryRunner.manager.remove(Ticket, t);
                }
            }

            await queryRunner.commitTransaction();
            return { message: 'Order rejected and stock restored' };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async getEventReservations(eventId: string, producerId: string) {
        return this.ordersRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'item')
            .leftJoinAndSelect('item.batch', 'batch')
            .leftJoinAndSelect('batch.event', 'event')
            .leftJoinAndSelect('order.user', 'buyer')
            .where('event.id = :eventId', { eventId })
            .andWhere('event.producerId = :producerId', { producerId })
            .andWhere('order.status = :status', { status: 'PENDING_APPROVAL' })
            .orderBy('order.createdAt', 'DESC')
            .getMany();
    }
}
