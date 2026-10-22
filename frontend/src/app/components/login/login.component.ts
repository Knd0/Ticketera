import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  fb = inject(FormBuilder);
  authService = inject(AuthService);
  router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  error: string | null = null;
  loading = false;
  expired = !!inject(ActivatedRoute).snapshot.queryParamMap.get('vencida');
  private returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('volver');
  showPassword = false;

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.loading = true;
      this.error = null;
      this.authService.login({ email, password }).subscribe({
        next: () => {
          this.loading = false;
          const safeReturn = this.returnUrl?.startsWith('/') && !this.returnUrl.startsWith('//') ? this.returnUrl : null;
          this.router.navigateByUrl(safeReturn || this.authService.homeFor(this.authService.currentUser));
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.status === 401 ? (err.error?.message || 'Email o contraseña incorrectos.')
            : err?.status === 429 ? 'Demasiados intentos. Esperá un minuto.'
            : 'No pudimos conectar con el servidor.';
        }
      });
    }
  }
}
