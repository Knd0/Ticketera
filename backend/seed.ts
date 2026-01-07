import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UsersService } from './src/users/users.service';
import { EventsService } from './src/events/events.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const eventsService = app.get(EventsService);

  const username = 'admin';
  const password = 'password123';

  const existingUser = await usersService.findOne(username);
  let user;
  if (!existingUser) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);
    user = await usersService.create({ username, password: hashedPassword });
    console.log(`User created: ${username} / ${password}`);
  } else {
    user = existingUser;
    console.log('User already exists');
  }

  // Create Sample Event if none exists
  const existingEvents = await eventsService.findAll();
  if (existingEvents.length === 0) {
    await eventsService.create({
      title: 'Summer Music Festival',
      description: 'The biggest festival of the year!',
      location: 'Central Park',
      date: new Date('2025-07-15'),
      imageUrl: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?auto=format&fit=crop&q=80',
      batches: [
        { name: 'Early Bird', price: 50, totalQuantity: 100 },
        { name: 'General Admission', price: 80, totalQuantity: 500 }
      ]
    }, user);
    console.log('Sample Event Created');
  }

  await app.close();
}
bootstrap();
