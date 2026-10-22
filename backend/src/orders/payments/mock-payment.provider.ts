import { Injectable } from '@nestjs/common';
import { CheckoutRequest, PaymentInfo, PaymentProvider } from './payment.provider';

/**
 * Mercado Pago simulado para desarrollo y demos (ENABLE_MOCK_PAYMENTS=true).
 * El link lleva directo a la página de resultado con un pago "aprobado".
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly amounts = new Map<string, { orderId: string; amount: number }>();

  isConfigured() { return true; }

  async createCheckout(req: CheckoutRequest) {
    const paymentId = String(Date.now());
    this.amounts.set(paymentId, { orderId: req.orderId, amount: req.amount });
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:4220').replace(/\/$/, '');
    return {
      url: `${frontend}/checkout/resultado?orden=${req.orderId}&payment_id=${paymentId}&status=approved`,
      preferenceId: `mock-${paymentId}`,
    };
  }

  async getPayment(paymentId: string): Promise<PaymentInfo> {
    const p = this.amounts.get(paymentId);
    return {
      id: paymentId,
      status: p ? 'approved' : 'rejected',
      externalReference: p?.orderId ?? null,
      amount: p?.amount ?? 0,
      currency: 'ARS',
    };
  }

  verifyWebhookSignature() { return true; }
}
