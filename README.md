# Ticketera

Sistema de gestión de tickets con Angular y NestJS.

## Requisitos Previos

- Node.js (v20 o superior)
- PostgreSQL (Base de datos llamada `ticketera_db`)

## Configuración

1.  **Backend**:
    -   Navegar a `backend/`
    -   Copiar `.env.example` a `.env` (si existe, sino crear `.env` con las variables de entorno)
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
