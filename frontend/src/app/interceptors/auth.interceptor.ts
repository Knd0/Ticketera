import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

/** Agrega el token a los pedidos a la API y cierra la sesión si el servidor la rechaza. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getValidToken();
  const toApi = req.url.startsWith(environment.apiUrl);

  const request = token && toApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (toApi && token && err.status === 401 && !req.url.endsWith('/auth/login')) {
        auth.logout(true);
      }
      return throwError(() => err);
    }),
  );
};
