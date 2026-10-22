export interface CheckoutRequest {
  orderId: string;
  title: string;
  amount: number;
  payerEmail?: string;
  expiresAt: Date;
}

export interface PaymentInfo {
  id: string;
  /** approved | rejected | cancelled | refunded | charged_back | in_process | pending */
  status: string;
  externalReference: string | null;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  /** true si hay credenciales para cobrar de verdad. */
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string; preferenceId: string }>;
  getPayment(paymentId: string): Promise<PaymentInfo>;
  /**
   * Verifica la firma `x-signature` de una notificación. Si no hay secreto
   * configurado devuelve true: el pago igual se consulta a Mercado Pago antes
   * de darlo por bueno, así que una notificación falsa no alcanza para aprobar.
   */
  verifyWebhookSignature(headers: Record<string, any>, dataId: string): boolean;
}
