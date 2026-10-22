import { createHmac } from 'crypto';
import { MercadoPagoProvider } from './mercadopago.provider';

describe('MercadoPagoProvider', () => {
  const env = { ...process.env };
  let provider: MercadoPagoProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.MP_ACCESS_TOKEN = 'APP_USR-test';
    process.env.FRONTEND_URL = 'https://entradas.example.com';
    process.env.PUBLIC_API_URL = 'https://api.example.com';
    delete process.env.MP_WEBHOOK_SECRET;
    provider = new MercadoPagoProvider();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });
  afterEach(() => { process.env = { ...env }; });

  it('sin token no está configurado', () => {
    delete process.env.MP_ACCESS_TOKEN;
    expect(provider.isConfigured()).toBe(false);
  });

  it('crea la preferencia con el monto del servidor, la orden como referencia y sin pagos en efectivo', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ id: 'pref-1', init_point: 'https://mp/pay' }) });
    const expiresAt = new Date('2026-11-01T12:00:00Z');

    const res = await provider.createCheckout({ orderId: 'o1', title: 'Entradas — Fiesta', amount: 115.004, payerEmail: 'a@b.com', expiresAt });

    expect(res).toEqual({ url: 'https://mp/pay', preferenceId: 'pref-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(init.headers.Authorization).toBe('Bearer APP_USR-test');
    const body = JSON.parse(init.body);
    expect(body.items[0]).toMatchObject({ unit_price: 115, currency_id: 'ARS', quantity: 1 });
    expect(body.external_reference).toBe('o1');
    expect(body.binary_mode).toBe(true);
    expect(body.payment_methods.excluded_payment_types).toEqual([{ id: 'ticket' }, { id: 'atm' }]);
    expect(body.notification_url).toBe('https://api.example.com/orders/webhook/mercadopago');
    expect(body.back_urls.success).toBe('https://entradas.example.com/checkout/resultado?orden=o1');
    expect(body.expiration_date_to).toBe(expiresAt.toISOString());
  });

  it('no manda notification_url a una API local (Mercado Pago no puede llegar)', async () => {
    process.env.PUBLIC_API_URL = 'http://localhost:3020';
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ id: 'p', init_point: 'u' }) });
    await provider.createCheckout({ orderId: 'o1', title: 't', amount: 1, expiresAt: new Date() });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).notification_url).toBeUndefined();
  });

  it('traduce el pago de Mercado Pago', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ id: 99, status: 'approved', external_reference: 'o1', transaction_amount: 115, currency_id: 'ARS' }) });
    await expect(provider.getPayment('99')).resolves.toEqual({ id: '99', status: 'approved', externalReference: 'o1', amount: 115, currency: 'ARS' });
  });

  it('no consulta ids de pago con caracteres raros', async () => {
    await expect(provider.getPayment('../users/me')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un error de Mercado Pago no expone la respuesta al comprador', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid token APP_USR-...' });
    await expect(provider.getPayment('1')).rejects.toThrow('Mercado Pago no respondió bien');
  });

  describe('firma del webhook', () => {
    const sign = (secret: string, id: string, reqId: string, ts: string) =>
      createHmac('sha256', secret).update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');

    it('sin secreto configurado no bloquea (el pago igual se consulta a MP)', () => {
      expect(provider.verifyWebhookSignature({}, '123')).toBe(true);
    });

    it('acepta una firma correcta y rechaza una alterada', () => {
      process.env.MP_WEBHOOK_SECRET = 's3cret';
      const v1 = sign('s3cret', '123', 'req-1', '1700000000');
      const headers = { 'x-signature': `ts=1700000000,v1=${v1}`, 'x-request-id': 'req-1' };
      expect(provider.verifyWebhookSignature(headers, '123')).toBe(true);
      expect(provider.verifyWebhookSignature(headers, '124')).toBe(false);
      expect(provider.verifyWebhookSignature({ 'x-request-id': 'req-1' }, '123')).toBe(false);
    });
  });
});
