import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService.register', () => {
  let usersService: { create: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersService = { create: jest.fn(async (u) => ({ id: 'u1', ...u })) };
    service = new AuthService(usersService as any, { sign: jest.fn() } as any);
  });

  const base = { email: 'ana@example.com', password: 'clave-segura', fullName: 'Ana' };

  it('no permite registrarse como admin', async () => {
    await service.register({ ...base, role: 'admin' });
    expect(usersService.create.mock.calls[0][0].role).toBe('user');
  });

  it('permite elegir productor', async () => {
    await service.register({ ...base, role: 'producer' });
    expect(usersService.create.mock.calls[0][0].role).toBe('producer');
  });

  it('ignora campos que no son del formulario', async () => {
    await service.register({ ...base, id: 'otro-id', events: [{}], isAdmin: true });
    const saved = usersService.create.mock.calls[0][0];
    expect(saved.id).toBeUndefined();
    expect(saved.events).toBeUndefined();
    expect(saved.isAdmin).toBeUndefined();
  });

  it('guarda la contraseña hasheada y nunca la devuelve', async () => {
    const result = await service.register(base);
    const saved = usersService.create.mock.calls[0][0];
    expect(await bcrypt.compare('clave-segura', saved.password)).toBe(true);
    expect(result).not.toHaveProperty('password');
  });

  it('exige email válido y contraseña de 8 caracteres', async () => {
    await expect(service.register({ ...base, email: 'no-es-mail' })).rejects.toThrow(/email/);
    await expect(service.register({ ...base, password: '1234567' })).rejects.toThrow(/8 caracteres/);
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
