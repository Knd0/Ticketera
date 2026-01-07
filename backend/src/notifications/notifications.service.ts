import { Injectable, Inject } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as nodemailer from 'nodemailer';
import { WhatsAppProvider } from './whatsapp/whatsapp.provider';

@Injectable()
export class NotificationsService {
  private transporter;

  constructor(@Inject('WhatsAppProvider') private whatsappProvider: WhatsAppProvider) {
    // Using Ethereal for testing - logs email URL to console
    // In production, User would provide real SMTP credentials
    this.createTestAccount();
  }

  async createTestAccount() {
    const testAccount = await nodemailer.createTestAccount();
    this.transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Email Service Initiated with Ethereal');
  }

  async generateQRCode(text: string): Promise<string> {
    // Generate Data URL for image (base64)
    return QRCode.toDataURL(text);
  }

  async sendTicketEmail(to: string, ticketCode: string, qrCodeDataUrl: string) {
    if (!this.transporter) await this.createTestAccount();

    const info = await this.transporter.sendMail({
      from: '"Ticketera" <no-reply@ticketera.com>',
      to: to,
      subject: 'Your Ticket is Here!',
      html: `
        <h1>Ticket Purchased!</h1>
        <p>Here is your ticket code: <strong>${ticketCode}</strong></p>
        <p>Show this QR code at the entrance:</p>
        <img src="cid:unique@qr.code" alt="Ticket QR" />
      `,
      attachments: [
        {
            filename: 'ticket-qr.png',
            path: qrCodeDataUrl,
            cid: 'unique@qr.code' // same cid value as in the html img src
        }
      ]
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return nodemailer.getTestMessageUrl(info);
  }

  async sendTicketWhatsApp(to: string, eventName: string, qrCodeDataUrl: string) {
      const message = `Here is your ticket for ${eventName}`;
      await this.whatsappProvider.sendMessage(to, message, qrCodeDataUrl);
  }
}
