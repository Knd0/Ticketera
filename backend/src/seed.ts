import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { User } from './users/user.entity';
import { Event } from './events/event.entity';
import { Batch } from './events/batch.entity';
import { PromoCode } from './orders/promo-code.entity';
import { Seat } from './events/seat.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const eventRepository = app.get<Repository<Event>>(getRepositoryToken(Event));
    const batchRepository = app.get<Repository<Batch>>(getRepositoryToken(Batch));
    const promoRepository = app.get<Repository<PromoCode>>(getRepositoryToken(PromoCode));
    const seatRepository = app.get<Repository<Seat>>(getRepositoryToken(Seat));

    console.log('Cleaning database...');
    try {
        // Attempt fast truncate for Postgres
        await batchRepository.query(`TRUNCATE TABLE "ticket", "order_item", "order", "seat", "batch", "event", "promo_code", "user" RESTART IDENTITY CASCADE;`);
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

    // Fechas relativas a hoy: la demo siempre tiene eventos próximos.
    const inDays = (days: number, hour: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(hour, 0, 0, 0);
        return d;
    };

    // 1. Administrador
    await userRepository.save(userRepository.create({
        username: 'admin',
        email: 'admin@test.com',
        password,
        role: 'admin',
        fullName: 'Administración',
        organizationName: 'Administración',
    }));
    console.log('Admin: admin@test.com');

    // 2. Productora de ejemplo
    const producer = await userRepository.save(userRepository.create({
        username: 'producer',
        email: 'producer@test.com',
        password,
        role: 'producer',
        fullName: 'Producciones del Litoral',
        organizationName: 'Producciones del Litoral',
        website: 'https://instagram.com/',
        description: 'Fiestas, recitales y espectáculos en Concordia y la región desde 2015.',
        phone: '3454000000',
    }));
    console.log('Productora: producer@test.com');

    // 3. Comprador de ejemplo
    await userRepository.save(userRepository.create({
        username: 'user1',
        email: 'user@test.com',
        password,
        role: 'user',
        fullName: 'Lucía Gómez',
        dni: '35111222',
        phone: '3454123456',
    }));
    console.log('Comprador: user@test.com');

    const both = ['MercadoPago', 'Cash / Bank Transfer'];
    const howToPay = 'Alias: producciones.litoral\nTitular: Producciones del Litoral\nMandá el comprobante por WhatsApp al 345 4000000.';

    // 4. Eventos de ejemplo
    const fiesta = await eventRepository.save(eventRepository.create({
        title: 'Fiesta de la Primavera',
        description: 'La fiesta más grande de la temporada, con DJs invitados.\nApertura 23 h. Mayores de 18 con DNI.',
        date: inDays(10, 23),
        endDate: inDays(11, 5),
        location: 'Club Ferrocarril, Concordia',
        category: 'Party',
        producer,
        isVisible: true,
        paymentMethods: both,
        paymentInstructions: howToPay,
    }));
    await batchRepository.save([
        batchRepository.create({ name: 'Anticipada', price: 8000, totalQuantity: 300, soldQuantity: 0, event: fiesta }),
        batchRepository.create({ name: 'General', price: 12000, totalQuantity: 400, soldQuantity: 0, event: fiesta }),
        batchRepository.create({ name: 'VIP', price: 20000, totalQuantity: 50, soldQuantity: 0, event: fiesta }),
    ]);

    const recital = await eventRepository.save(eventRepository.create({
        title: 'Noche de Folklore en la Costanera',
        description: 'Peñas, chamamé y folklore al aire libre. Traé tu reposera.',
        date: inDays(24, 21),
        endDate: inDays(25, 1),
        location: 'Anfiteatro de la Costanera, Concordia',
        category: 'Concert',
        producer,
        isVisible: true,
        paymentMethods: both,
        paymentInstructions: howToPay,
    }));
    await batchRepository.save(batchRepository.create({ name: 'Entrada general', price: 6000, totalQuantity: 500, soldQuantity: 0, event: recital }));

    const teatro = await eventRepository.save(eventRepository.create({
        title: 'Stand up: Risas en el Odeón',
        description: 'Una noche de humor con tres comediantes de la región. Ubicaciones numeradas.',
        date: inDays(17, 21),
        location: 'Teatro Odeón, Concordia',
        category: 'Theater',
        producer,
        isVisible: true,
        paymentMethods: ['MercadoPago'],
    }));
    const platea = await batchRepository.save(batchRepository.create({
        name: 'Platea', price: 9000, totalQuantity: 60, soldQuantity: 0, hasSeating: true, rows: 6, cols: 10, event: teatro,
    }));
    const rows = 'ABCDEF';
    await seatRepository.save([...rows].flatMap(row => Array.from({ length: 10 }, (_, i) =>
        seatRepository.create({ row, number: String(i + 1), status: 'AVAILABLE', batch: platea }))));

    // 5. Código de descuento
    await promoRepository.save(promoRepository.create({
        code: 'BIENVENIDA10',
        discountPercentage: 10,
        maxUses: 100,
        usedCount: 0,
        validUntil: inDays(90, 23),
        isActive: true,
    }));
    console.log('Código de descuento: BIENVENIDA10');

    console.log('Seeding completed successfully!');
    await app.close();
}


bootstrap().catch(err => {
    console.error('SEED ERROR:', err);
    process.exit(1);
});
