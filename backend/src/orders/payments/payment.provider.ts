import { Order } from '../order.entity';

export interface PaymentProvider {
  generatePaymentLink(order: Order): Promise<{ url: string; paymentId: string }>;
}
