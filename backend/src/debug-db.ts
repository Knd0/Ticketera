import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/user.entity';
import { Order } from './orders/order.entity';
import { Ticket } from './orders/ticket.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const orderRepository = app.get<Repository<Order>>(getRepositoryToken(Order));
  const ticketRepository = app.get<Repository<Ticket>>(getRepositoryToken(Ticket));

  console.log('--- USERS ---');
  const users = await userRepository.find();
  users.forEach(u => console.log(`${u.id} | ${u.email} | ${u.role}`));

  console.log('\n--- ORDERS ---');
  const orders = await orderRepository.find({ relations: ['user', 'tickets'] });
  orders.forEach(o => {
      console.log(`Order ID: ${o.id}`);
      console.log(`  Customer: ${o.customerEmail} (Name: ${o.customerName})`);
      console.log(`  User Relation: ${o.user ? o.user.id : 'NULL'}`);
      console.log(`  Status: ${o.status}`);
      console.log(`  Tickets: ${o.tickets.length}`);
  });

  console.log('\n--- TICKETS ---');
  const tickets = await ticketRepository.find({ relations: ['order', 'order.user'] });
  tickets.forEach(t => {
      console.log(`Ticket ID: ${t.id}`);
      console.log(`  Order ID: ${t.order?.id}`);
      console.log(`  Order User: ${t.order?.user?.email}`);
      console.log(`  SignedToken: ${t.signedToken ? 'Yes' : 'No'}`);
  });

  await app.close();
}

bootstrap();
