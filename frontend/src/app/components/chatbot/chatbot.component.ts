import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent {
  isOpen = false;
  messages: ChatMessage[] = [];
  userInput = '';
  isTyping = false;
  hasUnread = false;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  chatbotService = inject(ChatbotService);
  router = inject(Router);

  ngOnInit() {
    // Initial greeting
    this.addBotMessage("Hi there! 👋 I'm your BI-Tickets assistant. How can I help you?", [
        { label: 'Browse Events', value: '/' },
        { label: 'My Tickets', value: '/my-tickets' }
    ]);
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
        this.hasUnread = false;
        this.scrollToBottom();
    }
  }

  sendMessage() {
    if (!this.userInput.trim()) return;

    const text = this.userInput;
    this.userInput = '';
    
    // Add User Message
    this.messages.push({ text, sender: 'user', timestamp: new Date() });
    this.scrollToBottom();

    this.isTyping = true;

    // Get Bot Response
    this.chatbotService.getResponse(text).subscribe(response => {
        this.isTyping = false;
        this.messages.push(response);
        this.scrollToBottom();
        
        if (!this.isOpen) {
            this.hasUnread = true;
        }
    });
  }

  handleAction(value: string) {
      if (value.startsWith('/')) {
          this.router.navigate([value]);
      } else {
          // If value is a keyword, send it as a message
          this.userInput = value; // Or map values to nice text
          if (value === 'events') this.userInput = 'Browse Events';
          if (value === 'tickets') this.userInput = 'My Tickets';
          if (value === 'support') this.userInput = 'Support';
          this.sendMessage();
      }
  }

  addBotMessage(text: string, actions?: any[]) {
      this.messages.push({
          text,
          sender: 'bot', 
          timestamp: new Date(),
          actions
      });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
        if (this.scrollContainer) {
            this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
    }, 50);
  }
}
