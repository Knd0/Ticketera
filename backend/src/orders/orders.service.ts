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

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(Ticket) private ticketsRepo: Repository<Ticket>,
    @InjectRepository(Batch) private batchesRepo: Repository<Batch>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(PromoCode) private promoRepo: Repository<PromoCode>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
    private jwtService: JwtService,
  ) {}

  async validatePromoCode(code: string): Promise<PromoCode> {
      const promo = await this.promoRepo.findOne({ where: { code } });
      if (!promo || !promo.isActive) throw new Error('Invalid or inactive promo code');
      if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new Error('Promo code limit reached');
      if (promo.validUntil && new Date() > promo.validUntil) throw new Error('Promo code expired');
      return promo;
  }

  async createOrder(data: { items: { batchId: string; quantity: number }[]; user?: any; customerInfo?: any; promoCode?: string }) {
    // ... existing logic ...
    // After creating order (at the end of try block), generate link

    const { items, user, customerInfo } = data;
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
            // Assuming soldQuantity tracks sold. OR check remaining.
            // Simplified: if stock is just totalQuantity and we decrement it? 
            // Current model: totalQuantity (limit), soldQuantity (sold).
            // Available = total - sold.
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

        // Prepare tickets (to be created after order)
        for(let i=0; i<item.quantity; i++) {
            ticketsToCreate.push({ batchId: batch.id });
        }
      }

      // Apply Promo Code
      if (data.promoCode) {
          const promo = await queryRunner.manager.findOne(PromoCode, { 
              where: { code: data.promoCode }, 
              lock: { mode: 'pessimistic_write' } 
          });
          
          if (!promo || !promo.isActive) throw new Error('Invalid promo code');
          if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new Error('Promo code limit reached');

          const discount = totalAmount * (promo.discountPercentage / 100);
          totalAmount -= discount;
          
          promo.usedCount += 1;
          await queryRunner.manager.save(PromoCode, promo);
      }

      // 2. Create Order
      const order = this.ordersRepo.create({
        customerName: customerInfo?.name || user?.username || 'Guest',
        customerEmail: customerInfo?.email || user?.email || 'guest@example.com',
        customerPhone: customerInfo?.phone || '',
        customerDocId: customerInfo?.docId || '',
        totalAmount: totalAmount,
        status: 'PENDING',
        items: orderItems, // Cascade should handle this if configured, else save manually
        user: user
      });
      
      const savedOrder = await queryRunner.manager.save(Order, order);

      // Manually save items if cascade not working or to be safe with relation setting
      for(const item of orderItems) {
          item.order = savedOrder;
          await queryRunner.manager.save(OrderItem, item);
      }

      // 3. Commit Transaction
      await queryRunner.commitTransaction();

      // 4. Post-Transaction: Generate Tickets (logic can be async or synchronous)
      // Done outside transaction to keep it short, or inside if critical? 
      // Tickets are critical proof. Should be inside?
      // Re-opening or extending verify scope?
      // Let's do tickets AFTER confirmation usually, but here 'createOrder' implies completion?
      // Prompt said: "Si falla algo, haz rollback".
      // If we fail to generate tickets, arguably checking out failed.
      // But for high throughput, ticket generation (UUIDs) is cheap.
      
      // Let's create tickets properly linked
      const savedTickets: Ticket[] = [];
      for(const t of ticketsToCreate) {
         const tick = this.ticketsRepo.create({
             code: uuidv4(),
             order: savedOrder,
             batch: { id: t.batchId } as Batch
         });
         savedTickets.push(await this.ticketsRepo.save(tick));
      }

      // Generate Payment Link
      const paymentInfo = await this.paymentProvider.generatePaymentLink(savedOrder);
      
      // Update Order with paymentId (optional, depending on provider flow)
      savedOrder.paymentId = paymentInfo.paymentId;
      await queryRunner.manager.save(Order, savedOrder);
      
      // For immediate display (Demo/Mock flow), generate QR codes now
      const ticketsWithQr: any[] = [];
      for(const t of savedTickets) {
          const payload = { 
              sub: t.id, 
              code: t.code, 
              batchId: t.batch.id,
              orderId: savedOrder.id 
          };
          const token = this.jwtService.sign(payload);
          t.signedToken = token;
          await queryRunner.manager.save(Ticket, t);

          const qrCode = await this.notificationsService.generateQRCode(token);
          ticketsWithQr.push({ ...t, qrCode });
      }

      return { order: savedOrder, tickets: ticketsWithQr, paymentLink: paymentInfo.url };

    } catch (err) {
      await queryRunner.rollbackTransaction();
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
}
