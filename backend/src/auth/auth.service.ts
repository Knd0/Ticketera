import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

/** Roles que una persona puede elegir al registrarse. `admin` nunca. */
const SELF_REGISTER_ROLES = ['user', 'producer'];
/** Campos de perfil que acepta el formulario de registro. */
const REGISTER_PROFILE_FIELDS = ['fullName', 'dni', 'phone', 'cuit', 'organizationName', 'website', 'profileImageUrl', 'description'] as const;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
        username: user.username, 
        email: user.email, 
        sub: user.id, 
        role: user.role,
        fullName: user.fullName // Include Name for UI
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Alta pública de usuarios.
   *
   * Antes se guardaba el body tal cual (`...user`), así que bastaba mandar
   * `"role": "admin"` para registrarse como administrador, y la respuesta
   * devolvía el hash de la contraseña. Ahora sólo se aceptan los campos del
   * formulario, el rol se limita a `user` o `producer` y nunca sale el hash.
   */
  async register(body: any) {
    const input = body ?? {};
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('El email no tiene un formato válido.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const profile: Record<string, any> = {};
    for (const field of REGISTER_PROFILE_FIELDS) {
      if (typeof input[field] === 'string') profile[field] = input[field].trim();
    }

    const role = SELF_REGISTER_ROLES.includes(input.role) ? input.role : 'user';
    const username =
      typeof input.username === 'string' && input.username.trim()
        ? input.username.trim()
        : `${email.split('@')[0]}_${Date.now().toString(36)}`;

    const created = await this.usersService.create({
      ...profile,
      username,
      email,
      role,
      password: await bcrypt.hash(password, 10),
    });
    const { password: _omit, ...safe } = created as any;
    return safe;
  }
}
