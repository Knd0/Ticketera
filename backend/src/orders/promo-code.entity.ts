import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'float' })
  discountPercentage: number; // e.g. 10 for 10%

  @Column({ nullable: true })
  maxUses: number;

  @Column({ default: 0 })
  usedCount: number;

  @Column({ nullable: true })
  validUntil: Date;

  @Column({ default: true })
  isActive: boolean;
}
