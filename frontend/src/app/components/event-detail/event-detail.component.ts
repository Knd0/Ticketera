import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventsService, Event } from '../../services/events.service';
import { SeatSelectorComponent } from './seat-selector/seat-selector';
import { NotifyService } from '../../services/notify.service';
import { AVATAR_PLACEHOLDER, EVENT_PLACEHOLDER, categoryLabel } from '../../shared/catalog';

const MAX_PER_ORDER = 10;

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SeatSelectorComponent],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.css'
})
export class EventDetailComponent {
  private route = inject(ActivatedRoute);
  private eventsService = inject(EventsService);
  private notify = inject(NotifyService);

  event: any = null;
  state: 'loading' | 'ready' | 'not-found' | 'error' = 'loading';
  placeholder = EVENT_PLACEHOLDER;
  avatarPlaceholder = AVATAR_PLACEHOLDER;
  categoryLabel = categoryLabel;

  selectedBatchId: string | null = null;
  selectedBatch: any = null;
  quantity = 1;
  selectedSeats: any[] = [];

  constructor() {
    this.route.paramMap.subscribe(params => this.load(params.get('id')!));
  }

  load(id: string) {
    this.state = 'loading';
    this.eventsService.getEvent(id).subscribe({
      next: (ev: Event) => { this.event = ev; this.state = 'ready'; },
      error: (err) => { this.state = err?.status === 404 || err?.status === 400 ? 'not-found' : 'error'; },
    });
  }

  get isPast(): boolean {
    const end = this.event?.endDate || this.event?.date;
    return !!end && new Date(end) < new Date();
  }

  available(batch: any): number {
    return Math.max(0, (batch.totalQuantity ?? 0) - (batch.soldQuantity ?? 0));
  }

  salesClosed(batch: any): boolean {
    return !!batch.salesEndDate && new Date(batch.salesEndDate) < new Date();
  }

  isSoldOut(batch: any): boolean {
    return !!batch.isManualSoldOut || this.available(batch) <= 0;
  }

  canBuy(batch: any): boolean {
    return !this.isPast && !this.isSoldOut(batch) && !this.salesClosed(batch);
  }

  selectBatch(batch: any) {
    if (!this.canBuy(batch)) return;
    this.selectedBatchId = batch.id;
    this.selectedBatch = batch;
    this.selectedSeats = [];
    this.quantity = 1;
  }

  onSeatsSelected(seats: any[]) {
    this.selectedSeats = seats;
    this.quantity = seats.length;
  }

  get maxQuantity(): number {
    return this.selectedBatch ? Math.min(MAX_PER_ORDER, this.available(this.selectedBatch)) : MAX_PER_ORDER;
  }

  get subtotal(): number {
    return this.selectedBatch ? Number(this.selectedBatch.price) * this.quantity : 0;
  }

  increment() { if (this.quantity < this.maxQuantity) this.quantity++; }
  decrement() { if (this.quantity > 1) this.quantity--; }

  get checkoutParams() {
    return {
      eventId: this.event?.id,
      batchId: this.selectedBatchId,
      quantity: this.quantity,
      seats: this.selectedSeats.length ? JSON.stringify(this.selectedSeats.map(s => ({ id: s.id, row: s.row, number: s.number }))) : null,
    };
  }

  get readyToBuy(): boolean {
    return !!this.selectedBatchId && (!this.selectedBatch?.hasSeating || this.selectedSeats.length > 0);
  }

  shareEvent() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: this.event.title, text: `Mirá este evento: ${this.event.title}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => this.notify.toast('Link copiado'));
    }
  }
}
