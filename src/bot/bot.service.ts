import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserService } from '../modules/user/user.service';
import { Category } from '../entities/category.entity';
import { CategoryService } from '../modules/category/category.service';
import { Product } from '../entities/product.entity';
import { ProductService } from '../modules/product/product.service';
import { Cart } from '../entities/cart.entity';
import { CartService } from '../modules/cart/cart.service';
import { Order } from '../entities/order.entity';
import { OrderService } from '../modules/order/order.service';
import { Message } from '../entities/message.entity';
import { MessageService } from '../modules/message/message.service';



@Injectable()
export class BotService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Category) private categoryRepository: Repository<Category>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(Cart) private cartRepository: Repository<Cart>,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Message) private messageRepository: Repository<Message>,
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
    return this.userService.create({ telegramId, firstName, language });
  }

  async updateLanguage(telegramId: string, language: string): Promise<User> {
    return this.userService.updateLanguage(telegramId, language);
  }

  async getCategories(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  async getProducts(categoryId: number): Promise<Product[]> {
    return this.productService.findByCategory(categoryId);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.productService.search(query);
  }

  async getAllProducts(): Promise<Product[]> {
    return this.productService.findAll();
  }

  async getProduct(id: number): Promise<Product> {
    const product = await this.productService.findOne(id);
    if (!product) throw new Error('Product not found');
    return product;
  }

  async createProduct(product: Partial<Product>): Promise<Product> {
    return this.productService.create(product);
  }

  async deleteProduct(id: number): Promise<void> {
    await this.productService.delete(id);
  }

  async addToCart(userId: number, productId: number, quantity: number): Promise<void> {
    await this.cartService.add(userId, productId, quantity);
  }

  async removeFromCart(userId: number, productId: number): Promise<void> {
    await this.cartService.remove(userId, productId);
  }

  async updateCartQuantity(userId: number, productId: number, quantity: number): Promise<void> {
    await this.cartService.updateQuantity(userId, productId, quantity);
  }

  async getCart(userId: number): Promise<Cart[]> {
    return this.cartService.findByUser(userId);
  }

  async clearCart(userId: number): Promise<void> {
    await this.cartService.clear(userId);
  }

  async createOrder(userId: number, productId: number, quantity: number, phone: string, address: string, deliveryType: string, paymentMethod: string): Promise<Order> {
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    const product = await this.productRepository.findOneOrFail({ where: { id: productId } });

    return this.orderService.create({
      user: user,
      product: product,
      quantity,
      phone,
      address,
      deliveryType,
      paymentMethod,
      status: 'new',
    });
  }

  async getOrders(userId: number): Promise<Order[]> {
    return this.orderService.findByUser(userId);
  }

  async getAllOrders(): Promise<Order[]> {
    return this.orderService.findAll();
  }

  async updateOrderStatus(orderId: number, status: string): Promise<void> {
    await this.orderService.updateStatus(orderId, status);
  }

  async sendMessage(userId: number, adminId: string, message: string): Promise<void> {
    // Userni to'liq yuklab olamiz
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    await this.messageService.create({
      user: user, // To'liq User obyectini uzatamiz
      adminId,
      message,
    });
  }

  async getMessages(userId: number): Promise<Message[]> {
    return this.messageService.findByUser(userId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userService.findAll();
  }

  async createCategory(category: Partial<Category>): Promise<Category> {
    return this.categoryService.create(category);
  }

  async deleteCategory(id: number): Promise<void> {
    await this.categoryService.delete(id);
  }

  async getCategory(id: number): Promise<Category> {
    const category = await this.categoryService.findOne(id);
    if (!category) throw new Error('Category not found');
    return category;
  }

  async getStatistics(): Promise<{ last7DaysOrders: number; last7DaysRevenue: number; last30DaysOrders: number; last30DaysRevenue: number }> {
    const now = new Date();
    const last7Days = new Date(now.setDate(now.getDate() - 7));
    const last30Days = new Date(now.setDate(now.getDate() - 23));
    const orders7 = await this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product')
      .where('order.createdAt >= :date', { date: last7Days })
      .getMany();
    const orders30 = await this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product')
      .where('order.createdAt >= :date', { date: last30Days })
      .getMany();
    return {
      last7DaysOrders: orders7.length,
      last7DaysRevenue: orders7.reduce((sum, order) => sum + (order.quantity || 0) * (order.product?.price || 0), 0),
      last30DaysOrders: orders30.length,
      last30DaysRevenue: orders30.reduce((sum, order) => sum + (order.quantity || 0) * (order.product?.price || 0), 0),
    };
  }
}