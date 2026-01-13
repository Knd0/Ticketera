import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Batch } from './batch.entity';
import { User } from '../users/user.entity';
import { Seat } from './seat.entity';

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
    const { batches, ...eventData } = createEventDto;

    // Validation: End Date >= Start Date
    if (eventData.date && eventData.endDate) {
      const start = new Date(eventData.date);
      const end = new Date(eventData.endDate);
      if (end < start) {
        throw new Error('Event end date cannot be before start date');
      }
    }

    // 1. Create Event
    const event = this.eventsRepository.create({
      ...eventData,
      producer: user
    } as Event); // Typed explicitly to ensure single entity creation
    const savedEvent = await this.eventsRepository.save(event);

    // 2. Create Batches
    if (batches && batches.length > 0) {
      for (const b of batches) {
         if (b.totalQuantity < 0) throw new Error('Stock cannot be negative');
         const newBatch: Batch = this.batchesRepository.create({
             ...b,
             event: savedEvent
         } as unknown as Batch);
         
         const savedBatch = await this.batchesRepository.save(newBatch);
         
         // Force single entity check (TypeORM quirk protection)
         if (!Array.isArray(savedBatch) && savedBatch.hasSeating) {
             await this.generateSeats(savedBatch);
         }
      }
    }

    const newEvent = await this.findOne(savedEvent.id);
    if (!newEvent) throw new Error('Event could not be created');
    return newEvent;
  }

  async findAll(category?: string, search?: string): Promise<Event[]> {
    const qb = this.eventsRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.producer', 'producer')
      .leftJoinAndSelect('event.batches', 'batches')
      .where('event.isVisible = :isVisible', { isVisible: true })
      .orderBy('event.date', 'ASC');

    if (category) {
      qb.andWhere('event.category = :category', { category });
    }

    if (search) {
      qb.andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${search}%` });
    }

    return qb.getMany();
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

  async update(id: string, updateData: any, user: User): Promise<Event> {
    const event = await this.findOne(id);

    if (!event) throw new Error('Event not found');
    if (!event) throw new Error('Event not found');


    if (!event.producer || event.producer.id !== user.id) {
      throw new Error('Unauthorized');
    }

    const { batches, ...eventFields } = updateData;

    // Update Event fields
    Object.assign(event, eventFields);
    const savedEvent = await this.eventsRepository.save(event);

    // Update Batches
    if (batches && batches.length > 0) {
      for (const b of batches) {
        if (b.id) {
          // Update existing
          // Be careful not to reset soldQuantity if not provided
          const existingBatch = await this.batchesRepository.findOne({ where: { id: b.id } });
          if (existingBatch) {
            // Only update allowed fields (name, price, stock, dates, flags)
            if (b.name) existingBatch.name = b.name;
            if (b.price) existingBatch.price = b.price;
            if (b.totalQuantity) existingBatch.totalQuantity = b.totalQuantity;
            if (b.salesEndDate) existingBatch.salesEndDate = b.salesEndDate;
            if (b.isManualSoldOut !== undefined) existingBatch.isManualSoldOut = b.isManualSoldOut;
            
            // Update Seating Config
            let seatingChanged = false;
            if (b.hasSeating !== undefined) {
                existingBatch.hasSeating = b.hasSeating;
                seatingChanged = true;
            }
            if (b.rows) existingBatch.rows = b.rows;
            if (b.cols) existingBatch.cols = b.cols;

            await this.batchesRepository.save(existingBatch);

            if (existingBatch.hasSeating && seatingChanged) {
                // Generate seats if enabled and seemingly new (or simple check)
                await this.generateSeats(existingBatch);
            }
          }
        } else {
          // Create new batch for this event
          const newBatch: Batch = this.batchesRepository.create({ ...b, event: savedEvent } as unknown as Batch);
          const savedBatch = await this.batchesRepository.save(newBatch);
          if (!Array.isArray(savedBatch) && savedBatch.hasSeating) {
              await this.generateSeats(savedBatch);
          }
        }
      }
    }
    return this.findOne(id) as Promise<Event>;
  }
  async getSeats(batchId: string): Promise<Seat[]> {
      return this.seatsRepository.find({
          where: { batch: { id: batchId } },
          order: { row: 'ASC', number: 'ASC' }
      });
  }

  private async generateSeats(batch: Batch) {
      if (!batch.seats) batch.seats = [];
      
      const seats: Seat[] = [];
      const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      // Check for Custom Config (e.g. "10,12,14")
      let rowCounts: number[] = [];
      if (batch.seatConfig) {
          rowCounts = batch.seatConfig.split(',').map(n => parseInt(n.trim()));
      } else if (batch.rows && batch.cols) {
          // Fallback to Uniform Grid
          rowCounts = Array(batch.rows).fill(batch.cols);
      } else {
          return; // No config
      }

      for (let r = 0; r < rowCounts.length; r++) {
          const count = rowCounts[r];
          const rowChar = r < 26 ? rowLabels[r] : `R${r+1}`;
          
          for (let c = 1; c <= count; c++) {
              // Check dupes not needed ideally if fresh batch, but good for safety
              const seat = this.seatsRepository.create({
                  row: rowChar,
                  number: c.toString(),
                  status: 'AVAILABLE',
                  batch: batch
              });
              seats.push(seat);
          }
      }
      await this.seatsRepository.save(seats);
  }
}
