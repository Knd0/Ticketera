import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:3000/auth'; // NestJS default port
  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());

  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  
  // Expose current user info
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromToken());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() { }

  private hasToken(): boolean {
    return !!localStorage.getItem('access_token');
  }

  private getUserFromToken(): any {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload;
      } catch (e) {
          return null;
      }
  }

  login(credentials: {username: string, password: string}): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem('access_token', response.access_token);
        this.isLoggedInSubject.next(true);
        this.currentUserSubject.next(this.getUserFromToken());
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  logout() {
    localStorage.removeItem('access_token');
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
