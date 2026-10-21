import { requireSecret } from './secrets';

describe('requireSecret', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  const ORIGINAL_SECRET = process.env.TICKET_SIGNING_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
    if (ORIGINAL_SECRET === undefined) delete process.env.TICKET_SIGNING_SECRET;
    else process.env.TICKET_SIGNING_SECRET = ORIGINAL_SECRET;
  });

  it('devuelve el valor configurado', () => {
    process.env.TICKET_SIGNING_SECRET = 'valor-real';
    expect(requireSecret('TICKET_SIGNING_SECRET')).toBe('valor-real');
  });

  it('falla al arrancar si falta, en vez de usar un secreto público', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TICKET_SIGNING_SECRET;
    expect(() => requireSecret('TICKET_SIGNING_SECRET')).toThrow(/TICKET_SIGNING_SECRET/);
  });
});
