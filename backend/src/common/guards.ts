import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT opcional: si viene un token válido carga `req.user`; si no, sigue como invitado. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}

/**
 * Sólo productores (y admin). Antes cualquier cuenta de comprador podía crear
 * eventos y ver el panel de ventas desde la API.
 */
@Injectable()
export class ProducerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user && (user.role === 'producer' || user.role === 'admin')) return true;
    throw new ForbiddenException('Necesitás una cuenta de productor.');
  }
}
