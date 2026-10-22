import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { OrdersModule } from './orders/orders.module';
import { ConsoleModule } from './console/console.module';
import { User } from './users/user.entity';
import { Event } from './events/event.entity';
import { Batch } from './events/batch.entity';
import { Order } from './orders/order.entity';
import { Ticket } from './orders/ticket.entity';
import { OrderItem } from './orders/order-item.entity';
import { PromoCode } from './orders/promo-code.entity';
import { Seat } from './events/seat.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, Event, Batch, Order, Ticket, OrderItem, PromoCode, Seat],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    // 120 pedidos por minuto por IP; login, registro y compras tienen límites propios.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    UsersModule,
    AuthModule,
    EventsModule,
    OrdersModule,
    ConsoleModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
