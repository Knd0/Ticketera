@echo off
echo Starting Ticketera...

start "Ticketera Backend" cmd /k "cd backend && npm run start:dev"
start "Ticketera Frontend" cmd /k "cd frontend && npm start"

echo App starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:4200
