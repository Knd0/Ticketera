/**
 * URL de la API. En desarrollo local Ticketera usa el puerto 3020 para poder
 * correr junto a Themis (3000) y KinexIT (3010).
 * Al desplegar, reemplazar por la URL pública del backend.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3020',
};
