import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotifyService } from '../../services/notify.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="register-container">
      <h2>Creá tu cuenta</h2>
      
      <!-- STEP 1: ROLE SELECTION -->
      <div *ngIf="currentStep === 1" class="step-role">
          <h3>¿Querés comprar entradas o vender las de tus eventos?</h3>
          <div class="role-cards">
              <div class="role-card" (click)="selectRole('user')">
                  <div class="icon">🎟️</div>
                  <h4>Compro entradas</h4>
                  <p>Encontrá eventos, comprá tus entradas y tenelas siempre a mano. Es gratis.</p>
              </div>
              <div class="role-card producer" (click)="selectRole('producer')">
                  <div class="icon">🎭</div>
                  <h4>Organizo eventos</h4>
                  <p>Publicá tus eventos, cobrá con Mercado Pago o transferencia y controlá el ingreso con el celular.</p>
              </div>
          </div>
          <p class="login-link">¿Ya tenés cuenta? <a routerLink="/login">Ingresá</a></p>
      </div>

      <!-- STEP 2: DETAILS FORM -->
      <form *ngIf="currentStep === 2" [formGroup]="registerForm" (ngSubmit)="onSubmit()">
        <button type="button" class="back-btn" (click)="currentStep = 1">← Volver</button>
        
        <div class="form-header">
            <h3>{{ isProducer ? 'Cuenta de productor' : 'Cuenta de comprador' }}</h3>
            <p>{{ isProducer ? 'En minutos podés tener tu primer evento a la venta.' : 'Tus entradas, siempre en el celular.' }}</p>
        </div>

        <!-- COMMON FIELDS -->
        <div class="form-group">
          <label>Email</label>
          <input type="email" formControlName="email" placeholder="tu@email.com" autocomplete="email">
        </div>
        
        <div class="form-group">
          <label>Contraseña</label>
          <div class="password-wrapper">
            <input [type]="showPassword ? 'text' : 'password'" formControlName="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
            <button type="button" class="password-toggle" (click)="togglePassword()">
                <i class="fas" [class.fa-eye]="!showPassword" [class.fa-eye-slash]="showPassword"></i>
            </button>
          </div>
        </div>

        <!-- USER SPECIFIC -->
        <ng-container *ngIf="!isProducer">
            <div class="form-group">
                <label>Nombre y apellido</label>
                <input type="text" formControlName="fullName" placeholder="Como figura en tu DNI">
            </div>
            <div class="form-group">
                <label>DNI</label>
                <input type="text" formControlName="dni" placeholder="Ej.: 30111222" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Celular</label>
                <input type="text" formControlName="phone" placeholder="Ej.: 345 4123456" inputmode="tel">
            </div>
        </ng-container>

        <!-- PRODUCER SPECIFIC -->
        <ng-container *ngIf="isProducer">
            <div class="form-group">
                <label>Nombre de la productora</label>
                <input type="text" formControlName="fullName" placeholder="Ej.: Producciones del Litoral">
            </div>
            <div class="form-group">
                <label>Celular de contacto</label>
                <input type="text" formControlName="phone" placeholder="Ej.: 345 4123456" inputmode="tel">
            </div>
            <div class="form-group">
                <label>Web o Instagram</label>
                <input type="text" formControlName="website" placeholder="https://instagram.com/tuproductora">
            </div>
            <div class="form-group">
                <label>Contá en pocas palabras qué eventos hacés</label>
                <textarea formControlName="description" placeholder="Fiestas, recitales, obras de teatro…"></textarea>
            </div>
            <div class="form-group">
                 <label>Logo (link a la imagen, opcional)</label>
                 <input type="text" formControlName="profileImageUrl" placeholder="https://...">
            </div>
        </ng-container>
        
        <button type="submit" [disabled]="registerForm.invalid || loading">
             <span *ngIf="loading">Creando la cuenta…</span>
             <span *ngIf="!loading">Crear cuenta</span>
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
    @media (max-width: 560px) { .role-cards { grid-template-columns: 1fr; } .register-container { margin: 1.5rem 1rem; padding: 1.5rem; } }
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
  notify = inject(NotifyService);

  loading = false;
  error = '';
  currentStep = 1;
  isProducer = false;
  showPassword = false;

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  registerForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
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

      const payload: any = {
        ...formVal,
        role: this.isProducer ? 'producer' : 'user'
      };
      if (this.isProducer) payload.organizationName = formVal.fullName;

      // Clean up empty fields based on role if needed, or backend handles nulls
      if (!this.isProducer) {
        // delete payload.cuit; 
        delete payload.website;
        delete payload.description;
        delete payload.profileImageUrl;
      }

      this.authService.register(payload).subscribe({
        next: () => {
          // Entra directo, sin volver a pedir los datos.
          this.authService.login({ email: formVal.email, password: formVal.password }).subscribe({
            next: () => {
              this.loading = false;
              this.notify.toast('¡Bienvenido! Tu cuenta está lista.');
              this.router.navigateByUrl(this.authService.homeFor(this.authService.currentUser));
            },
            error: () => { this.loading = false; this.router.navigate(['/login']); },
          });
        },
        error: (err) => {
          this.loading = false;
          this.error = this.notify.messageOf(err, 'No pudimos crear la cuenta. Probá de nuevo.');
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
