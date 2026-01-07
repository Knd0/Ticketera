import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventsService, Event } from '../../services/events.service';
import { Observable, switchMap } from 'rxjs';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.css'
})
export class EventDetailComponent {
  route = inject(ActivatedRoute);
  eventsService = inject(EventsService);
  
  event$: Observable<Event> = this.route.paramMap.pipe(
    switchMap(params => this.eventsService.getEvent(params.get('id')!))
  );

  selectedBatchId: string | null = null;
  quantity: number = 1;

  selectBatch(batchId: string) {
    this.selectedBatchId = batchId;
  }

  increment() { this.quantity++; }
  decrement() { if (this.quantity > 1) this.quantity--; }
}
