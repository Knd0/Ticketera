import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  eventsService = inject(EventsService);
  events$: Observable<Event[]> = this.eventsService.getEvents();

  filterCategory(category: string) {
      this.events$ = this.eventsService.getEvents(category === 'All' ? undefined : category);
  }
}
