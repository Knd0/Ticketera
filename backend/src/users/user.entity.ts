import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Event } from '../events/event.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  dni: string;

  @Column({ nullable: true })
  phone: string;

  // Producer Specific Fields
  @Column({ nullable: true })
  cuit: string; // Tax ID

  @Column({ nullable: true })
  organizationName: string; // Can be alias for fullName for producers

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  profileImageUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'user' })
  role: string; // 'user' | 'producer' | 'admin'

  @OneToMany('Event', 'producer')
  events: Event[];
}
