import { Injectable } from '@nestjs/common';
import { MessageRepository } from './message.repository';

@Injectable()
export class MessageService {
  constructor(private messageRepository: MessageRepository) {}

  async create(userId: number, adminId: number, message: string) {
    const msg = this.messageRepository.create({ user: { id: userId }, admin: { id: adminId }, message });
    return this.messageRepository.save(msg);
  }

  async findByUser(userId: number) {
    return this.messageRepository.find({ where: [{ user: { id: userId } }, { admin: { id: userId } }], order: { createdAt: 'ASC' } });
  }
}