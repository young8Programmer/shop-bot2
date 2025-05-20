import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message) private messageRepository: Repository<Message>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async create(messageData: Partial<Message>): Promise<Message> {
    const user = messageData.user ? await this.userRepository.findOneBy({ id: messageData.user.id }) : null;

    if (!user) {
      throw new Error('User topilmadi');
    }

    const newMessage = this.messageRepository.create({
      ...messageData,
      user: { id: user.id }, // Faqat ID bilan bog‘lash
      adminId: messageData.adminId,
      message: messageData.message,
    });

    return this.messageRepository.save(newMessage);
  }

  async findByUser(userId: number): Promise<Message[]> {
    return this.messageRepository.find({
      where: { user: { id: userId } },
    });
  }
}