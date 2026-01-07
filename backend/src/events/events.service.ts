import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { Batch } from './batch.entity';
import { User } from '../users/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(Batch)
    private batchesRepository: Repository<Batch>,
  ) {}

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
      const batchEntities = batches.map(b => {
          if (b.totalQuantity < 0) throw new Error('Stock cannot be negative');
          return this.batchesRepository.create({
            ...b,
            event: savedEvent
          });
      });
      await this.batchesRepository.save(batchEntities);
    }

    const newEvent = await this.findOne(savedEvent.id);
    if (!newEvent) throw new Error('Event could not be created');
    return newEvent;
  }

  async findAll(category?: string): Promise<Event[]> {
    const where: any = {};
    if (category) {
        where.category = category;
    }
    return this.eventsRepository.find({
      where,
      relations: ['batches'],
      order: { date: 'ASC' }
    });
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
          for(const b of batches) {
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
                     await this.batchesRepository.save(existingBatch);
                  }
              } else {
                  // Create new batch for this event
                  const newBatch = this.batchesRepository.create({ ...b, event: savedEvent });
                  await this.batchesRepository.save(newBatch);
              }
          }
      }
      return this.findOne(id) as Promise<Event>;
  }
}
