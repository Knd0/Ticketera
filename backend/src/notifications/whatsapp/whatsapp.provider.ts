export interface WhatsAppProvider {
  sendMessage(to: string, message: string, mediaUrl?: string): Promise<any>;
}
