import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Batch } from './batch.entity';

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  location: string;

  @Column()
  date: Date;

  @Column({ nullable: true })
  category: string; // e.g. Concert, Party, Theater

  @Column({ default: true })
  isVisible: boolean;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  imageUrl: string;

  @ManyToOne('User', 'events')
  producer: User;

  @OneToMany(() => Batch, batch => batch.event)
  batches: Batch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
