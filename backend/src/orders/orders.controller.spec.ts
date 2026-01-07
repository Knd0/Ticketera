import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            createOrder: jest.fn(),
            confirmPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should confirm payment if status is approved', async () => {
      const body = { id: 'order-123', status: 'approved' };
      await controller.handleWebhook(body);
      expect(service.confirmPayment).toHaveBeenCalledWith('order-123');
    });

    it('should NOT confirm payment if status is NOT approved', async () => {
      const body = { id: 'order-123', status: 'pending' };
      await controller.handleWebhook(body);
      expect(service.confirmPayment).not.toHaveBeenCalled();
    });
  });
});
