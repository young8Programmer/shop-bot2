import { Injectable } from '@nestjs/common';
import { UserService } from '../modules/user/user.service';
import { CategoryService } from '../modules/category/category.service';
import { ProductService } from '../modules/product/product.service';
import { CartService } from '../modules/cart/cart.service';
import { OrderService } from '../modules/order/order.service';
import { MessageService } from '../modules/message/message.service';
import { User } from '../entities/user.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { Cart } from '../entities/cart.entity';
import { Order } from '../entities/order.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class BotService {
  constructor(
    private userService: UserService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private cartService: CartService,
    private orderService: OrderService,
    private messageService: MessageService,
  ) {}

  async getUser(telegramId: string): Promise<User | null> {
    return this.userService.findByTelegramId(telegramId);
  }

  async createUser(telegramId: string, firstName: string, language: string): Promise<User> {
    return this.userService.create(telegramId, firstName, language);
  }

  async updateLanguage(telegramId: string, language: string): Promise<any> {
    return this.userService.updateLanguage(telegramId, language);
  }

  async getCategories(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  async getProducts(categoryId: number): Promise<Product[]> {
    return this.productService.findByCategory(categoryId);
  }

  async addToCart(userId: number, productId: number, quantity: number): Promise<void> {
    await this.cartService.add(userId, productId, quantity);
  }

  async getCart(userId: number): Promise<Cart[]> {
    return this.cartService.findByUser(userId);
  }

  async removeFromCart(userId: number, productId: number): Promise<void> {
    await this.cartService.remove(userId, productId);
  }

  async updateCartQuantity(userId: number, productId: number, quantity: number): Promise<void> {
    await this.cartService.updateQuantity(userId, productId, quantity);
  }

  async createOrder(userId: number, productId: number, quantity: number, phone: string, address: string, deliveryType: string, paymentMethod: string): Promise<void> {
    await this.orderService.create(userId, productId, quantity, phone, address, deliveryType, paymentMethod);
  }

  async getOrders(userId: number): Promise<Order[]> {
    return this.orderService.findByUser(userId);
  }

  async sendMessage(userId: number, adminId: number, message: string): Promise<void> {
    await this.messageService.create(userId, adminId, message);
  }

  async getMessages(userId: number): Promise<Message[]> {
    return this.messageService.findByUser(userId);
  }
}