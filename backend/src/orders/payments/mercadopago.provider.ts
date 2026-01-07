import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment.provider';
import { Order } from '../order.entity';

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  async generatePaymentLink(order: Order): Promise<{ url: string; paymentId: string }> {
    const total = Number(order.totalAmount);
    const applicationFee = total * 0.10;
    const organizerAmount = total - applicationFee;

    console.log(`[MercadoPago Mock] Generating preference for Order ${order.id}`);
    console.log(`[MercadoPago Mock] Total: ${total}`);
    console.log(`[MercadoPago Mock] App Fee (10%): ${applicationFee}`);
    console.log(`[MercadoPago Mock] Organizer Amount: ${organizerAmount}`);

    // Mock URL and ID
    return {
      url: `https://mock-mercadopago.com/checkout/${order.id}`,
      paymentId: `mock-payment-${Date.now()}`
    };
  }
}
