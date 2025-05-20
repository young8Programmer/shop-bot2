import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from '../../entities/cart.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepository: Repository<Cart>,
  ) {}

  async add(userId: number, productId: number, quantity: number): Promise<void> {
    const cartItem = await this.cartRepository.findOne({
      where: {
        user: { id: userId },
        product: { id: productId },
      },
    });
    if (cartItem) {
      cartItem.quantity += quantity;
      await this.cartRepository.save(cartItem);
    } else {
      await this.cartRepository.save({
        user: { id: userId },
        product: { id: productId },
        quantity,
      });
    }
  }

  async remove(userId: number, productId: number): Promise<void> {
    await this.cartRepository.delete({
      user: { id: userId },
      product: { id: productId },
    });
  }

  async updateQuantity(userId: number, productId: number, quantity: number): Promise<void> {
    const cartItem = await this.cartRepository.findOne({
      where: {
        user: { id: userId },
        product: { id: productId },
      },
    });
    if (cartItem) {
      cartItem.quantity = quantity;
      await this.cartRepository.save(cartItem);
    }
  }

  async findByUser(userId: number): Promise<Cart[]> {
    return this.cartRepository.find({
      where: { user: { id: userId } },
      relations: ['product'],
    });
  }

  async clear(userId: number): Promise<void> {
    await this.cartRepository.delete({ user: { id: userId } });
  }
}