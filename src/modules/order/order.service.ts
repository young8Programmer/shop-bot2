import { Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { Order } from '../../entities/order.entity';

@Injectable()
export class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async create(userId: number, productId: number, quantity: number, phone: string, address: string, deliveryType: string, paymentMethod: string): Promise<Order> {
    const order = this.orderRepository.create({ user: { id: userId }, product: { id: productId }, quantity, phone, address, deliveryType, paymentMethod, status: 'pending' });
    return this.orderRepository.save(order);
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.orderRepository.find({ where: { user: { id: userId } }, relations: ['product'], order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: number, status: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (order) {
      order.status = status;
      return this.orderRepository.save(order);
    }
    throw new Error('Buyurtma topilmadi');
  }
}