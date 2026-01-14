import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { Order } from './../src/orders/order.entity';
import { Ticket } from './../src/orders/ticket.entity';
import { Batch } from './../src/events/batch.entity';
import { Event } from './../src/events/event.entity';
import { NotificationsService } from './../src/notifications/notifications.service';

describe('Orders Flow (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let batchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(NotificationsService)
    .useValue({
        sendTicketEmail: jest.fn(),
        sendTicketWhatsApp: jest.fn(),
        generateQRCode: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
        createTestAccount: jest.fn() // Just in case
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    // Setup: Create Event and Batch
    const event = new Event();
    event.title = 'E2E Test Event';
    event.description = 'Test Desc';
    event.date = new Date();
    event.location = 'Test Loc';
    // event.organizerId = 'test-org'; // Removed, does not exist
    // Create a producer user if needed or leave nullable if allowed? Event.producer is ManyToOne.
    // Let's assume nullable or create one.
    // If producer is required we need a user.
    // Looking at Entity: @ManyToOne('User', 'events') producer: User; No JoinColumn options, likely nullable by default unless strict?
    // Let's try without setting it first, or set partial.
    const savedEvent = await dataSource.manager.save(Event, event);

    const batch = new Batch();
    batch.name = 'General Admission';
    batch.price = 100;
    batch.totalQuantity = 100;
    batch.soldQuantity = 0;
    batch.event = savedEvent;
    const savedBatch = await dataSource.manager.save(Batch, batch);
    batchId = savedBatch.id;
  });

  afterAll(async () => {
    // Cleanup
    await dataSource.manager.query('DELETE FROM ticket');
    await dataSource.manager.query('DELETE FROM order_item');
    await dataSource.manager.query('DELETE FROM "order"'); // "order" is keyword in PG
    await dataSource.manager.query('DELETE FROM batch');
    await dataSource.manager.query('DELETE FROM event');
    
    await app.close();
  });

  it('/orders (POST) - should create exactly one order and correct number of tickets', async () => {
    const orderPayload = {
      items: [
        { batchId: batchId, quantity: 1 }
      ],
      customerInfo: {
        name: 'Test Buyer',
        email: 'test@example.com',
        phone: '123456',
        docId: '123'
      }
    };

    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(orderPayload)
      .expect(201);

    const { order, tickets } = response.body;

    // API Response Checks
    expect(order).toBeDefined();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].batch.id).toBe(batchId);

    // Database Checks
    const savedOrder = await dataSource.manager.findOne(Order, { 
        where: { id: order.id },
        relations: ['items', 'tickets'] 
    });

    expect(savedOrder).toBeDefined();
    expect(savedOrder!.items).toHaveLength(1); // Should be 1 item line
    expect(savedOrder!.items[0].quantity).toBe(1); // Quantity 1
    
    // Check global Tickets count for this order
    const savedTickets = await dataSource.manager.find(Ticket, { where: { order: { id: order.id } } });
    expect(savedTickets).toHaveLength(1);
  });

  it('/orders (POST) - multiple quantity should create correct number of tickets', async () => {
    const orderPayload = {
      items: [
        { batchId: batchId, quantity: 2 }
      ],
      customerInfo: {
        name: 'Test Buyer 2',
        email: 'test2@example.com',
        phone: '123456',
        docId: '123'
      }
    };

    const response = await request(app.getHttpServer())
      .post('/orders')
      .send(orderPayload)
      .expect(201);

    const { order, tickets } = response.body;

    expect(tickets).toHaveLength(2);

    const savedOrder = await dataSource.manager.findOne(Order, { 
        where: { id: order.id },
        relations: ['items'] 
    });
    
    expect(savedOrder!.items).toHaveLength(1); // still 1 line item
    expect(savedOrder!.items[0].quantity).toBe(2);

    const savedTickets = await dataSource.manager.find(Ticket, { where: { order: { id: order.id } } });
    expect(savedTickets).toHaveLength(2);
  });
});
