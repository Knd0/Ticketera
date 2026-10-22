import { requireSecret } from '../common/secrets';
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
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { isMockPaymentsEnabled } from '../common/secrets';

import { PromoCode } from './promo-code.entity';

import { OrderItem } from './order-item.entity';
import { Seat } from '../events/seat.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([Order, Ticket, Batch, PromoCode, OrderItem, Seat]),
      NotificationsModule,
      // Firma de los QR de las entradas. Secreto propio, distinto del de sesión.
      JwtModule.registerAsync({
          useFactory: () => ({
              secret: requireSecret('TICKET_SIGNING_SECRET'),
              signOptions: { expiresIn: '1y' },
          }),
      })
  ],
  controllers: [OrdersController, TicketsController],
  providers: [
    OrdersService,
    {
      // ENABLE_MOCK_PAYMENTS=true usa un Mercado Pago simulado (sólo desarrollo).
      provide: 'PaymentProvider',
      useFactory: () => (isMockPaymentsEnabled() ? new MockPaymentProvider() : new MercadoPagoProvider()),
    }
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
