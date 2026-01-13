import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Batch } from './batch.entity';

@Entity()
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  row: string; // A, B, C...

  @Column()
  number: string; // 1, 2, 3...

  @Column({ default: 'AVAILABLE' })
  status: 'AVAILABLE' | 'LOCKED' | 'SOLD';

  @ManyToOne(() => Batch, batch => batch.seats)
  batch: Batch;
}
