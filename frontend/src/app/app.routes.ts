import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

// Todo lo que no es la cartelera se carga a demanda: el comprador que entra
// desde un link de Instagram baja sólo lo que necesita (los gráficos del panel
// de productor pesaban en la primera carga).
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent) },
  { path: 'dashboard', loadComponent: () => import('./components/producer-dashboard/producer-dashboard.component').then(m => m.ProducerDashboardComponent), canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: 'create-event', loadComponent: () => import('./components/create-event/create-event.component').then(m => m.CreateEventComponent), canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: 'event/:id', loadComponent: () => import('./components/event-detail/event-detail.component').then(m => m.EventDetailComponent) },
  { path: 'checkout', loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent) },
  { path: 'checkout/resultado', loadComponent: () => import('./components/payment-result/payment-result.component').then(m => m.PaymentResultComponent) },
  { path: 'my-tickets', loadComponent: () => import('./components/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent), canActivate: [authGuard] },
  { path: 'scanner', loadComponent: () => import('./components/scanner/scanner.component').then(m => m.ScannerComponent), canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: 'terms', loadComponent: () => import('./components/terms/terms.component').then(m => m.TermsComponent) },
  { path: 'privacy', loadComponent: () => import('./components/privacy/privacy.component').then(m => m.PrivacyComponent) },
  { path: '**', redirectTo: '' }
];
