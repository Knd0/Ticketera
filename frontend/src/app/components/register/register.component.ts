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
      
      <!-- STEP 1: ROLE SELECTION -->
      <div *ngIf="currentStep === 1" class="step-role">
          <h3>Are you looking to buy tickets or organize events?</h3>
          <div class="role-cards">
              <div class="role-card" (click)="selectRole('user')">
                  <div class="icon">🎟️</div>
                  <h4>Ticket Buyer</h4>
                  <p>Discover events, buy tickets, and manage your orders. It's free!</p>
              </div>
              <div class="role-card producer" (click)="selectRole('producer')">
                  <div class="icon">🎭</div>
                  <h4>Event Producer</h4>
                  <p>Create listed events, manage sales, and scan tickets. Join our network.</p>
              </div>
          </div>
          <p class="login-link">Already have an account? <a routerLink="/login">Login here</a></p>
      </div>

      <!-- STEP 2: DETAILS FORM -->
      <form *ngIf="currentStep === 2" [formGroup]="registerForm" (ngSubmit)="onSubmit()">
        <button type="button" class="back-btn" (click)="currentStep = 1">← Back</button>
        
        <div class="form-header">
            <h3>{{ isProducer ? 'Producer Registration' : 'Create Account' }}</h3>
            <p>{{ isProducer ? 'Start selling your tickets in minutes.' : 'Get ready to experience the best events.' }}</p>
        </div>

        <!-- COMMON FIELDS -->
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" formControlName="email" placeholder="name@example.com">
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input type="password" formControlName="password" placeholder="Create a secure password">
        </div>

        <!-- USER SPECIFIC -->
        <ng-container *ngIf="!isProducer">
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
                <input type="text" formControlName="phone" placeholder="Mobile Number">
            </div>
        </ng-container>

        <!-- PRODUCER SPECIFIC -->
        <ng-container *ngIf="isProducer">
            <div class="form-group">
                <label>Organization / Company Name</label>
                <input type="text" formControlName="fullName" placeholder="Event Production Co.">
            </div>
            <!-- CUIT REMOVED -->
            <div class="form-group">
                <label>Website / Social Link</label>
                <input type="text" formControlName="website" placeholder="https://instagram.com/myevents">
            </div>
            <div class="form-group">
                <label>Short Bio / Description</label>
                <textarea formControlName="description" placeholder="Tell us about the events you organize..."></textarea>
            </div>
            <div class="form-group">
                 <label>Profile Image URL</label>
                 <input type="text" formControlName="profileImageUrl" placeholder="https://...">
            </div>
        </ng-container>
        
        <button type="submit" [disabled]="registerForm.invalid || loading">
             <span *ngIf="loading">Creating Account...</span>
             <span *ngIf="!loading">Complete Registration</span>
        </button>
        <p class="error-msg" *ngIf="error">{{ error }}</p>
      </form>
    </div>
  `,
  styles: [`
    .register-container {
      max-width: 500px;
      margin: 4rem auto;
      padding: 2.5rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    h2 { text-align: center; margin-bottom: 2rem; }
    h3 { text-align: center; margin-bottom: 1rem; font-size: 1.2rem; }
    .step-role h3 { margin-bottom: 2rem; opacity: 0.8; }
    
    .role-cards { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; margin-bottom: 2rem; }
    .role-card {
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.5rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
    }
    .role-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .producer:hover { border-color: #f59e0b; } /* Amber for producer check */
    
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .role-card h4 { margin-bottom: 0.5rem; }
    .role-card p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }

    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0; margin-bottom: 1rem; }
    .back-btn:hover { text-decoration: underline; color: var(--text-primary); }

    .form-header { text-align: center; margin-bottom: 2rem; }
    .form-header p { color: var(--text-muted); font-size: 0.9rem; }

    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 0.9rem; color: var(--text-muted); }
    input, textarea {
      width: 100%;
      padding: 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--text-primary);
    }
    textarea { height: 80px; resize: vertical; font-family: inherit; }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); }
    
    button[type="submit"] {
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
    button[type="submit"]:disabled { opacity: 0.7; cursor: not-allowed; }
    
    .error-msg { 
        background: rgba(239, 68, 68, 0.1); 
        color: #ef4444; 
        padding: 0.75rem; 
        border-radius: 8px; 
        text-align: center; 
        margin-top: 1rem; 
        border: 1px solid rgba(239, 68, 68, 0.2); 
    }
    .login-link { text-align: center; margin-top: 2rem; font-size: 0.9rem; color: var(--text-muted); }
    a { color: var(--primary); text-decoration: none; }
  `]
})
export class RegisterComponent {
  fb = inject(FormBuilder);
  authService = inject(AuthService);
  router = inject(Router);
  
  loading = false;
  error = '';
  currentStep = 1;
  isProducer = false;

  registerForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    // Common mappings
    fullName: ['', Validators.required], // Mapped to Organization Name for producer
    // User fields
    dni: [''],
    phone: [''],
    // Producer fields
    // cuit: [''] REMOVED
    website: [''],
    description: [''],
    profileImageUrl: ['']
  });

  selectRole(role: 'user' | 'producer') {
      this.isProducer = role === 'producer';
      this.currentStep = 2;
      this.updateValidators();
  }

  updateValidators() {
      const userFields = ['dni'];
      // const prodFields = ['description'];

      if (this.isProducer) {
          // Add required to producer fields
          this.registerForm.get('dni')?.clearValidators();
      } else {
          // Add required to user fields
          this.registerForm.get('dni')?.setValidators([Validators.required]);
      }
      // Update validity status
      this.registerForm.get('dni')?.updateValueAndValidity();
      // this.registerForm.get('cuit')?.updateValueAndValidity();
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.loading = true;
      this.error = '';
      
      const formVal = this.registerForm.value;
      
      // Auto-generate username from email
      const username = formVal.email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

      const payload = {
          ...formVal,
          username,
          role: this.isProducer ? 'producer' : 'user'
      };
      
      // Clean up empty fields based on role if needed, or backend handles nulls
      if (!this.isProducer) {
          // delete payload.cuit; 
          delete payload.website;
          delete payload.description;
          delete payload.profileImageUrl;
      }
      
      this.authService.register(payload).subscribe({
        next: () => {
          this.loading = false;
          alert('Registration successful! Please login with your Email.');
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.loading = false;
          console.error(err);
          if (err.error && err.error.message) {
              this.error = err.error.message;
          } else {
             this.error = 'Registration failed. Try a different email.';
          }
        }
      });
    } else {
        this.registerForm.markAllAsTouched();
    }
  }
}
