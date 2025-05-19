import { Repository } from 'typeorm';
import { Cart } from '../../entities/cart.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CartRepository extends Repository<Cart> {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
  ) {
    super(cartRepository.target, cartRepository.manager, cartRepository.queryRunner);
  }
}