import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  imageUrl?: string;
  batches?: any[];
  producer?: {
    organizationName?: string;
    fullName: string;
    profileImageUrl?: string;
    description?: string;
    website?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/events';

  getEvents(category?: string): Observable<Event[]> {
    let url = this.apiUrl;
    if (category) {
        url += `?category=${category}`;
    }
    return this.http.get<Event[]>(url);
  }

  getEvent(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.apiUrl}/${id}`);
  }

  createEvent(eventData: any): Observable<Event> {
    return this.http.post<Event>(this.apiUrl, eventData);
  }
}
