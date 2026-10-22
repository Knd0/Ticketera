import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Batch } from './batch.entity';
import { User } from '../users/user.entity';
import { Seat } from './seat.entity';

/** Medios de pago que puede ofrecer un evento. */
export const PAYMENT_METHODS = ['MercadoPago', 'Cash / Bank Transfer'] as const;

/** Campos del evento que el productor puede escribir. El resto (id, productor, fechas de sistema) no. */
const EVENT_FIELDS = ['title', 'description', 'location', 'date', 'endDate', 'category', 'isVisible', 'imageUrl', 'paymentMethods', 'paymentInstructions'] as const;
const MAX_SEATS_PER_BATCH = 5000;

/**
 * Datos del productor que se pueden mostrar al público. Antes `event.producer`
 * salía completo en GET /events: email, teléfono, DNI y CUIT de cada productor.
 */
export function publicProducer(p: Partial<User> | null | undefined) {
  if (!p) return null;
  return {
    id: p.id,
    fullName: p.fullName,
    organizationName: p.organizationName,
    website: p.website,
    profileImageUrl: p.profileImageUrl,
    description: p.description,
  };
}

function toPublicEvent(event: Event): Event {
  return { ...event, producer: publicProducer(event.producer) as any };
}

function pickEventFields(input: any): Partial<Event> {
  const out: any = {};
  for (const f of EVENT_FIELDS) if (input?.[f] !== undefined) out[f] = input[f];
  if (out.paymentMethods !== undefined) {
    if (!Array.isArray(out.paymentMethods) || out.paymentMethods.some((m: any) => !PAYMENT_METHODS.includes(m))) {
      throw new BadRequestException('Medio de pago desconocido.');
    }
  }
  return out;
}

function assertDates(fields: Partial<Event>, current?: Event) {
  const start = fields.date ?? current?.date;
  const end = fields.endDate ?? current?.endDate;
  if (fields.date !== undefined && isNaN(new Date(fields.date as any).getTime())) {
    throw new BadRequestException('La fecha del evento no es válida.');
  }
  if (start && end && new Date(end as any) < new Date(start as any)) {
    throw new BadRequestException('La fecha de cierre no puede ser anterior a la de inicio.');
  }
}

/** Valida los números de un lote. `partial` = edición, donde los campos son opcionales. */
function assertBatch(b: any, partial = false) {
  if (!partial || b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) throw new BadRequestException('Cada lote necesita un nombre.');
  }
  if (!partial || b.price !== undefined) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('El precio de un lote no puede ser negativo.');
  }
  if (!partial || b.totalQuantity !== undefined) {
    if (!Number.isInteger(Number(b.totalQuantity)) || Number(b.totalQuantity) < 0) {
      throw new BadRequestException('El stock de un lote no puede ser negativo.');
    }
  }
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(Batch)
    private batchesRepository: Repository<Batch>,
    @InjectRepository(Seat)
    private seatsRepository: Repository<Seat>,
  ) { }

  async create(createEventDto: any, user: User): Promise<Event> {
    const { batches } = createEventDto ?? {};
    const eventData = pickEventFields(createEventDto);

    if (!eventData.title || !String(eventData.title).trim()) throw new BadRequestException('El evento necesita un título.');
    if (!eventData.date) throw new BadRequestException('El evento necesita una fecha.');
    assertDates(eventData);
    for (const b of batches ?? []) assertBatch(b);

    const event = this.eventsRepository.create({
      description: '',
      location: '',
      ...eventData,
      producer: { id: user.id } as User,
    } as Event);
    const savedEvent = await this.eventsRepository.save(event);

    for (const b of batches ?? []) {
      await this.createBatch(b, savedEvent);
    }

    const newEvent = await this.eventsRepository.findOne({ where: { id: savedEvent.id }, relations: ['batches', 'producer'] });
    if (!newEvent) throw new NotFoundException('No se pudo crear el evento.');
    return newEvent;
  }

  async findAll(category?: string, search?: string): Promise<Event[]> {
    const qb = this.eventsRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.producer', 'producer')
      .leftJoinAndSelect('event.batches', 'batches')
      .where('event.isVisible = :isVisible', { isVisible: true })
      // Los eventos que ya terminaron no se listan en la cartelera.
      .andWhere('COALESCE(event.endDate, event.date) >= :now', { now: new Date() })
      .orderBy('event.date', 'ASC');

    if (category) {
      qb.andWhere('event.category = :category', { category });
    }

    if (search) {
      qb.andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${search}%` });
    }

    return (await qb.getMany()).map(toPublicEvent);
  }

  /** Vista pública: un evento oculto sólo lo ve su productor. */
  async findPublic(id: string, viewer?: { id: string; role?: string }): Promise<Event> {
    const event = await this.findOne(id);
    if (!event) throw new NotFoundException('El evento no existe.');
    const isOwner = viewer && (viewer.role === 'admin' || event.producer?.id === viewer.id);
    if (!event.isVisible && !isOwner) throw new NotFoundException('El evento no existe.');
    return toPublicEvent(event);
  }

  async findOne(id: string): Promise<Event | null> {
    return this.eventsRepository.findOne({
      where: { id },
      relations: ['batches', 'producer'],
    });
  }

  async findByProducer(user: User): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { producer: { id: user.id } },
      relations: ['batches'],
    });
  }

  async update(id: string, updateData: any, user: { id: string; role?: string }): Promise<Event> {
    const event = await this.findOne(id);
    if (!event) throw new NotFoundException('El evento no existe.');
    if (user.role !== 'admin' && event.producer?.id !== user.id) {
      throw new ForbiddenException('Este evento no es tuyo.');
    }

    const { batches } = updateData ?? {};
    const fields = pickEventFields(updateData);
    assertDates(fields, event);

    // Se guarda sin la relación `batches` cargada para que TypeORM no intente
    // reescribir los lotes con la versión vieja.
    const { batches: _loaded, ...plain } = event as any;
    await this.eventsRepository.save({ ...plain, ...fields });

    for (const b of batches ?? []) {
      if (b.id) {
        // Sólo lotes de ESTE evento. Antes se buscaba el lote por id sin más,
        // así que un productor podía cambiar precio o stock de un evento ajeno.
        const existing = await this.batchesRepository.findOne({ where: { id: b.id, event: { id } } });
        if (!existing) throw new NotFoundException('Uno de los lotes no pertenece a este evento.');
        assertBatch(b, true);

        if (b.name !== undefined) existing.name = String(b.name).trim();
        if (b.price !== undefined) existing.price = Number(b.price);
        if (b.totalQuantity !== undefined) {
          const total = Number(b.totalQuantity);
          if (total < existing.soldQuantity) {
            throw new BadRequestException(`El lote "${existing.name}" ya vendió ${existing.soldQuantity} entradas: el stock no puede ser menor.`);
          }
          existing.totalQuantity = total;
        }
        if (b.salesEndDate !== undefined) existing.salesEndDate = b.salesEndDate || null as any;
        if (b.isManualSoldOut !== undefined) existing.isManualSoldOut = !!b.isManualSoldOut;
        if (b.hasSeating !== undefined) existing.hasSeating = !!b.hasSeating;
        if (b.rows !== undefined) existing.rows = b.rows;
        if (b.cols !== undefined) existing.cols = b.cols;
        if (b.seatConfig !== undefined) existing.seatConfig = b.seatConfig;

        await this.batchesRepository.save(existing);
        if (existing.hasSeating) await this.generateSeats(existing);
      } else {
        assertBatch(b);
        await this.createBatch(b, event);
      }
    }
    return (await this.findOne(id)) as Event;
  }

  async getSeats(batchId: string): Promise<Seat[]> {
    return this.seatsRepository.find({
      where: { batch: { id: batchId } },
      order: { row: 'ASC', number: 'ASC' }
    });
  }

  private async createBatch(b: any, event: Event) {
    const batch = this.batchesRepository.create({
      name: String(b.name).trim(),
      price: Number(b.price),
      totalQuantity: Number(b.totalQuantity),
      soldQuantity: 0,
      startDate: b.startDate || null,
      endDate: b.endDate || null,
      salesEndDate: b.salesEndDate || null,
      isManualSoldOut: !!b.isManualSoldOut,
      hasSeating: !!b.hasSeating,
      rows: b.rows ?? null,
      cols: b.cols ?? null,
      seatConfig: b.seatConfig ?? null,
      event,
    } as unknown as Batch);
    const saved = await this.batchesRepository.save(batch);
    if (!Array.isArray(saved) && saved?.hasSeating) await this.generateSeats(saved);
    return saved;
  }

  /**
   * Genera las butacas de un lote numerado, una sola vez. Antes se volvían a
   * generar en cada edición del evento y quedaban butacas duplicadas a la venta.
   */
  private async generateSeats(batch: Batch) {
    const existing = await this.seatsRepository.count({ where: { batch: { id: batch.id } } }).catch(() => 0);
    if (existing > 0) return;

    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let rowCounts: number[] = [];
    if (batch.seatConfig) {
      rowCounts = batch.seatConfig.split(',').map(n => parseInt(n.trim(), 10)).filter(n => Number.isInteger(n) && n > 0);
    } else if (batch.rows && batch.cols) {
      rowCounts = Array(batch.rows).fill(batch.cols);
    } else {
      return;
    }
    if (rowCounts.reduce((a, n) => a + n, 0) > MAX_SEATS_PER_BATCH) {
      throw new BadRequestException(`Un lote numerado admite hasta ${MAX_SEATS_PER_BATCH} butacas.`);
    }

    const seats: Seat[] = [];
    for (let r = 0; r < rowCounts.length; r++) {
      const rowChar = r < 26 ? rowLabels[r] : `R${r + 1}`;
      for (let c = 1; c <= rowCounts[r]; c++) {
        seats.push(this.seatsRepository.create({ row: rowChar, number: c.toString(), status: 'AVAILABLE', batch }));
      }
    }
    await this.seatsRepository.save(seats);
  }
}
