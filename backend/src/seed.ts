import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/user.entity';
import { Event } from './events/event.entity';
import { Batch } from './events/batch.entity';
import { PromoCode } from './orders/promo-code.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const eventRepository = app.get<Repository<Event>>(getRepositoryToken(Event));
  const batchRepository = app.get<Repository<Batch>>(getRepositoryToken(Batch));
  const promoRepository = app.get<Repository<PromoCode>>(getRepositoryToken(PromoCode));

  console.log('Seeding data...');

  // 1. Create Prod user
  const hashedPassword = await bcrypt.hash('password', 10);
  let producer = await userRepository.findOne({ where: { email: 'producer@test.com' } });
  
  if (!producer) {
    producer = userRepository.create({
      username: 'Producer',
      email: 'producer@test.com',
      password: hashedPassword,
      role: 'producer'
    });
    await userRepository.save(producer);
    console.log('Created Producer User');
  }

  // 2. Create Event: Concert
  let concert = await eventRepository.findOne({ where: { title: 'Rolling Stones Live' } });
  if (!concert) {
    concert = eventRepository.create({
      title: 'Rolling Stones Live',
      description: 'The legendary band returns for one night only.',
      date: new Date('2026-12-25T20:00:00'),
      endDate: new Date('2026-12-25T23:00:00'),
      location: 'Estadio Unico',
      imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
      category: 'Concert',
      producer: producer
    });
    await eventRepository.save(concert);
    console.log('Created Concert Event');

    // Batches
    const batch1 = batchRepository.create({
        name: 'General Admission',
        price: 50,
        totalQuantity: 100,
        soldQuantity: 0,
        event: concert
    });
    const batch2 = batchRepository.create({
        name: 'VIP',
        price: 150,
        totalQuantity: 20,
        soldQuantity: 0,
        event: concert
    });
    await batchRepository.save([batch1, batch2]);
  }

  // 3. Create Event: Technology Conference
  let conf = await eventRepository.findOne({ where: { title: 'Tech Summit 2026' } });
  if (!conf) {
    conf = eventRepository.create({
      title: 'Tech Summit 2026',
      description: 'The biggest tech conference in the region.',
      date: new Date('2026-10-15T09:00:00'),
      endDate: new Date('2026-10-17T18:00:00'),
      location: 'Convention Center',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
      category: 'Conference',
      producer: producer
    });
    await eventRepository.save(conf);
    console.log('Created Tech Conference Event');

    // Batches
    const batchConf = batchRepository.create({
        name: 'Full Pass',
        price: 200,
        totalQuantity: 500,
        soldQuantity: 0,
        event: conf
    });
    await batchRepository.save(batchConf);
  }

  // 4. Promo Code
  let promo = await promoRepository.findOne({ where: { code: 'WELCOME20' } });
  if (!promo) {
      promo = promoRepository.create({
          code: 'WELCOME20',
          discountPercentage: 20,
          maxUses: 100,
          usedCount: 0,
          validUntil: new Date('2027-01-01'),
          isActive: true
      });
      await promoRepository.save(promo);
      console.log('Created Promo Code WELCOME20');
  }

  console.log('Seeding completed!');
  await app.close();
}

bootstrap();
