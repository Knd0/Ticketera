import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { Batch } from './../src/events/batch.entity';
import { Event } from './../src/events/event.entity';
import { NotificationsService } from './../src/notifications/notifications.service';
import { OrdersService } from './../src/orders/orders.service';
import { Seat } from './../src/events/seat.entity';

/**
 * Flujo completo contra Postgres real (base ticketera_e2e), con el Mercado Pago
 * simulado: compra → link de pago → regreso del comprador → entradas con QR.
 */
describe('Compra de entradas (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let batchId: string;
  const mail = { sendTicketsEmail: jest.fn().mockResolvedValue(true), generateQRCode: jest.fn().mockResolvedValue('data:image/png;base64,qr') };
  const buyer = { name: 'Ana Pérez', email: 'ana@example.com', phone: '3455000000', docId: '30111222' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NotificationsService).useValue(mail)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.query('TRUNCATE ticket, order_item, "order", seat, batch, event RESTART IDENTITY CASCADE');

    const event = await dataSource.manager.save(Event, Object.assign(new Event(), {
      title: 'Fiesta E2E', description: 'd', location: 'Concordia', isVisible: true,
      date: new Date(Date.now() + 7 * 86400000), paymentMethods: ['MercadoPago', 'Cash / Bank Transfer'],
    }));
    const batch = await dataSource.manager.save(Batch, Object.assign(new Batch(), {
      name: 'General', price: 1000, totalQuantity: 5, soldQuantity: 0, event,
    }));
    batchId = batch.id;
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE ticket, order_item, "order", seat, batch, event RESTART IDENTITY CASCADE');
    await app.close();
  });

  const sold = async () => (await dataSource.manager.findOneByOrFail(Batch, { id: batchId })).soldQuantity;

  it('Mercado Pago: la orden queda pendiente y se paga al volver del checkout', async () => {
    const res = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId, quantity: 2 }], customerInfo: buyer, paymentMethod: 'MercadoPago' })
      .expect(201);

    expect(res.body.order.status).toBe('PENDING');
    expect(res.body.order.totalAmount).toBe(2300); // 2 × 1000 + 15 % de cargo
    expect(res.body.tickets).toHaveLength(0);
    expect(await sold()).toBe(2);

    const url = new URL(res.body.paymentLink);
    const orderId = url.searchParams.get('orden')!;
    const estado = await request(app.getHttpServer())
      .get(`/orders/${orderId}/estado`).query({ payment_id: url.searchParams.get('payment_id') }).expect(200);

    expect(estado.body.status).toBe('PAID');
    expect(estado.body.tickets).toHaveLength(2);
    expect(estado.body.tickets[0].qrCode).toContain('data:image/png');
    expect(mail.sendTicketsEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com', eventTitle: 'Fiesta E2E' }));
  });

  it('sin pagar, la orden vence y las entradas vuelven a la venta', async () => {
    const before = await sold();
    const res = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId, quantity: 1 }], customerInfo: buyer, paymentMethod: 'MercadoPago' }).expect(201);
    expect(await sold()).toBe(before + 1);

    const expired = await app.get(OrdersService).expireUnpaidOrders(new Date(Date.now() + 60 * 60_000));
    expect(expired).toBe(1);
    expect(await sold()).toBe(before);
    const estado = await request(app.getHttpServer()).get(`/orders/${res.body.order.id}/estado`).expect(200);
    expect(estado.body.status).toBe('EXPIRED');
  });

  it('no vende más entradas que el stock', async () => {
    const left = 5 - (await sold());
    const res = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId, quantity: left + 1 }], customerInfo: buyer, paymentMethod: 'Cash / Bank Transfer' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/quedan/);
  });

  it('efectivo: queda pendiente de aprobación del productor, sin QR', async () => {
    const res = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId, quantity: 1 }], customerInfo: buyer, paymentMethod: 'Cash / Bank Transfer' }).expect(201);
    expect(res.body.order.status).toBe('PENDING_APPROVAL');
    const estado = await request(app.getHttpServer()).get(`/orders/${res.body.order.id}/estado`).expect(200);
    expect(estado.body.tickets).toHaveLength(0);
  });

  it('butacas: se venden una sola vez y vuelven a estar libres si la orden vence', async () => {
    const event = await dataSource.manager.findOneByOrFail(Event, { title: 'Fiesta E2E' });
    const platea = await dataSource.manager.save(Batch, Object.assign(new Batch(), {
      name: 'Platea', price: 500, totalQuantity: 4, soldQuantity: 0, hasSeating: true, event,
    }));
    const seats = await dataSource.manager.save(Seat, ['1', '2'].map(n => Object.assign(new Seat(), { row: 'A', number: n, status: 'AVAILABLE', batch: platea })));
    const pick = JSON.stringify([{ id: seats[0].id }]);

    const first = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId: platea.id, quantity: 1, seats: pick }], customerInfo: buyer, paymentMethod: 'MercadoPago' }).expect(201);
    const again = await request(app.getHttpServer()).post('/orders')
      .send({ items: [{ batchId: platea.id, quantity: 1, seats: pick }], customerInfo: buyer, paymentMethod: 'MercadoPago' });
    expect(again.status).toBe(409);

    await app.get(OrdersService).releaseOrder(first.body.order.id, 'EXPIRED');
    expect((await dataSource.manager.findOneByOrFail(Seat, { id: seats[0].id })).status).toBe('AVAILABLE');
    expect((await dataSource.manager.findOneByOrFail(Batch, { id: platea.id })).soldQuantity).toBe(0);
  });
});
