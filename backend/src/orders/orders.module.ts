import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TicketsController } from './tickets.controller';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { Batch } from '../events/batch.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { MercadoPagoProvider } from './payments/mercadopago.provider';

import { PromoCode } from './promo-code.entity';

import { OrderItem } from './order-item.entity';
import { Seat } from '../events/seat.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([Order, Ticket, Batch, PromoCode, OrderItem, Seat]),
      NotificationsModule,
      JwtModule.register({
          secret: 'SUPER_SECRET_KEY_123', // In prod, use env var
          signOptions: { expiresIn: '1y' },
      })
  ],
  controllers: [OrdersController, TicketsController],
  providers: [
    OrdersService,
    {
      provide: 'PaymentProvider',
      useClass: MercadoPagoProvider
    }
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
