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

  // Carousel State
  currentSlide = 0;
  autoPlayInterval: any;

  ngOnInit() {
      this.loadEvents();
  }

  ngOnDestroy() {
      if (this.autoPlayInterval) {
          clearInterval(this.autoPlayInterval);
      }
  }

  loadEvents(category?: string) {
      this.eventsService.getEvents(category === 'Redo' ? undefined : category).subscribe({
          next: (events) => {
              // Top 6 as featured for carousel (Full Width)
              this.featuredEvents = events.slice(0, 6);
              // Show ALL events in the feed as requested
              this.feedEvents = events;
              
              this.startAutoPlay();
              this.cdr.detectChanges();
          },
          error: (err) => console.error('Error loading events', err)
      });
  }

  filterCategory(category: string) {
      this.loadEvents(category);
  }

  // Carousel Methods
  nextSlide() {
      this.currentSlide = (this.currentSlide + 1) % this.featuredEvents.length;
      this.resetAutoPlay();
  }

  prevSlide() {
      this.currentSlide = (this.currentSlide - 1 + this.featuredEvents.length) % this.featuredEvents.length;
      this.resetAutoPlay();
  }

  setSlide(index: number) {
      this.currentSlide = index;
      this.resetAutoPlay();
  }

  startAutoPlay() {
      this.resetAutoPlay();
  }

  resetAutoPlay() {
      if (this.autoPlayInterval) {
          clearInterval(this.autoPlayInterval);
      }
      // Auto-advance every 5 seconds
      this.autoPlayInterval = setInterval(() => {
          this.currentSlide = (this.currentSlide + 1) % this.featuredEvents.length;
          this.cdr.detectChanges();
      }, 5000);
  }
}
