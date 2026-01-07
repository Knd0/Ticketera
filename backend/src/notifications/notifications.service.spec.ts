import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { MockWhatsAppProvider } from './whatsapp/mock-whatsapp.provider';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let whatsappProvider: MockWhatsAppProvider;

  beforeEach(async () => {
    whatsappProvider = new MockWhatsAppProvider();
    
    // Create a mock for nodemailer to avoid actual network calls or Ethereal setup in unit tests
    // However, existing service creates transporter in constructor. Ideally we mock it.
    // We will rely on the service logic but maybe validation of generateQRCode for now.
    
    // Ideally, refactor Service to inject Transporter or use a Provider.
    // For this test, we test QR generation which is pure logic mainly.

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: 'WhatsAppProvider', useValue: whatsappProvider }
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should generate a QR code data URL', async () => {
    const text = 'test-token';
    const qr = await service.generateQRCode(text);
    expect(qr).toBeDefined();
    expect(typeof qr).toBe('string');
    expect(qr).toContain('data:image/png;base64');
  });

  // Spy test for WhatsApp
  it('should call WhatsApp provider with correct params', async () => {
     const spy = jest.spyOn(whatsappProvider, 'sendMessage');
     await service.sendTicketWhatsApp('123456', 'My Event', 'data:image...');
     expect(spy).toHaveBeenCalledWith('123456', expect.stringContaining('My Event'), 'data:image...');
  });
});
