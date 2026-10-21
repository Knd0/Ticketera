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
    const ORIGINAL_MOCK = process.env.ENABLE_MOCK_PAYMENTS;
    beforeEach(() => { process.env.ENABLE_MOCK_PAYMENTS = 'true'; });
    afterEach(() => {
      if (ORIGINAL_MOCK === undefined) delete process.env.ENABLE_MOCK_PAYMENTS;
      else process.env.ENABLE_MOCK_PAYMENTS = ORIGINAL_MOCK;
    });

    it('no existe fuera del modo demo: nadie puede marcar órdenes como pagadas', async () => {
      delete process.env.ENABLE_MOCK_PAYMENTS;
      await expect(controller.handleWebhook({ id: 'order-123', status: 'approved' })).rejects.toThrow();
      expect(service.confirmPayment).not.toHaveBeenCalled();
    });

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
