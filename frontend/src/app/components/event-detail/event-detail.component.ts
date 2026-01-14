import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventsService, Event } from '../../services/events.service';
import { SeatSelectorComponent } from './seat-selector/seat-selector';
import { Observable, switchMap } from 'rxjs';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SeatSelectorComponent],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.css'
})
export class EventDetailComponent {
  route = inject(ActivatedRoute);
  eventsService = inject(EventsService);
  
  event: any = null; // Store event data for access in methods
  
  event$: Observable<Event> = this.route.paramMap.pipe(
    switchMap(params => this.eventsService.getEvent(params.get('id')!))
  );

  constructor() {
      // Subscribe to save event data locally
      this.event$.subscribe(ev => this.event = ev);
  }

  selectedBatchId: string | null = null;
  selectedBatch: any = null;
  quantity: number = 1;
  selectedSeats: any[] = [];

  selectBatch(batchId: string) {
    const batch = this.event?.batches?.find((b: any) => b.id === batchId);
    if (batch && this.isSoldOut(batch)) return;
    
    this.selectedBatchId = batchId;
    this.selectedBatch = batch;
    this.selectedSeats = [];
    this.quantity = 1;
  }
  
  onSeatsSelected(seats: any[]) {
      this.selectedSeats = seats;
      this.quantity = seats.length;
  }

  isSoldOut(batch: any): boolean {
      if (batch.isManualSoldOut) return true;
      // If we had remainingQuantity property:
      if (batch.totalQuantity && batch.soldQuantity && (batch.totalQuantity - batch.soldQuantity <= 0)) {
          return true;
      }
      return false;
  }

  increment() { this.quantity++; }
  decrement() { if (this.quantity > 1) this.quantity--; }

  // Expose JSON for template
  JSON = JSON;

  shareEvent() {
      if (this.event && navigator.share) {
          navigator.share({
              title: this.event.title,
              text: `Check out ${this.event.title} on Ticketera!`,
              url: window.location.href
          }).catch(console.error);
      } else {
          navigator.clipboard.writeText(window.location.href).then(() => {
              alert('Link copied to clipboard!'); 
          });
      }
  }
}
