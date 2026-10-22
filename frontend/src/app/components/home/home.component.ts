import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { CATEGORIES, EVENT_PLACEHOLDER, categoryLabel, isSoldOut, minPrice } from '../../shared/catalog';

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
  
  categories = CATEGORIES;
  categoryLabel = categoryLabel;
  minPrice = minPrice;
  isSoldOut = isSoldOut;
  placeholder = EVENT_PLACEHOLDER;
  selectedCategory?: string;
  loaded = false;
  
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
      this.selectedCategory = category;
      this.eventsService.getEvents(category).subscribe({
          next: (events) => {
              this.loaded = true;
              this.currentSlide = 0;
              // Top 6 as featured for carousel (Full Width)
              this.featuredEvents = events.slice(0, 6);
              // Show ALL events in the feed as requested
              this.feedEvents = events;
              
              this.startAutoPlay();
              this.cdr.detectChanges();
          },
          error: () => { this.loaded = true; this.cdr.detectChanges(); }
      });
  }

  filterCategory(category?: string) {
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
      if (this.featuredEvents.length < 2) return;
      this.autoPlayInterval = setInterval(() => {
          this.currentSlide = (this.currentSlide + 1) % this.featuredEvents.length;
          this.cdr.detectChanges();
      }, 5000);
  }
}
