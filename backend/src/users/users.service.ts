import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /** Busca por email o usuario e incluye el hash: sólo para el login. */
  async findOne(identifier: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :identifier OR user.username = :identifier', { identifier })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(user: Partial<User>): Promise<User> {
    try {
        const newUser = this.usersRepository.create(user);
        return await this.usersRepository.save(newUser);
    } catch (error) {
        if (error.code === '23505') { // Postgres duplicate key error code
            throw new ConflictException('Username or Email already exists');
        }
        throw error;
    }
  }
}
