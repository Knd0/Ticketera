import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SERVICE_FEE_RATE } from '../orders/orders.service';
import { ConsoleSummary, ConsoleTenant, ConsoleTenantStatus } from './console.contract';

/**
 * En Ticketera los clientes son los productores. No pagan abono: la plataforma
 * cobra un cargo por servicio sobre cada venta. Por eso el "importe mensual" es
 * lo que generó ese cargo en los últimos 30 días.
 */
@Injectable()
export class ConsoleService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async summary(): Promise<ConsoleSummary> {
    const producers = await this.users.find({ where: { role: 'producer' } });

    const [events, sales] = await Promise.all([
      this.users.query(`SELECT "producerId" AS "producerId", COUNT(*)::int AS total FROM "event" GROUP BY "producerId"`),
      this.users.query(`
        SELECT e."producerId" AS "producerId",
               COALESCE(SUM(oi.price * oi.quantity), 0)::float AS subtotal,
               COALESCE(SUM(oi.quantity), 0)::int AS entradas
        FROM "order_item" oi
        JOIN "order" o ON o.id = oi."orderId"
        JOIN "batch" b ON b.id = oi."batchId"
        JOIN "event" e ON e.id = b."eventId"
        WHERE o.status = 'PAID' AND o."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY e."producerId"`),
    ]);
    const eventsBy = new Map<string, number>(events.map((r: any) => [r.producerId, r.total]));
    const salesBy = new Map<string, { subtotal: number; entradas: number }>(sales.map((r: any) => [r.producerId, r]));

    const tenants: ConsoleTenant[] = producers.map((p) => {
      const s = salesBy.get(p.id);
      const status: ConsoleTenantStatus = p.isSuspended ? 'suspended' : 'active';
      return {
        id: p.id,
        name: p.organizationName || p.fullName || p.username,
        email: p.email ?? null,
        plan: 'comisión',
        status,
        monthlyAmount: status === 'active' && s ? Math.round(s.subtotal * SERVICE_FEE_RATE) : 0,
        expiresAt: null,
        createdAt: null,
        usage: { eventos: eventsBy.get(p.id) ?? 0, entradas: s?.entradas ?? 0 },
      };
    });

    return {
      product: 'ticketera',
      displayName: 'Ticketera',
      sector: 'Eventos',
      currency: 'ARS',
      generatedAt: new Date().toISOString(),
      tenants,
    };
  }

  async setSuspended(id: string, suspended: boolean): Promise<{ id: string; status: ConsoleTenantStatus }> {
    const result = await this.users.update({ id, role: 'producer' }, { isSuspended: suspended });
    if (!result.affected) throw new NotFoundException('Productor no encontrado');
    return { id, status: suspended ? 'suspended' : 'active' };
  }
}
