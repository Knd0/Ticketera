import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { requireSecret } from '../common/secrets';

import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Check if user exists in DB
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.isSuspended) {
        // If user deleted (e.g. seed), treat as invalid token (Unauthorized)
        // Passport try/catch will handle this.
        throw new UnauthorizedException();
    }
    return { id: payload.sub, username: payload.username, email: payload.email, role: payload.role };
  }
}
