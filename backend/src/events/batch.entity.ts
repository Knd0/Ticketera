import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Event } from './event.entity';

@Entity()
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g., "Early Bird", "General"

  @Column('decimal')
  price: number;

  @Column()
  totalQuantity: number;

  @Column({ default: 0 })
  soldQuantity: number;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date; // Event/Batch access end date (e.g. event end)

  @Column({ type: 'timestamp', nullable: true })
  salesEndDate: Date; // When sales stop automatically

  @Column({ default: false })
  isManualSoldOut: Boolean;

  @ManyToOne(() => Event, event => event.batches, { onDelete: 'CASCADE' })
  event: Event;
}
