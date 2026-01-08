import { Component, inject, ChangeDetectorRef } from '@angular/core';
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
  cdr = inject(ChangeDetectorRef);
  
  categories = [
    { name: 'Concert', icon: '🎤' },
    { name: 'Theater', icon: '🎭' },
    { name: 'Party', icon: '🎉' },
    { name: 'Sports', icon: '⚽' }
  ];

  events$ = this.eventsService.getEvents();
  
  featuredEvents: Event[] = [];
  feedEvents: Event[] = [];

  ngOnInit() {
      this.loadEvents();
  }

  loadEvents(category?: string) {
      this.eventsService.getEvents(category === 'Redo' ? undefined : category).subscribe({
          next: (events) => {
              // Mock "Top Selling": Take first 2 as featured
              this.featuredEvents = events.slice(0, 2);
              this.feedEvents = events.slice(2);
              this.cdr.detectChanges(); // Force update
          },
          error: (err) => console.error('Error loading events', err)
      });
  }

  filterCategory(category: string) {
      this.loadEvents(category);
  }
}
