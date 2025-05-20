import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { User } from '../entities/user.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { Cart } from '../entities/cart.entity';
import { Order } from '../entities/order.entity';
import { Message } from '../entities/message.entity';
import { UserService } from '../modules/user/user.service';
import { CategoryService } from '../modules/category/category.service';
import { ProductService } from '../modules/product/product.service';
import { CartService } from '../modules/cart/cart.service';
import { OrderService } from '../modules/order/order.service';
import { MessageService } from '../modules/message/message.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Category, Product, Cart, Order, Message]),
  ],
  controllers: [BotController],
  providers: [
    BotService,
    UserService,
    CategoryService,
    ProductService,
    CartService,
    OrderService,
    MessageService,
  ],
})
export class BotModule {}