import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Batch } from '../events/batch.entity';
import { Ticket } from './ticket.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column()
  customerPhone: string;

  @Column()
  customerDocId: string;

  @Column('decimal')
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PAID', 'REFUNDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING'
  })
  status: string;

  /** Id del pago en Mercado Pago (vacío en efectivo / transferencia). */
  @Column({ nullable: true })
  paymentId: string;

  /** 'MercadoPago' o 'Cash / Bank Transfer'. */
  @Column({ nullable: true })
  paymentMethod: string;

  @ManyToOne('User', { nullable: true })
  user: any; // Using 'any' as User might cause circular dep again. Or 'User' string token.

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items: OrderItem[];

  // Keeping tickets for now as they are generated AFTER payment
  @OneToMany(() => Ticket, ticket => ticket.order, { cascade: true })
  tickets: Ticket[];

  @CreateDateColumn()
  createdAt: Date;
}
