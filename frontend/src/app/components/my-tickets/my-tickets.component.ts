import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { Observable, map, shareReplay, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EVENT_PLACEHOLDER } from '../../shared/catalog';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-tickets.component.html',
  styleUrls: ['./my-tickets.component.css']
})
export class MyTicketsComponent {
  private http = inject(HttpClient);
  placeholder = EVENT_PLACEHOLDER;

  // Create a shared observable for the tickets data
  private ticketsRequest$ = this.http.get<any[]>(`${environment.apiUrl}/tickets/my`).pipe(
    shareReplay(1),
    catchError(() => of([]))
  );

  loading$ = this.ticketsRequest$.pipe(map(t => false), catchError(() => of(false))); // Simple loader trigger

  validTickets$: Observable<any[]> = this.ticketsRequest$.pipe(
    map(tickets => {
      const now = new Date();
      return tickets.filter(t => {
        if (t.isUsed || t.order?.status === 'REFUNDED') return false;
        const end = t.batch?.event?.endDate || t.batch?.event?.date;
        return !end || new Date(end) > now;
      });
    })
  );

  pastTickets$: Observable<any[]> = this.ticketsRequest$.pipe(
    map(tickets => {
      const now = new Date();
      return tickets.filter(t => {
        if (t.isUsed || t.order?.status === 'REFUNDED') return true;
        const end = t.batch?.event?.endDate || t.batch?.event?.date;
        return !!end && new Date(end) <= now;
      });
    })
  );

  selectedTicket: any = null;

  openQrModal(ticket: any) {
    this.selectedTicket = ticket;
  }

  closeQrModal() {
    this.selectedTicket = null;
  }
}
