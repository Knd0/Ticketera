import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { jwtConstants } from './constants';

import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any) {
    // Check if user exists in DB
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
        // If user deleted (e.g. seed), treat as invalid token (Unauthorized)
        // Passport try/catch will handle this.
        throw new Error('User not found'); 
    }
    return { id: payload.sub, username: payload.username, email: payload.email, role: payload.role };
  }
}
