/*
 * Configuración en tiempo de ejecución. Al desplegar se edita sólo este
 * archivo, sin volver a compilar: así la misma app se puede entregar con la
 * marca de cada productora.
 */
window.APP_CONFIG = {
  apiUrl: 'http://localhost:3020',
  brandName: 'Ticketera',
  // Mail y WhatsApp de contacto que se muestran en el pie de página (opcional).
  contactEmail: '',
  contactWhatsapp: '',
};
