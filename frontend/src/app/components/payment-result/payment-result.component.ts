import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrdersService, PublicOrder } from '../../services/orders.service';
import { AuthService } from '../../services/auth.service';

/**
 * Página a la que vuelve el comprador desde Mercado Pago (y a la que llega
 * después de reservar por transferencia). Consulta el estado de la orden y,
 * si el pago todavía no se confirmó, vuelve a preguntar unos segundos.
 */
@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.css',
})
export class PaymentResultComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private orders = inject(OrdersService);
  auth = inject(AuthService);

  orderId = this.route.snapshot.queryParamMap.get('orden');
  paymentId = this.route.snapshot.queryParamMap.get('payment_id') || this.route.snapshot.queryParamMap.get('collection_id');
  mpStatus = this.route.snapshot.queryParamMap.get('status') || this.route.snapshot.queryParamMap.get('collection_status');

  order: PublicOrder | null = null;
  error = '';
  private attempts = 0;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    if (!this.orderId) { this.error = 'Falta el número de orden.'; return; }
    this.load();
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  get paymentFailed(): boolean {
    return this.order?.status === 'PENDING' && !!this.mpStatus && ['rejected', 'failure', 'null', 'cancelled'].includes(this.mpStatus);
  }

  get stillWaiting(): boolean {
    return this.order?.status === 'PENDING' && !this.paymentFailed && this.attempts < 20;
  }

  private load() {
    this.orders.getOrder(this.orderId!, this.paymentId).subscribe({
      next: (o) => {
        this.order = o;
        this.attempts++;
        if (this.stillWaiting) this.timer = setTimeout(() => this.load(), 3000);
      },
      error: (err) => {
        this.error = err?.status === 404 || err?.status === 400 ? 'No encontramos esta orden.' : 'No pudimos consultar tu orden. Recargá la página en un momento.';
      },
    });
  }

  copyInstructions(text: string) {
    navigator.clipboard?.writeText(text);
  }
}
