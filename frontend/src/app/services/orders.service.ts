import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/orders';

  createOrder(orderData: any): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };
    return this.http.post(this.apiUrl, orderData, { headers });
  }

  validatePromo(code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/validate-promo`, { code });
  }
}
