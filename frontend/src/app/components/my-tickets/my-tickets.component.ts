import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container" style="margin-top: 3rem;">
      <h2>My Tickets</h2>
      
      <div *ngIf="tickets$ | async as tickets; else loading">
         <div *ngIf="tickets.length === 0">
            <p>You haven't bought any tickets yet.</p>
         </div>

         <div class="tickets-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            <div class="ticket-card" *ngFor="let ticket of tickets" style="border: 1px solid #ddd; padding: 20px; border-radius: 8px; text-align: center;">
                
                <h3 style="margin-bottom: 5px;">{{ ticket.batch?.event?.title || 'Unknown Event' }}</h3>
                <p style="color: #666; margin-bottom: 5px;">{{ ticket.batch?.event?.date | date:'mediumDate' }}</p>
                <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9rem;">
                    {{ ticket.batch?.name }}
                </span>

                <div class="qr-code" style="margin-top: 20px;">
                    <img *ngIf="ticket.qrCode" [src]="ticket.qrCode" alt="QR Code" style="width: 200px; height: 200px;">
                    <p *ngIf="!ticket.qrCode" style="color: red;">QR not available</p>
                </div>
            </div>
         </div>
      </div>

      <ng-template #loading>
        <p>Loading tickets...</p>
      </ng-template>
    </div>
  `
})
export class MyTicketsComponent {
  http = inject(HttpClient);
  
  tickets$: Observable<any[]> = this.http.get<any[]>('http://localhost:3000/tickets/my');
}
