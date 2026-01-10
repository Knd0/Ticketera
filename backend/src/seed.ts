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

    console.log('Cleaning database...');
    try {
        // Attempt fast truncate for Postgres
        await batchRepository.query(`TRUNCATE TABLE "batch", "event", "promo_code", "user" RESTART IDENTITY CASCADE;`);
    } catch (error) {
        console.warn('TRUNCATE failed, attempting standard delete...', error);
        await batchRepository.delete({});
        await eventRepository.delete({});
        await promoRepository.delete({});
        await userRepository.delete({});
    }
    console.log('Database cleaned.');

    console.log('Seeding data...');

    const password = await bcrypt.hash('password', 10);

    // 1. Create Admin (Role: Producer/Admin)
    const admin = userRepository.create({
        username: 'admin',
        email: 'admin@test.com',
        password: password,
        role: 'admin',
        fullName: 'System Administrator',
        organizationName: 'Ticketera Admin',
        description: 'Super user account.'
    });
    await userRepository.save(admin);
    console.log('Created Admin User (admin@test.com)');

    // 2. Create Producer
    const producer = userRepository.create({
        username: 'producer', // unique constraint
        email: 'producer@test.com',
        password: password,
        role: 'producer',
        fullName: 'Producer Name', // Sometimes mapped to org name
        organizationName: 'Best Events Co.',
        website: 'https://bestevents.com',
        description: 'We organize the best rock concerts and tech summits in the region.',
        profileImageUrl: 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png',
        // cuit: '20-12345678-9' // Optional/Removed as per user request
    });
    await userRepository.save(producer);
    console.log('Created Producer User (producer@test.com)');

    // 3. Create Regular User
    const user = userRepository.create({
        username: 'user1',
        email: 'user@test.com',
        password: password,
        role: 'user',
        fullName: 'John Doe',
        dni: '12345678',
        phone: '1122334455'
    });
    await userRepository.save(user);
    console.log('Created Regular User (user@test.com)');

    // 4. Create Event: Concert (Linked to Producer)
    const concert = eventRepository.create({
        title: 'Rolling Stones Live',
        description: 'The legendary band returns for one night only.',
        date: new Date('2026-12-25T20:00:00'),
        endDate: new Date('2026-12-25T23:00:00'),
        location: 'Estadio Unico',
        imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        category: 'Concert',
        producer: producer,
        isVisible: true
    });
    await eventRepository.save(concert);
    console.log('Created Concert Event');

    // Batches for Concert
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

    // 5. Create Event: Technology Conference
    const conf = eventRepository.create({
        title: 'Tech Summit 2026',
        description: 'The biggest tech conference in the region.',
        date: new Date('2026-10-15T09:00:00'),
        endDate: new Date('2026-10-17T18:00:00'),
        location: 'Convention Center',
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        category: 'Conference',
        producer: producer,
        isVisible: true
    });
    await eventRepository.save(conf);
    console.log('Created Tech Conference Event');

    // Batches for Conference
    const batchConf = batchRepository.create({
        name: 'Full Pass',
        price: 200,
        totalQuantity: 500,
        soldQuantity: 0,
        event: conf
    });
    await batchRepository.save(batchConf);

    // 6. Promo Code
    const promo = promoRepository.create({
        code: 'WELCOME20',
        discountPercentage: 20,
        maxUses: 100,
        usedCount: 0,
        validUntil: new Date('2027-01-01'),
        isActive: true
    });
    await promoRepository.save(promo);
    console.log('Created Promo Code WELCOME20');

    console.log('Seeding completed successfully!');
    await app.close();
}


bootstrap().catch(err => {
    console.error('SEED ERROR:', err);
    process.exit(1);
});
