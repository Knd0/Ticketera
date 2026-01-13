import { Injectable, inject } from '@angular/core';
import { Observable, of, delay, switchMap, map, catchError } from 'rxjs';
import { EventsService } from './events.service';

export interface ChatMessage {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  actions?: { label: string, value: string }[]; // Optional quick actions
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private searchState = {
    results: [] as any[],
    currentIndex: 0,
    keyword: ''
  };

  private eventsService = inject(EventsService);

  constructor() { }

  getResponse(userMessage: string): Observable<ChatMessage> {
    const msg = userMessage.toLowerCase();
    
    // Default config
    let responseText = "I'm not sure I understand. Try asking for 'events' or 'help'.";
    let actions: any[] | undefined = undefined;

    // 0. Handle "Show More" Intent
    if (msg === 'show_more_results') {
        return this.getNextPage();
    }

    // 1. Precise Cleaners for Intent
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hola')) {
        return of({
            text: "Hello! 👋 I'm your Ticketera assistant. I can help you find events. Try saying 'Find Rock concerts'!",
            sender: 'bot' as const,
            timestamp: new Date(),
            actions: [
                { label: 'Browse Events', value: 'events' },
                { label: 'My Tickets', value: 'tickets' }
            ]
        }).pipe(delay(500));
    } 
    
    // 2. Search Intent
    const isSearch = msg.includes('find') || msg.includes('search') || msg.includes('busc') || msg.length > 3;

    if (isSearch && !msg.includes('ticket') && !msg.includes('login')) {
        // Reset State
        let keyword = msg.replace('find', '').replace('search', '').replace('for', '').trim();
        if (keyword.length < 2) keyword = msg; 

        return this.eventsService.getEvents(undefined, keyword).pipe(
            map(events => {
                // Initialize State
                this.searchState = {
                    results: events,
                    currentIndex: 0,
                    keyword: keyword
                };
                return this.getNextPageResponse();
            }),
            catchError(() => of({
                text: "I'm having trouble connecting to the event database. Please try again later.",
                sender: 'bot' as const,
                timestamp: new Date()
            }))
        );
    }

    // 3. Other Intents
    if (msg.includes('ticket') || msg.includes('compra')) {
        if (msg.includes('not showing') || msg.includes('where')) {
             responseText = "You can find your purchased tickets in the 'My Tickets' section.";
             actions = [{ label: 'Go to My Tickets', value: '/my-tickets' }];
        } else {
             responseText = "To buy a ticket, just click on any event you like!";
             actions = [{ label: 'Browse Events', value: '/' }];
        }
    }
    else if (msg.includes('login')) {
        responseText = "You can log in or register here:";
        actions = [
            { label: 'Log In', value: '/login' },
            { label: 'Register', value: '/register' }
        ];
    }
    
    return of({
        text: responseText,
        sender: 'bot' as const,
        timestamp: new Date(),
        actions: actions
    }).pipe(delay(500));
  }

  private getNextPage(): Observable<ChatMessage> {
      return of(this.getNextPageResponse()).pipe(delay(500));
  }

  private getNextPageResponse(): ChatMessage {
      const { results, currentIndex, keyword } = this.searchState;
      const PAGE_SIZE = 3;
      
      if (results.length === 0) {
          return {
            text: `I couldn't find any events matching "${keyword}". 😕`,
            sender: 'bot',
            timestamp: new Date(),
            actions: [{ label: 'Browse All Events', value: '/' }]
        };
      }

      const nextBatch = results.slice(currentIndex, currentIndex + PAGE_SIZE);
      const remaining = results.length - (currentIndex + PAGE_SIZE);
      
      const eventActions = nextBatch.map(e => ({
          label: `🎫 ${e.title}`,
          value: `/event/${e.id}`
      }));

      // If we have more, add "Show More" button
      if (remaining > 0) {
          eventActions.push({ label: `Show More (${remaining} left)`, value: 'show_more_results' }); // Special value
      } else {
          eventActions.push({ label: 'Start New Search', value: 'events' });
      }

      // Update Index for next time
      this.searchState.currentIndex += PAGE_SIZE;

      return {
          text: `Found ${results.length} events for "${keyword}". Showing ${nextBatch.length}:`,
          sender: 'bot',
          timestamp: new Date(),
          actions: eventActions
      };
  }
}
