import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { UserModule } from '../modules/user/user.module';
import { CategoryModule } from '../modules/category/category.module';
import { ProductModule } from '../modules/product/product.module';
import { CartModule } from '../modules/cart/cart.module';
import { OrderModule } from '../modules/order/order.module';
import { MessageModule } from '../modules/message/message.module';

@Module({
  imports: [UserModule, CategoryModule, ProductModule, CartModule, OrderModule, MessageModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}