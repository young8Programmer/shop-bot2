import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { I18nModule, QueryResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { join } from 'path';
import { BotModule } from './bot/bot.module';
import { UserModule } from './modules/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { MessageModule } from './modules/message/message.module';
import { User } from './entities/user.entity';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { Cart } from './entities/cart.entity';
import { Order } from './entities/order.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    I18nModule.forRoot({
      fallbackLanguage: 'uz',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'locale'] },
        AcceptLanguageResolver,
      ],
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: 'postgresql://postgres:HcKaqszsvlsCeyUdpqElAHvYaQwxFzEX@nozomi.proxy.rlwy.net:22265/railway',
      entities: [User, Category, Product, Cart, Order, Message],
      synchronize: true,
      ssl: {
        rejectUnauthorized: false,
      },
      autoLoadEntities: true,
    }),

    BotModule,
    UserModule,
    CategoryModule,
    ProductModule,
    CartModule,
    OrderModule,
    MessageModule,
  ],
})
export class AppModule {}
