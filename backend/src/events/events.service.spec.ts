import { Seat } from './seat.entity';
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

  const mockEventsRepository: any = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
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
        { provide: getRepositoryToken(Seat), useValue: { create: jest.fn((dto) => dto), save: jest.fn((x) => x), find: jest.fn().mockResolvedValue([]) } },
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

    await expect(service.create(createDto, user)).rejects.toThrow('La fecha de cierre no puede ser anterior a la de inicio.');
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

    await expect(service.create(createDto, user)).rejects.toThrow('El stock de un lote no puede ser negativo.');
  });

  it('should filter events by category', async () => {
    const filterCategory = 'Concert';
    const events = [
        { id: '1', title: 'Event 1', category: 'Concert', date: new Date() },
        { id: '2', title: 'Event 2', category: 'Concert', date: new Date() }
    ];

    // findAll usa QueryBuilder: sólo eventos visibles, filtrados por categoría.
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(events),
    };
    mockEventsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(filterCategory);

    expect(qb.where).toHaveBeenCalledWith('event.isVisible = :isVisible', { isVisible: true });
    expect(qb.andWhere).toHaveBeenCalledWith('event.category = :category', { category: filterCategory });
    expect(result).toHaveLength(2);
  });
});

describe('EventsService — permisos y datos públicos', () => {
  const { publicProducer } = require('./events.service');

  it('al público sólo le muestra datos de presentación del productor', () => {
    const out = publicProducer({ id: 'p', fullName: 'Ana', organizationName: 'Prod', email: 'a@b.com', phone: '345', dni: '30111222', cuit: '20-3', password: 'x' } as any);
    expect(out).toEqual({ id: 'p', fullName: 'Ana', organizationName: 'Prod', website: undefined, profileImageUrl: undefined, description: undefined });
  });

  async function build(event: any, batch: any) {
    const eventsRepo: any = { findOne: jest.fn().mockResolvedValue(event), save: jest.fn((x) => x) };
    const batchesRepo: any = { findOne: jest.fn().mockResolvedValue(batch), save: jest.fn((x) => x), create: jest.fn((x) => x) };
    const seatsRepo: any = { count: jest.fn().mockResolvedValue(0), create: jest.fn((x) => x), save: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: eventsRepo },
        { provide: getRepositoryToken(Batch), useValue: batchesRepo },
        { provide: getRepositoryToken(Seat), useValue: seatsRepo },
      ],
    }).compile();
    return { service: module.get(EventsService), eventsRepo, batchesRepo, seatsRepo };
  }

  it('un productor no puede editar el evento de otro', async () => {
    const { service } = await build({ id: 'e1', producer: { id: 'otro' } }, null);
    await expect(service.update('e1', { title: 'x' }, { id: 'yo', role: 'producer' })).rejects.toThrow('no es tuyo');
  });

  it('sólo toca lotes de su propio evento', async () => {
    const { service, batchesRepo } = await build({ id: 'e1', producer: { id: 'yo' } }, null);
    await expect(service.update('e1', { batches: [{ id: 'lote-ajeno', price: 1 }] }, { id: 'yo' })).rejects.toThrow('no pertenece');
    expect(batchesRepo.findOne).toHaveBeenCalledWith({ where: { id: 'lote-ajeno', event: { id: 'e1' } } });
  });

  it('no deja bajar el stock por debajo de lo vendido', async () => {
    const { service } = await build({ id: 'e1', producer: { id: 'yo' } }, { id: 'b1', name: 'General', soldQuantity: 40, totalQuantity: 100 });
    await expect(service.update('e1', { batches: [{ id: 'b1', totalQuantity: 10 }] }, { id: 'yo' })).rejects.toThrow('ya vendió 40');
  });

  it('no deja cambiar el productor ni el id del evento', async () => {
    const { service, eventsRepo } = await build({ id: 'e1', producer: { id: 'yo' } }, null);
    await service.update('e1', { title: 'Nuevo', producer: { id: 'otro' }, id: 'hack' }, { id: 'yo' });
    expect(eventsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', title: 'Nuevo', producer: { id: 'yo' } }));
  });

  it('no regenera butacas de un lote que ya las tiene', async () => {
    const { service, seatsRepo } = await build({ id: 'e1', producer: { id: 'yo' } }, { id: 'b1', name: 'Platea', soldQuantity: 0, totalQuantity: 10, hasSeating: true, rows: 2, cols: 5 });
    seatsRepo.count.mockResolvedValue(10);
    await service.update('e1', { batches: [{ id: 'b1', hasSeating: true }] }, { id: 'yo' });
    expect(seatsRepo.save).not.toHaveBeenCalled();
  });

  it('un evento oculto no se ve públicamente', async () => {
    const { service } = await build({ id: 'e1', isVisible: false, producer: { id: 'yo' } }, null);
    await expect(service.findPublic('e1')).rejects.toThrow('no existe');
    await expect(service.findPublic('e1', { id: 'yo' })).resolves.toMatchObject({ id: 'e1' });
  });
});
