import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="register-container">
      <h2>Join Ticketera</h2>
      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>Username</label>
          <input type="text" formControlName="username" placeholder="Choose a username">
        </div>
        
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" formControlName="fullName" placeholder="Your full name">
        </div>
        
        <div class="form-group">
          <label>Document ID (DNI)</label>
          <input type="text" formControlName="dni" placeholder="Ex: 12345678">
        </div>
        
        <div class="form-group">
            <label>Phone</label>
            <input type="text" formControlName="phone" placeholder="Optional">
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" formControlName="password" placeholder="Choose a password">
        </div>
        
        <div class="form-group checkbox-group">
          <input type="checkbox" formControlName="isProducer" id="isProducer">
          <label for="isProducer">I am an Event Producer</label>
        </div>
        
        <button type="submit" [disabled]="registerForm.invalid || loading">
             <span *ngIf="loading">Creating Account...</span>
             <span *ngIf="!loading">Register</span>
        </button>
        <p class="error-msg" *ngIf="error">{{ error }}</p>
      </form>
      <p class="login-link">Already have an account? <a routerLink="/login">Login here</a></p>
    </div>
  `,
  styles: [`
    .register-container {
      max-width: 450px;
      margin: 4rem auto;
      padding: 2.5rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    h2 { text-align: center; margin-bottom: 2rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 0.9rem; color: var(--text-muted); }
    .checkbox-group { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--text-primary);
    }
    input:focus { outline: none; border-color: var(--primary); }
    button {
      width: 100%;
      padding: 0.75rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      font-weight: bold;
      margin-top: 1rem;
    }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    .error-msg { 
        background: rgba(239, 68, 68, 0.1); 
        color: #ef4444; 
        padding: 0.75rem; 
        border-radius: 8px; 
        text-align: center; 
        margin-top: 1rem; 
        border: 1px solid rgba(239, 68, 68, 0.2); 
    }
    .login-link { text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted); }
    a { color: var(--primary); text-decoration: none; }
  `]
})
export class RegisterComponent {
  fb = inject(FormBuilder);
  authService = inject(AuthService);
  router = inject(Router);
  
  loading = false;
  error = '';

  registerForm: FormGroup = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    fullName: ['', Validators.required],
    dni: ['', Validators.required],
    phone: [''],
    isProducer: [false]
  });

  onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      this.error = '';
      
      const { isProducer, ...userData } = this.registerForm.value;
      const payload = {
          ...userData,
          role: isProducer ? 'producer' : 'user'
      };
      
      this.authService.register(payload).subscribe({
        next: () => {
          this.loading = false;
          alert('Registration successful! Please login.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          // Show backend error message if available
          if (err.error && err.error.message) {
              this.error = err.error.message;
          } else {
             this.error = 'Registration failed. Try a different username/email.';
          }
        }
      });
    }
  }
}
