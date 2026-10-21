/**
 * Lee un secreto obligatorio del entorno.
 *
 * Antes los secretos estaban escritos en el código ('secretKey' y
 * 'SUPER_SECRET_KEY_123'). Como el repositorio es público, cualquiera podía
 * firmar sesiones de admin o fabricar entradas con QR válido. Ahora, si falta
 * la variable, el arranque falla con un mensaje claro. Sólo los tests usan un
 * valor fijo.
 */
export function requireSecret(name: 'JWT_SECRET' | 'TICKET_SIGNING_SECRET'): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (process.env.NODE_ENV === 'test') return `test-only-${name}`;
  throw new Error(
    `Falta la variable de entorno ${name}. Generá una con \`openssl rand -base64 48\` y cargala antes de arrancar.`,
  );
}

/**
 * Pagos simulados (Mercado Pago de mentira + webhook sin verificar). Sólo para
 * desarrollo y demos: con esto activo, una orden "MercadoPago" queda pagada sin
 * cobrar nada.
 */
export function isMockPaymentsEnabled(): boolean {
  return process.env.ENABLE_MOCK_PAYMENTS === 'true';
}
