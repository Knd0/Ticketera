import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { LandingComponent } from './components/landing/landing.component';
import { HomeComponent } from './components/home/home.component';
import { EventDetailComponent } from './components/event-detail/event-detail.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { RegisterComponent } from './components/register/register.component';
import { ProducerDashboardComponent } from './components/producer-dashboard/producer-dashboard.component';
import { CreateEventComponent } from './components/create-event/create-event.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent }, // Redirect landing to Home for now or keep landing
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: ProducerDashboardComponent, canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: 'create-event', component: CreateEventComponent, canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: 'event/:id', component: EventDetailComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'my-tickets', loadComponent: () => import('./components/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent), canActivate: [authGuard] },
  { path: 'scanner', loadComponent: () => import('./components/scanner/scanner.component').then(m => m.ScannerComponent), canActivate: [authGuard, roleGuard], data: { roles: ['producer', 'admin'] } },
  { path: '**', redirectTo: '' }
];
