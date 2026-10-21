import { Seat } from '../events/seat.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService, CASH_PAYMENT_METHOD } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { Batch } from '../events/batch.entity';
import { OrderItem } from './order-item.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { DataSource } from 'typeorm';

import { PromoCode } from './promo-code.entity';
import { JwtService } from '@nestjs/jwt';

describe('OrdersService', () => {
  let service: OrdersService;
  let dataSource: DataSource;
  let queryRunner: any;

  beforeEach(async () => {
    // Imita el ciclo de vida real del QueryRunner (isTransactionActive / isReleased).
    queryRunner = {
      isTransactionActive: false,
      isReleased: false,
      connect: jest.fn(),
      startTransaction: jest.fn(() => { queryRunner.isTransactionActive = true; }),
      commitTransaction: jest.fn(() => { queryRunner.isTransactionActive = false; }),
      rollbackTransaction: jest.fn(() => { queryRunner.isTransactionActive = false; }),
      release: jest.fn(() => { queryRunner.isReleased = true; }),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { create: jest.fn().mockImplementation((dto) => dto), save: jest.fn() } },
        { provide: getRepositoryToken(Ticket), useValue: { create: jest.fn().mockImplementation(dto => dto), save: jest.fn().mockImplementation(dto => dto) } },
        { provide: getRepositoryToken(OrderItem), useValue: { create: jest.fn().mockImplementation((dto) => dto) } },
        { provide: getRepositoryToken(Batch), useValue: {} },
        { provide: getRepositoryToken(PromoCode), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Seat), useValue: { find: jest.fn().mockResolvedValue([]), save: jest.fn() } },
        { provide: NotificationsService, useValue: { generateQRCode: jest.fn(), sendTicketEmail: jest.fn() } },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { 
          provide: 'PaymentProvider', 
          useValue: { 
            generatePaymentLink: jest.fn().mockResolvedValue({ url: 'http://mock', paymentId: 'mock-id' }) 
          } 
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should prevent order creation if stock is insufficient (Race Condition Check)', async () => {
    const batchData = { id: 'batch-1', totalQuantity: 10, soldQuantity: 9, price: 100, name: 'VIP' };
    
    // Simulate queryRunner.manager.findOne returning current state
    queryRunner.manager.findOne.mockReturnValue(batchData);

    const orderRequest = {
      items: [{ batchId: 'batch-1', quantity: 2 }], // Requesting 2, only 1 left
      user: { email: 'test@test.com' },
      paymentMethod: CASH_PAYMENT_METHOD,
    };

    await expect(service.createOrder(orderRequest)).rejects.toThrow('SoldOutException');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('should successfully create order if stock is enough', async () => {
    const batchData = { id: 'batch-1', totalQuantity: 10, soldQuantity: 0, price: 100, name: 'General' };
    queryRunner.manager.findOne.mockReturnValue(batchData);
    // Return the entity passed to save, avoiding ID overwrite if exists
    queryRunner.manager.save.mockImplementation((entityOrTarget, entity) => {
        const obj = entity || entityOrTarget;
        return obj.id ? obj : { ...obj, id: 'generated-id' };
    });

    const orderRequest = {
      items: [{ batchId: 'batch-1', quantity: 2 }],
      user: { email: 'test@test.com' },
      paymentMethod: CASH_PAYMENT_METHOD,
    };

    try {
        await service.createOrder(orderRequest);
    } catch (e) {
        console.error('Test failed with error:', e);
        throw e;
    }

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    // Verify soldQuantity increment logic was called on the batch object or saved
    // Since we mutate the object in current implementation:
    expect(batchData.soldQuantity).toBe(2); 
    // La conexión vuelve al pool también cuando la orden sale bien.
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should apply discount with valid promo code', async () => {
    const batchData = { id: 'batch-1', totalQuantity: 10, soldQuantity: 0, price: 100, name: 'General' };
    const promoData = { id: 'promo-1', code: 'DISCOUNT10', discountPercentage: 10, usedCount: 0, isActive: true };

    // Mock finds
    queryRunner.manager.findOne.mockImplementation((entity, opts) => {
        if (entity === Batch) return batchData;
        if (entity === PromoCode) return promoData;
        return null;
    });

    queryRunner.manager.save.mockImplementation((entityOrTarget, entity) => {
        const obj = entity || entityOrTarget;
        return obj.id ? obj : { ...obj, id: 'generated-id' };
    });

    const orderRequest = {
      items: [{ batchId: 'batch-1', quantity: 1 }],
      user: { email: 'test@test.com' },
      promoCode: 'DISCOUNT10',
      paymentMethod: CASH_PAYMENT_METHOD,
    };

    const result = await service.createOrder(orderRequest);

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    // Subtotal 100, descuento 10 % = 10, cargo por servicio 15 % del subtotal = 15 → 105.
    expect(result!.order.totalAmount).toBe(105);
    expect(promoData.usedCount).toBe(1);
  });

  describe('validaciones de seguridad', () => {
    const ORIGINAL_MOCK = process.env.ENABLE_MOCK_PAYMENTS;
    afterEach(() => {
      if (ORIGINAL_MOCK === undefined) delete process.env.ENABLE_MOCK_PAYMENTS;
      else process.env.ENABLE_MOCK_PAYMENTS = ORIGINAL_MOCK;
    });

    it.each([0, -3, 1.5, 51, '2'])('rechaza la cantidad %p sin tocar la base', async (quantity) => {
      await expect(
        service.createOrder({ items: [{ batchId: 'b', quantity: quantity as any }], paymentMethod: CASH_PAYMENT_METHOD }),
      ).rejects.toThrow(/cantidad/);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('rechaza una orden sin entradas', async () => {
      await expect(service.createOrder({ items: [], paymentMethod: CASH_PAYMENT_METHOD })).rejects.toThrow(/no tiene entradas/);
    });

    it('rechaza Mercado Pago mientras sea un mock (no regala entradas)', async () => {
      delete process.env.ENABLE_MOCK_PAYMENTS;
      await expect(
        service.createOrder({ items: [{ batchId: 'b', quantity: 1 }], paymentMethod: 'MercadoPago' }),
      ).rejects.toThrow(/efectivo o por transferencia/);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('una orden en efectivo queda pendiente de aprobación y sin QR', async () => {
      queryRunner.manager.findOne.mockReturnValue({ id: 'batch-1', totalQuantity: 10, soldQuantity: 0, price: 100, name: 'General' });
      queryRunner.manager.save.mockImplementation((a, b) => ({ ...(b || a), id: 'o1' }));

      const result = await service.createOrder({ items: [{ batchId: 'batch-1', quantity: 1 }], paymentMethod: CASH_PAYMENT_METHOD });

      expect(result.order.status).toBe('PENDING_APPROVAL');
      expect(result.tickets).toHaveLength(0);
    });

    it('en modo demo, Mercado Pago deja la orden pagada', async () => {
      process.env.ENABLE_MOCK_PAYMENTS = 'true';
      queryRunner.manager.findOne.mockReturnValue({ id: 'batch-1', totalQuantity: 10, soldQuantity: 0, price: 100, name: 'General' });
      queryRunner.manager.save.mockImplementation((a, b) => ({ ...(b || a), id: 'o1' }));

      const result = await service.createOrder({ items: [{ batchId: 'batch-1', quantity: 1 }], paymentMethod: 'MercadoPago' });

      expect(result.order.status).toBe('PAID');
    });
  });
});
