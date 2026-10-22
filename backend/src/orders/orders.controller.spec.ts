import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController — webhook de Mercado Pago', () => {
  let controller: OrdersController;
  const service = { handlePaymentNotification: jest.fn().mockResolvedValue({ orderId: 'o1', status: 'PAID' }) };
  const provider = { verifyWebhookSignature: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: service },
        { provide: 'PaymentProvider', useValue: provider },
      ],
    }).compile();
    controller = module.get(OrdersController);
  });

  it('consulta el pago informado (formato webhook)', async () => {
    await controller.handleWebhook({ type: 'payment', data: { id: '123' } }, { 'data.id': '123', type: 'payment' }, {});
    expect(service.handlePaymentNotification).toHaveBeenCalledWith('123');
  });

  it('acepta el formato IPN viejo (?topic=payment&id=)', async () => {
    await controller.handleWebhook({}, { topic: 'payment', id: '456' }, {});
    expect(service.handlePaymentNotification).toHaveBeenCalledWith('456');
  });

  it('ignora notificaciones que no son de pagos', async () => {
    await controller.handleWebhook({ type: 'merchant_order', data: { id: '9' } }, {}, {});
    expect(service.handlePaymentNotification).not.toHaveBeenCalled();
  });

  it('rechaza una firma inválida sin tocar órdenes', async () => {
    provider.verifyWebhookSignature.mockReturnValueOnce(false);
    await expect(controller.handleWebhook({ type: 'payment', data: { id: '1' } }, {}, {})).rejects.toThrow('Firma inválida');
    expect(service.handlePaymentNotification).not.toHaveBeenCalled();
  });

  it('ya no acepta el webhook de mentira que marcaba como pagada cualquier orden', async () => {
    await controller.handleWebhook({ id: 'order-123', status: 'approved' }, {}, {});
    expect(service.handlePaymentNotification).not.toHaveBeenCalled();
  });
});
