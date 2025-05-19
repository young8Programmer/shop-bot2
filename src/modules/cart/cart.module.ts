import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from '../../entities/cart.entity';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Cart])],
  providers: [CartService, CartRepository],
  exports: [CartService],
})
export class CartModule {}