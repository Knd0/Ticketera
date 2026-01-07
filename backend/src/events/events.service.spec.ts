import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { Batch } from './batch.entity';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

describe('EventsService', () => {
  let service: EventsService;
  let eventsRepository: Repository<Event>;
  let batchesRepository: Repository<Batch>;

  const mockEventsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockBatchesRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(Batch),
          useValue: mockBatchesRepository,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    eventsRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    batchesRepository = module.get<Repository<Batch>>(getRepositoryToken(Batch));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create an event successfully', async () => {
    const user = { id: 'user-1' } as User;
    const createDto = {
      title: 'Test Event',
      date: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
      batches: [{ name: 'VIP', price: 100, totalQuantity: 10 }]
    };

    const savedEvent = { id: 'event-1', ...createDto };
    
    mockEventsRepository.create.mockReturnValue(savedEvent);
    mockEventsRepository.save.mockResolvedValue(savedEvent);
    mockBatchesRepository.create.mockImplementation((dto) => dto);
    mockBatchesRepository.save.mockResolvedValue([]);
    mockEventsRepository.findOne.mockResolvedValue(savedEvent);

    const result = await service.create(createDto, user);

    expect(result).toEqual(savedEvent);
    expect(mockEventsRepository.create).toHaveBeenCalled();
    expect(mockEventsRepository.save).toHaveBeenCalled();
  });

  it('should throw error if end date is before start date', async () => {
    const user = { id: 'user-1' } as User;
    const createDto = {
      title: 'Bad Date Event',
      date: '2024-01-02',
      endDate: '2024-01-01', // Before start
      batches: []
    };

    await expect(service.create(createDto, user)).rejects.toThrow('Event end date cannot be before start date');
  });

  it('should throw error if batch stock is negative', async () => {
    const user = { id: 'user-1' } as User;
    const createDto = {
      title: 'Bad Stock Event',
      date: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
      batches: [{ name: 'VIP', price: 100, totalQuantity: -5 }]
    };

    const savedEvent = { id: 'event-1', ...createDto };
    mockEventsRepository.create.mockReturnValue(savedEvent);
    mockEventsRepository.save.mockResolvedValue(savedEvent);

    await expect(service.create(createDto, user)).rejects.toThrow('Stock cannot be negative');
  });

  it('should filter events by category', async () => {
    const filterCategory = 'Concert';
    const events = [
        { id: '1', title: 'Event 1', category: 'Concert', date: new Date() },
        { id: '2', title: 'Event 2', category: 'Concert', date: new Date() }
    ];
    
    // Mock find to return filtered list when called with where clause
    mockEventsRepository.find.mockResolvedValue(events);

    const result = await service.findAll(filterCategory);

    expect(mockEventsRepository.find).toHaveBeenCalledWith({
        where: { category: filterCategory },
        relations: ['batches'],
        order: { date: 'ASC' }
    });
    expect(result).toHaveLength(2);
  });
});
