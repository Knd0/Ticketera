# Ticketera

Sistema de gestión de tickets con Angular y NestJS.

## Requisitos Previos

- Node.js (v20 o superior)
- PostgreSQL (Base de datos llamada `ticketera_db`)

## Configuración

1.  **Backend**:
    -   Navegar a `backend/`
    -   Copiar `.env.example` a `.env` (si existe, sino crear `.env` con las variables de entorno)
    -   Variables **obligatorias** (sin ellas el backend no arranca):
        -   `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
        -   `JWT_SECRET`: firma las sesiones. Generar con `openssl rand -base64 48`.
        -   `TICKET_SIGNING_SECRET`: firma los QR de las entradas. Tiene que ser distinto de `JWT_SECRET`. Si se cambia, los QR ya emitidos dejan de ser válidos.
    -   Opcional: `ENABLE_MOCK_PAYMENTS=true` activa el Mercado Pago simulado y su webhook. Con esa opción las órdenes quedan pagadas sin cobrar, así que es **solo para desarrollo o demos**.
    -   `npm install`
2.  **Frontend**:
    -   Navegar a `frontend/`
    -   `npm install`

## Cómo Iniciar (Desarrollo)

Necesitas dos terminales:

**Terminal 1 (Backend):**
```bash
cd backend
npm run start:dev
```
El backend correrá en `http://localhost:3000`.

**Terminal 2 (Frontend):**
```bash
cd frontend
npm start
```
El frontend correrá en `http://localhost:4200`.

## Scripts de Ayuda (Windows)

Puedes ejecutar `start-dev.bat` en la raíz para iniciar todo (si está configurado) o simplemente seguir los pasos anteriores manualmente.
