import { ApplicationConfig, provideZoneChangeDetection, isDevMode, LOCALE_ID, DEFAULT_CURRENCY_CODE } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';


registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Fechas y montos en castellano y en pesos: "$ 20.000", "jueves, 15 de octubre".
    { provide: LOCALE_ID, useValue: 'es-AR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'ARS' },
    provideServiceWorker('ngsw-worker.js', {
      // En desarrollo el service worker cachea versiones viejas y confunde.
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ]
};
