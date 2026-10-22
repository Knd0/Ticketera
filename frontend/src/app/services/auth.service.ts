import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'access_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/auth`;
  private isLoggedInSubject = new BehaviorSubject<boolean>(!!this.getValidToken());

  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromToken());
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): any {
    return this.currentUserSubject.value;
  }

  /** El token guardado, si todavía no venció. Uno vencido se descarta. */
  getValidToken(): string | null {
    let token: string | null = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch { return null; }
    if (!token) return null;
    const payload = this.decode(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* sin almacenamiento */ }
      return null;
    }
    return token;
  }

  private decode(token: string): any {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch {
      return null;
    }
  }

  private getUserFromToken(): any {
    const token = this.getValidToken();
    return token ? this.decode(token) : null;
  }

  /** Pantalla de inicio según el rol: productores al panel, compradores a sus entradas. */
  homeFor(user: any): string {
    return user?.role === 'producer' || user?.role === 'admin' ? '/dashboard' : '/my-tickets';
  }

  login(credentials: { email: string, password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem(TOKEN_KEY, response.access_token);
        this.isLoggedInSubject.next(true);
        this.currentUserSubject.next(this.getUserFromToken());
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  logout(expired = false) {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* sin almacenamiento */ }
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login'], expired ? { queryParams: { vencida: 1 } } : {});
  }
}
