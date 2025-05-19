import { Repository } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class MessageRepository extends Repository<Message> {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {
    super(messageRepository.target, messageRepository.manager, messageRepository.queryRunner);
  }
}