import { Injectable } from '@nestjs/common';
import { CartRepository } from './cart.repository';

@Injectable()
export class CartService {
  constructor(private cartRepository: CartRepository) {}

  async findByUser(userId: number): Promise<any[]> { // `CartItem[]` ni entityga moslashtirish uchun `any[]` ishlatildi, entityni import qilish kerak
    return this.cartRepository.find({ where: { user: { id: userId } }, relations: ['product'] });
  }

  async add(userId: number, productId: number, quantity: number): Promise<void> {
    const existing = await this.cartRepository.findOne({ where: { user: { id: userId }, product: { id: productId } } });
    if (existing) {
      existing.quantity += quantity;
      await this.cartRepository.save(existing);
    } else {
      const cart = this.cartRepository.create({ user: { id: userId }, product: { id: productId }, quantity });
      await this.cartRepository.save(cart);
    }
  }

  async remove(userId: number, productId: number): Promise<void> {
    const cart = await this.cartRepository.findOne({ where: { user: { id: userId }, product: { id: productId } } });
    if (cart) {
      await this.cartRepository.remove(cart);
    }
  }

  async updateQuantity(userId: number, productId: number, quantity: number): Promise<void> {
    const cart = await this.cartRepository.findOne({ where: { user: { id: userId }, product: { id: productId } } });
    if (cart) {
      cart.quantity = quantity;
      await this.cartRepository.save(cart);
    }
  }
}