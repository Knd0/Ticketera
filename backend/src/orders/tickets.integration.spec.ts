import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Ticket } from './ticket.entity';
import { Batch } from '../events/batch.entity';
import { OrderItem } from './order-item.entity';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('OrdersService Integration - Tickets & Notifications', () => {
  let service: OrdersService;
  let notificationsService: NotificationsService;
  let queryRunner: any;
  let module: TestingModule;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation((targetOrEntity, entity) => entity || targetOrEntity),
        findOne: jest.fn(), // If needed by other calls
      }
    };

    const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

    module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Ticket), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        { provide: getRepositoryToken(Batch), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-jwt-token') } },
        { provide: 'PaymentProvider', useValue: {} }, // Not used in confirmPayment
        { 
            provide: NotificationsService, 
            useValue: { 
                generateQRCode: jest.fn().mockResolvedValue('data:image/png;base64,...'),
                sendTicketEmail: jest.fn(),
                sendTicketWhatsApp: jest.fn()
            } 
        }
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  it('should trigger notifications and sign tickets on confirmPayment', async () => {
      // Mock Order
      const mockOrder = { 
          id: 'order-1', 
          status: 'PENDING', 
          customerEmail: 'customer@test.com',
          customerPhone: '123456789'
      };
      
      // Mock Tickets found for this order
      const mockTickets = [
          { id: 'ticket-1', code: 'uuid-1', batch: { id: 'batch-1', name: 'VIP' }, order: mockOrder }
      ];

      // Setup Mocks
      const ordersRepo = module.get(getRepositoryToken(Order));
      (ordersRepo.findOne as jest.Mock).mockResolvedValue(mockOrder);
      
      const ticketsRepo = module.get(getRepositoryToken(Ticket));
      (ticketsRepo.find as jest.Mock).mockResolvedValue(mockTickets);

      // Execute
      await service.confirmPayment('order-1');

      // Assertions
      // 1. Transaction Committed
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      
      // 2. Ticket Saved with Token
      expect(queryRunner.manager.save).toHaveBeenCalledWith(Ticket, expect.objectContaining({
          id: 'ticket-1',
          signedToken: 'mock-jwt-token'
      }));

      // 3. Email Sent
      expect(notificationsService.sendTicketEmail).toHaveBeenCalledWith(
          'customer@test.com', 
          'uuid-1', 
          'data:image/png;base64,...'
      );

      // 4. WhatsApp Sent
      expect(notificationsService.sendTicketWhatsApp).toHaveBeenCalledWith(
          '123456789',
          'VIP',
          'data:image/png;base64,...'
      );
  });
});
