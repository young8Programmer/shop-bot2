import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {
    super(orderRepository.target, orderRepository.manager, orderRepository.queryRunner);
  }
}