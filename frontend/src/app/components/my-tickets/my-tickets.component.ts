import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { Observable, map, shareReplay, catchError, of } from 'rxjs';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-tickets.component.html',
  styleUrls: ['./my-tickets.component.css']
})
export class MyTicketsComponent {
  private http = inject(HttpClient);

  // Create a shared observable for the tickets data
  private ticketsRequest$ = this.http.get<any[]>('http://localhost:3000/tickets/my').pipe(
    shareReplay(1),
    catchError(err => {
      console.error('Error fetching tickets', err);
      return of([]);
    })
  );

  loading$ = this.ticketsRequest$.pipe(map(t => false), catchError(() => of(false))); // Simple loader trigger

  validTickets$: Observable<any[]> = this.ticketsRequest$.pipe(
    map(tickets => {
      const now = new Date();
      return tickets.filter(t => {
        if (t.isUsed) return false;
        if (!t.batch?.event?.date) return true;
        return new Date(t.batch.event.date) > now;
      });
    })
  );

  pastTickets$: Observable<any[]> = this.ticketsRequest$.pipe(
    map(tickets => {
      const now = new Date();
      return tickets.filter(t => {
        if (t.isUsed) return true;
        if (!t.batch?.event?.date) return false;
        return new Date(t.batch.event.date) <= now;
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
