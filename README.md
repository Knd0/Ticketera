# Ticketera

Venta de entradas online para productoras: el productor publica el evento, el comprador paga con **Mercado Pago** (las entradas se emiten solas) o **reserva por transferencia/efectivo** (el productor la aprueba), recibe los QR por email y en la puerta se validan con el celular.

- `backend/`: API NestJS + PostgreSQL (TypeORM, `synchronize: true`).
- `frontend/`: Angular 21, en castellano y con montos en pesos.

## Desarrollo local

La forma recomendada es el repo [`plataforma`](https://github.com/Knd0/plataforma): `npm run setup` crea la base, el `.env` y los datos de demo, y `npm run dev -- ticketera` levanta API (3020) y web (4220).

A mano:

```bash
cd backend && npm install && npm run start:dev    # API
cd frontend && npm install && npm start           # web
cd backend && npx ts-node src/seed.ts             # datos de demo (¡vacía la base!)
```

Usuarios de demo (contraseña `password`): `producer@test.com` (productora), `user@test.com` (comprador), `admin@test.com`. Código de descuento: `BIENVENIDA10`.

## Variables del backend

| Variable | Para qué |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL. **Obligatorias.** |
| `JWT_SECRET` | Firma las sesiones. **Obligatoria.** `openssl rand -base64 48`. |
| `TICKET_SIGNING_SECRET` | Firma los QR. **Obligatoria** y distinta de `JWT_SECRET`. Si se cambia, los QR emitidos dejan de valer. |
| `MP_ACCESS_TOKEN` | Access token de producción de Mercado Pago (Tus integraciones → Credenciales). Sin él, sólo se ofrece transferencia/efectivo. |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook (Tus integraciones → Webhooks). Recomendado: con ella se rechazan notificaciones falsas. |
| `PUBLIC_API_URL` | URL pública **https** de la API: Mercado Pago avisa los pagos a `PUBLIC_API_URL/orders/webhook/mercadopago`. |
| `FRONTEND_URL` | URL del frontend: a dónde vuelve el comprador después de pagar, links de los mails y CORS. |
| `CORS_ORIGINS` | Opcional: orígenes permitidos separados por coma (por defecto, `FRONTEND_URL`). |
| `RESEND_API_KEY`, `MAIL_FROM` | Envío de las entradas por email ([resend.com](https://resend.com)). `MAIL_FROM` con un dominio verificado, ej. `Entradas <entradas@tudominio.com>`. Sin clave no se mandan mails (las entradas igual se ven en la página de la orden). |
| `BRAND_NAME` | Nombre que aparece en los mails. |
| `SERVICE_FEE_PERCENT` | Cargo por servicio sobre el precio de las entradas. Por defecto 15. Con 0 no se cobra. |
| `MP_STATEMENT_DESCRIPTOR` | Texto en el resumen de la tarjeta (hasta 22 caracteres). |
| `CONSOLE_API_KEY` | Clave compartida con la consola central (≥ 32 caracteres). Sin ella `/internal/console/*` responde 404. |
| `ENABLE_MOCK_PAYMENTS` | `true` = Mercado Pago **simulado** (aprueba todo sin cobrar). Sólo desarrollo y demos; **nunca en producción**. |

## Frontend

La URL de la API, la marca y los datos de contacto se configuran en `frontend/public/config/app-config.js`, **sin recompilar**. Así la misma app se entrega con el nombre de cada productora.

## Cómo funciona el cobro

1. El comprador elige entradas y Mercado Pago. La API reserva el stock (lotes y butacas, con bloqueo en la base), crea la orden `PENDING` y una preferencia de Checkout Pro con el monto calculado en el servidor.
2. Mercado Pago avisa por webhook y, además, el comprador vuelve a `/checkout/resultado`. En los dos casos la API **consulta el pago a Mercado Pago**, controla el importe y recién ahí firma los QR, marca la orden `PAID` y manda el mail.
3. Si no se paga en 30 minutos (más 15 de margen) la orden vence y las entradas vuelven a la venta. Las preferencias excluyen Rapipago/Pago Fácil y usan `binary_mode`, así que no quedan pagos colgados.
4. Un reintegro o contracargo invalida las entradas de esa orden.

Transferencia/efectivo: la orden queda `PENDING_APPROVAL`, el comprador ve los datos de pago que cargó el productor y, cuando el productor aprueba en su panel, se emiten las entradas.

## Tests

```bash
cd backend && npm test                                    # unitarios
cd backend && npx jest --config ./test/jest-e2e.json      # punta a punta, contra la base ticketera_e2e
cd frontend && npx ng test --watch=false
```

Los e2e usan su propia base (`ticketera_e2e`, o `E2E_DB_NAME`) y la vacían: nunca apuntarlos a una base con datos reales.
