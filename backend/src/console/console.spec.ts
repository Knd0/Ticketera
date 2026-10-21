import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConsoleKeyGuard } from './console-key.guard';
import { ConsoleService } from './console.service';
import { AuthService } from '../auth/auth.service';

const ctx = (headers: Record<string, string>) => ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;

describe('API de consola (Ticketera)', () => {
  const ORIGINAL = process.env.CONSOLE_API_KEY;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CONSOLE_API_KEY;
    else process.env.CONSOLE_API_KEY = ORIGINAL;
  });

  it('sin CONSOLE_API_KEY la API no existe', () => {
    delete process.env.CONSOLE_API_KEY;
    expect(() => new ConsoleKeyGuard().canActivate(ctx({ 'x-console-key': 'k'.repeat(40) }))).toThrow(NotFoundException);
  });

  it('el importe mensual es el cargo por servicio de los últimos 30 días', async () => {
    const users: any = {
      find: jest.fn(async () => [{ id: 'p1', organizationName: 'Best Events', email: 'p@x.com', isSuspended: false }]),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ producerId: 'p1', total: 3 }])
        .mockResolvedValueOnce([{ producerId: 'p1', subtotal: 10000, entradas: 25 }]),
    };
    const summary = await new ConsoleService(users).summary();
    expect(summary.tenants[0]).toMatchObject({ name: 'Best Events', status: 'active', monthlyAmount: 1500, usage: { eventos: 3, entradas: 25 } });
  });

  it('suspender sólo aplica a productores', async () => {
    const users: any = { update: jest.fn(async () => ({ affected: 0 })) };
    await expect(new ConsoleService(users).setSuspended('admin-id', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(users.update).toHaveBeenCalledWith({ id: 'admin-id', role: 'producer' }, { isSuspended: true });
  });

  it('un productor suspendido no puede iniciar sesión', async () => {
    const usersService: any = { findOne: jest.fn(async () => ({ id: 'p1', password: await bcrypt.hash('clave-segura', 4), isSuspended: true })) };
    const auth = new AuthService(usersService, { sign: jest.fn() } as any);
    await expect(auth.validateUser('p@x.com', 'clave-segura')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
