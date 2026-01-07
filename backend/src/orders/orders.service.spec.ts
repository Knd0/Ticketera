import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
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
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
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
      user: { email: 'test@test.com' }
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
      user: { email: 'test@test.com' }
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
      promoCode: 'DISCOUNT10'
    };

    const result = await service.createOrder(orderRequest);

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    // Total: 100. Discount 10% = 10. Final = 90.
    expect(result!.order.totalAmount).toBe(90);
    expect(promoData.usedCount).toBe(1);
  });
});
