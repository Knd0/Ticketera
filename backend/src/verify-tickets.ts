import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { TicketsController } from './orders/tickets.controller';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const ticketsController = app.get(TicketsController);

  console.log('Logging in...');
  // Assuming user@test.com exists and has password 'password'
  const user = await authService.validateUser('user@test.com', 'password');
  if (!user) {
      console.error('Login failed! User not found or invalid password.');
      await app.close();
      return;
  }
  
  const loginResult = await authService.login(user);
  console.log('Login successful. Token:', loginResult.access_token.substring(0, 20) + '...');

  // Mock Request object with user (simulating JwtStrategy)
  // JwtStrategy returns: { id: payload.sub, username: payload.username, email: payload.email, role: payload.role }
  const reqMock = {
      user: {
          id: user.id,
          email: user.email, 
          username: user.email,
          role: user.role
      }
  };

  console.log('Fetching tickets for user:', reqMock.user);
  const tickets = await ticketsController.getMyTickets(reqMock);
  
  console.log('--- TICKETS FOUND ---');
  console.log(`Count: ${tickets.length}`);
  tickets.forEach(t => {
      console.log(`- ID: ${t.id}`);
      console.log(`  Batch: ${t.batch?.name} (Event: ${t.batch?.event?.title})`);
      console.log(`  Order Customer: ${t.order?.customerEmail}`);
      console.log(`  Used: ${t.isUsed}`);
  });

  await app.close();
}

bootstrap();
