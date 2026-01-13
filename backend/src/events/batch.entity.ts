import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany } from 'typeorm';
import { Event } from './event.entity';
import { Seat } from './seat.entity';

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

  @Column({ default: false })
  hasSeating: boolean;

  @Column({ nullable: true })
  rows: number;

  @Column({ nullable: true })
  cols: number;

  @Column({ nullable: true })
  seatConfig: string; // "10,12,14" -> Row 1 has 10, Row 2 has 12...

  @ManyToOne(() => Event, event => event.batches, { onDelete: 'CASCADE' })
  event: Event;

  @OneToMany(() => Seat, seat => seat.batch)
  seats: Seat[];
}
