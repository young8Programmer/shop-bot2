import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { Product } from '../../entities/product.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}

  async create(orderData: Partial<Order> & { user: { id: number }; product: { id: number } }): Promise<Order> {
    // User va Product ni topamiz
    const user = await this.userRepository.findOne({ where: { id: orderData.user.id } });
    const product = await this.productRepository.findOne({ where: { id: orderData.product.id } });

    if (!user || !product) {
      throw new Error('User yoki Product topilmadi');
    }

    // Order obyectini yaratamiz
    const newOrder = this.orderRepository.create({
      user, // To‘liq user obyecti
      product, // To‘liq product obyecti
      quantity: orderData.quantity,
      phone: orderData.phone,
      address: orderData.address,
      deliveryType: orderData.deliveryType,
      paymentMethod: orderData.paymentMethod,
      status: orderData.status || 'new',
    });

    return this.orderRepository.save(newOrder);
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { user: { id: userId } },
      relations: ['product', 'user'],
    });
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['product', 'user'],
    });
  }

  async updateStatus(orderId: number, status: string): Promise<void> {
    await this.orderRepository.update(orderId, { status });
  }
}