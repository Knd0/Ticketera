import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

import { MockWhatsAppProvider } from './whatsapp/mock-whatsapp.provider';

@Module({
  providers: [
    NotificationsService,
    {
      provide: 'WhatsAppProvider',
      useClass: MockWhatsAppProvider
    }
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
