import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Order } from './order.entity';
import { Batch } from '../events/batch.entity';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string; // Unique hash for QR
  
  @Column({ nullable: true })
  signedToken: string; // JWT containing ticket info

  @Column({ default: false })
  isUsed: boolean;

  @ManyToOne(() => Order, order => order.tickets)
  order: Order;

  @ManyToOne(() => Batch)
  batch: Batch;
}
