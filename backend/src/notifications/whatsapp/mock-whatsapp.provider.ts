import { Injectable } from '@nestjs/common';
import { WhatsAppProvider } from './whatsapp.provider';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(to: string, message: string, mediaUrl?: string): Promise<any> {
    console.log(`[WhatsApp Mock] Sending to ${to}: ${message}`);
    if (mediaUrl) console.log(`[WhatsApp Mock] Media Attached: ${mediaUrl}`);
    return { success: true, messageId: 'mock-wa-id-' + Date.now() };
  }
}
