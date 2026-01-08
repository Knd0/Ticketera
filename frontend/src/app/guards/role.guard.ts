import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const expectedRoles = route.data['roles'] as Array<string>;

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      // If no user, redirect to login
      if (!user) {
        router.navigate(['/login']);
        return false;
      }

      // Check if user has one of the expected roles
      if (expectedRoles && expectedRoles.includes(user.role)) {
        return true;
      }

      // If logged in but wrong role, redirect to home
      console.warn('Access denied: User does not have required role');
      router.navigate(['/']);
      return false;
    })
  );
};
