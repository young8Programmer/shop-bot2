import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nameUz: string;

  @Column()
  nameRu: string;

  @Column()
  nameEn: string;
}