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
          <label>Password</label>
          <input type="password" formControlName="password" placeholder="Choose a password">
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" formControlName="isProducer" id="isProducer">
          <label for="isProducer">I am an Event Producer</label>
        </div>
        
        <button type="submit" [disabled]="registerForm.invalid">Register</button>
        <p class="error-msg" *ngIf="error">{{ error }}</p>
      </form>
      <p class="login-link">Already have an account? <a routerLink="/login">Login here</a></p>
    </div>
  `,
  styles: [`
    .register-container {
      max-width: 400px;
      margin: 4rem auto;
      padding: 2rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    h2 { text-align: center; margin-bottom: 2rem; }
    .form-group { margin-bottom: 1rem; }
    .checkbox-group { display: flex; align-items: center; gap: 0.5rem; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--text-primary);
    }
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
    .error-msg { color: #ef4444; text-align: center; margin-top: 1rem; }
    .login-link { text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted); }
    a { color: var(--primary); text-decoration: none; }
  `]
})
export class RegisterComponent {
  fb = inject(FormBuilder);
  authService = inject(AuthService);
  router = inject(Router);
  
  registerForm: FormGroup = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    isProducer: [false]
  });

  error = '';

  onSubmit() {
    if (this.registerForm.valid) {
      const { username, password, isProducer } = this.registerForm.value;
      const role = isProducer ? 'producer' : 'user';
      
      this.authService.register({ username, password, role }).subscribe({
        next: () => {
          alert('Registration successful! Please login.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.error = 'Registration failed. Try a different username.';
          console.error(err);
        }
      });
    }
  }
}
