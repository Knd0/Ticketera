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
    this.addBotMessage('¡Hola! ¿Buscás un evento o tenés una duda con tu compra?', [
        { label: 'Ver eventos', value: '/' },
        { label: 'Mis entradas', value: '/my-tickets' },
        { label: 'No me llegaron las entradas', value: 'no me llegaron' },
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
      if (value.startsWith('http') || value.startsWith('mailto:')) {
          window.open(value, '_blank', 'noopener');
      } else if (value.startsWith('/')) {
          this.router.navigateByUrl(value);
          this.isOpen = false;
      } else {
          this.userInput = value;
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
