import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { CheckoutRequest, PaymentInfo, PaymentProvider } from './payment.provider';

const MP_API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15000;

/**
 * Mercado Pago Checkout Pro.
 *
 * - La preferencia sale con `binary_mode` y sin medios en efectivo (Rapipago,
 *   Pago Fácil): el pago se aprueba o rechaza en el momento. Así una orden no
 *   queda reservando entradas días esperando un cupón que quizá nunca se pague.
 * - `external_reference` es el id de la orden: es lo que une el pago con ella.
 * - El monto lo fija el servidor; el webhook vuelve a consultar el pago y
 *   compara el importe antes de emitir las entradas.
 */
@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);

  private get token() {
    return process.env.MP_ACCESS_TOKEN?.trim() || '';
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  async createCheckout(req: CheckoutRequest): Promise<{ url: string; preferenceId: string }> {
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:4220').replace(/\/$/, '');
    const api = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const back = `${frontend}/checkout/resultado?orden=${req.orderId}`;

    const body: any = {
      items: [{
        id: req.orderId,
        title: req.title.slice(0, 250),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Math.round(req.amount * 100) / 100,
      }],
      external_reference: req.orderId,
      back_urls: { success: back, failure: back, pending: back },
      auto_return: 'approved',
      binary_mode: true,
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
      expires: true,
      expiration_date_to: req.expiresAt.toISOString(),
      statement_descriptor: (process.env.MP_STATEMENT_DESCRIPTOR || 'ENTRADAS').slice(0, 22),
    };
    if (req.payerEmail) body.payer = { email: req.payerEmail };
    // Mercado Pago no puede avisar a localhost: sin URL pública se confirma
    // cuando el comprador vuelve a la página de resultado.
    if (api.startsWith('https://')) body.notification_url = `${api}/orders/webhook/mercadopago`;

    const res = await this.call('/checkout/preferences', { method: 'POST', body: JSON.stringify(body) });
    const url = process.env.MP_USE_SANDBOX === 'true' ? res.sandbox_init_point : res.init_point;
    if (!url) throw new ServiceUnavailableException('Mercado Pago no devolvió el link de pago.');
    return { url, preferenceId: res.id };
  }

  async getPayment(paymentId: string): Promise<PaymentInfo> {
    if (!/^\d+$/.test(paymentId)) throw new ServiceUnavailableException('Id de pago inválido.');
    const p = await this.call(`/v1/payments/${paymentId}`, { method: 'GET' });
    return {
      id: String(p.id),
      status: p.status,
      externalReference: p.external_reference ?? null,
      amount: Number(p.transaction_amount),
      currency: p.currency_id,
    };
  }

  verifyWebhookSignature(headers: Record<string, any>, dataId: string): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET?.trim();
    if (!secret) return true;
    const signature = String(headers['x-signature'] || '');
    const requestId = String(headers['x-request-id'] || '');
    const parts = Object.fromEntries(
      signature.split(',').map(p => p.split('=').map(s => s.trim())).filter(kv => kv.length === 2),
    );
    if (!parts.ts || !parts.v1) return false;
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(parts.v1));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async call(path: string, init: { method: string; body?: string }): Promise<any> {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Mercado Pago no está configurado.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${MP_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(init.method === 'POST' ? { 'X-Idempotency-Key': `${path}-${Date.now()}-${Math.random()}` } : {}),
        },
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(`Mercado Pago ${init.method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
        throw new ServiceUnavailableException('Mercado Pago no respondió bien. Probá de nuevo en unos minutos.');
      }
      return text ? JSON.parse(text) : {};
    } finally {
      clearTimeout(timer);
    }
  }
}
