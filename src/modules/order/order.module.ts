import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { OrderService } from './order.service';
import { User } from 'src/entities/user.entity';
import { Product } from 'src/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Product])],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}