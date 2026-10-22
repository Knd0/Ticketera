/**
 * La URL de la API y la marca salen de /config/app-config.js, que se carga
 * antes que la app. Para desplegar no hace falta recompilar: se edita ese
 * archivo. Por defecto apunta a la API local (puerto 3020).
 */
const runtime: { apiUrl?: string; brandName?: string; contactEmail?: string; contactWhatsapp?: string } =
  (globalThis as any).APP_CONFIG ?? {};

export const environment = {
  apiUrl: (runtime.apiUrl || 'http://localhost:3020').replace(/\/$/, ''),
  brandName: runtime.brandName || 'Ticketera',
  contactEmail: runtime.contactEmail || '',
  contactWhatsapp: runtime.contactWhatsapp || '',
};
