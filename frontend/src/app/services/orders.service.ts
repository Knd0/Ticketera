import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CheckoutConfig {
  serviceFeePercent: number;
  mercadoPago: boolean;
  paymentWindowMinutes: number;
}

export interface PublicOrder {
  id: string;
  status: 'PENDING' | 'PAID' | 'PENDING_APPROVAL' | 'REJECTED' | 'EXPIRED' | 'REFUNDED';
  totalAmount: number;
  paymentMethod: string;
  customerName: string;
  event: { id: string; title: string; date: string; location: string; paymentInstructions: string | null } | null;
  tickets: { code: string; batch: string; seat: string | null; isUsed: boolean; qrCode: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/orders`;

  readonly config$ = this.http.get<CheckoutConfig>(`${this.apiUrl}/config`).pipe(shareReplay(1));

  createOrder(orderData: any): Observable<any> {
    return this.http.post(this.apiUrl, orderData);
  }

  validatePromo(code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/validate-promo`, { code });
  }

  getOrder(id: string, paymentId?: string | null): Observable<PublicOrder> {
    const params: Record<string, string> = {};
    if (paymentId) params['payment_id'] = paymentId;
    return this.http.get<PublicOrder>(`${this.apiUrl}/${id}/estado`, { params });
  }
}
