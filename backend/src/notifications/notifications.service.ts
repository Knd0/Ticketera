import { Injectable, Inject, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { WhatsAppProvider } from './whatsapp/whatsapp.provider';

export interface TicketsEmail {
  to: string;
  customerName: string;
  orderId: string;
  eventTitle: string;
  eventDate: Date | string | null;
  eventLocation: string | null;
  tickets: { code: string; label: string; qrCode: string }[];
}

const escapeHtml = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Envío de entradas por mail con Resend (RESEND_API_KEY). Antes se usaba una
 * cuenta de prueba de Ethereal: los mails nunca llegaban a nadie. Sin la clave
 * no se envía nada y se avisa en el log; las entradas igual se ven en la
 * página de la orden.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject('WhatsAppProvider') private whatsappProvider: WhatsAppProvider) {}

  async generateQRCode(text: string): Promise<string> {
    return QRCode.toDataURL(text, { margin: 1, width: 360 });
  }

  buildTicketsEmail(data: TicketsEmail) {
    const brand = process.env.BRAND_NAME || 'Ticketera';
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:4220').replace(/\/$/, '');
    const when = data.eventDate
      ? new Date(data.eventDate).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
      : '';
    const blocks = data.tickets.map((t, i) => `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
        <div style="font-size:14px;color:#6b7280">Entrada ${i + 1} de ${data.tickets.length}${t.label ? ` · ${escapeHtml(t.label)}` : ''}</div>
        <img src="cid:qr-${i}" alt="Código QR de la entrada" width="220" height="220" style="margin:12px auto;display:block" />
        <div style="font-family:monospace;font-size:12px;color:#6b7280">${escapeHtml(t.code)}</div>
      </div>`).join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827">
        <h1 style="font-size:22px">¡Listo, ${escapeHtml(data.customerName.split(' ')[0] || '')}! Estas son tus entradas</h1>
        <p style="font-size:16px;margin:4px 0"><strong>${escapeHtml(data.eventTitle)}</strong></p>
        ${when ? `<p style="margin:4px 0;color:#374151">${escapeHtml(when)}</p>` : ''}
        ${data.eventLocation ? `<p style="margin:4px 0;color:#374151">${escapeHtml(data.eventLocation)}</p>` : ''}
        <p style="color:#374151">Mostrá cada código QR en la entrada, desde el celular o impreso. Cada QR vale para un solo ingreso: no lo compartas.</p>
        ${blocks}
        <p style="color:#374151">También podés verlas en <a href="${frontend}/checkout/resultado?orden=${data.orderId}">tu orden</a>.</p>
        <p style="font-size:12px;color:#9ca3af">${escapeHtml(brand)} · Orden ${escapeHtml(data.orderId)}</p>
      </div>`;

    const attachments = data.tickets.map((t, i) => ({
      filename: `entrada-${i + 1}.png`,
      content: t.qrCode.replace(/^data:image\/png;base64,/, ''),
      content_id: `qr-${i}`,
    }));

    return {
      from: process.env.MAIL_FROM || `${brand} <onboarding@resend.dev>`,
      to: [data.to],
      subject: `Tus entradas para ${data.eventTitle}`,
      html,
      attachments,
    };
  }

  async sendTicketsEmail(data: TicketsEmail): Promise<boolean> {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      this.logger.warn(`RESEND_API_KEY no está configurada: no se envió el mail de la orden ${data.orderId} a ${data.to}.`);
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildTicketsEmail(data)),
    });
    if (!res.ok) {
      throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return true;
  }

  async sendTicketWhatsApp(to: string, eventName: string, qrCodeDataUrl: string) {
    await this.whatsappProvider.sendMessage(to, `Tu entrada para ${eventName}`, qrCodeDataUrl);
  }
}
