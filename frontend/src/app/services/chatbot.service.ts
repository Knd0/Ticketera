import { Injectable, inject } from '@angular/core';
import { Observable, of, delay, map, catchError } from 'rxjs';
import { EventsService } from './events.service';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  actions?: { label: string, value: string }[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const has = (msg: string, ...words: string[]) => words.some(w => msg.includes(w));

/**
 * Asistente de ayuda: responde las preguntas frecuentes y busca eventos por
 * nombre. Funciona con reglas simples (no es una IA) y todo en castellano.
 */
@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private eventsService = inject(EventsService);
  private searchState = { results: [] as any[], currentIndex: 0, keyword: '' };

  private reply(text: string, actions?: { label: string; value: string }[]): Observable<ChatMessage> {
    return of({ text, sender: 'bot' as const, timestamp: new Date(), actions }).pipe(delay(400));
  }

  private contactActions() {
    const actions: { label: string; value: string }[] = [];
    if (environment.contactWhatsapp) actions.push({ label: 'Escribir por WhatsApp', value: `https://wa.me/${environment.contactWhatsapp.replace(/\D/g, '')}` });
    if (environment.contactEmail) actions.push({ label: 'Mandar un email', value: `mailto:${environment.contactEmail}` });
    return actions;
  }

  getResponse(userMessage: string): Observable<ChatMessage> {
    const msg = norm(userMessage);

    if (msg === 'show_more_results') return of(this.getNextPageResponse()).pipe(delay(300));

    if (has(msg, 'hola', 'buenas', 'buen dia')) {
      return this.reply('¡Hola! Puedo buscarte eventos o ayudarte con tu compra. ¿Qué necesitás?', [
        { label: 'Ver eventos', value: '/' },
        { label: 'Mis entradas', value: '/my-tickets' },
        { label: 'No me llegaron las entradas', value: 'no me llegaron' },
      ]);
    }
    if (has(msg, 'no me llego', 'no me llegaron', 'no llego', 'mail', 'correo')) {
      return this.reply('Las entradas llegan al email que pusiste al comprar, en unos minutos. Revisá spam y promociones. Si pagaste con Mercado Pago, también las ves desde el link "tu orden" del mail. Si reservaste por transferencia, llegan cuando el organizador confirma el pago.', [
        { label: 'Mis entradas', value: '/my-tickets' }, ...this.contactActions(),
      ]);
    }
    if (has(msg, 'transfer', 'efectivo', 'alias', 'cbu')) {
      return this.reply('Si el evento acepta transferencia, al reservar te mostramos el alias o CBU del organizador. Cuando él confirma que recibió el pago, te mandamos las entradas por email.');
    }
    if (has(msg, 'mercado pago', 'tarjeta', 'pagar', 'pago', 'cuotas')) {
      return this.reply('Con Mercado Pago podés pagar con tarjeta de crédito, débito o dinero en cuenta. Apenas se aprueba el pago, las entradas aparecen en pantalla y te llegan por email.');
    }
    if (has(msg, 'devol', 'reembolso', 'reintegro', 'cancel')) {
      return this.reply('Las devoluciones las decide el organizador del evento. Escribile con tu número de orden y te responde.', this.contactActions());
    }
    if (has(msg, 'qr', 'entrada', 'ticket', 'mis entradas')) {
      return this.reply('Tus entradas tienen un código QR que se escanea en la puerta. Cada QR sirve para un solo ingreso, así que no lo compartas.', [
        { label: 'Mis entradas', value: '/my-tickets' },
      ]);
    }
    if (has(msg, 'ingresar', 'login', 'cuenta', 'registr', 'contrasena')) {
      return this.reply('Podés comprar sin cuenta. Si creás una, tus entradas quedan guardadas en "Mis entradas".', [
        { label: 'Ingresar', value: '/login' }, { label: 'Crear cuenta', value: '/register' },
      ]);
    }
    if (has(msg, 'vender', 'productor', 'organizo', 'organizar', 'publicar')) {
      return this.reply('¿Organizás eventos? Creá una cuenta de productor: publicás el evento en minutos, cobrás con Mercado Pago o transferencia y controlás el ingreso con el celular.', [
        { label: 'Crear cuenta de productor', value: '/register' },
      ]);
    }
    if (has(msg, 'contacto', 'ayuda', 'soporte', 'humano', 'persona')) {
      const actions = this.contactActions();
      return this.reply(actions.length ? 'Te dejo cómo contactarnos:' : 'Contale tu consulta al organizador del evento; sus datos están en la página del evento.', actions);
    }

    // Cualquier otra cosa: se busca como nombre de evento.
    const keyword = userMessage.replace(/\b(busco|buscar|eventos?|de|para)\b/gi, '').trim() || userMessage.trim();
    return this.eventsService.getEvents(undefined, keyword).pipe(
      map(events => {
        this.searchState = { results: events, currentIndex: 0, keyword };
        return this.getNextPageResponse();
      }),
      catchError(() => of({ text: 'No pude buscar eventos en este momento. Probá de nuevo en un rato.', sender: 'bot' as const, timestamp: new Date() })),
      delay(300),
    );
  }

  private getNextPageResponse(): ChatMessage {
    const { results, currentIndex, keyword } = this.searchState;
    const PAGE_SIZE = 3;

    if (results.length === 0) {
      return {
        text: `No encontré eventos para "${keyword}". Probá con otra palabra o mirá la cartelera completa.`,
        sender: 'bot',
        timestamp: new Date(),
        actions: [{ label: 'Ver todos los eventos', value: '/' }],
      };
    }

    const page = results.slice(currentIndex, currentIndex + PAGE_SIZE);
    const remaining = results.length - (currentIndex + PAGE_SIZE);
    const actions = page.map(e => ({ label: `🎫 ${e.title}`, value: `/event/${e.id}` }));
    if (remaining > 0) actions.push({ label: `Ver más (${remaining})`, value: 'show_more_results' });
    this.searchState.currentIndex += PAGE_SIZE;

    return {
      text: currentIndex === 0 ? `Encontré ${results.length} ${results.length === 1 ? 'evento' : 'eventos'}:` : 'Más resultados:',
      sender: 'bot',
      timestamp: new Date(),
      actions,
    };
  }
}
