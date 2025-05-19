import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { telegramId } });
  }

  async create(telegramId: string, firstName: string, language: string): Promise<User> {
    const user = this.userRepository.create({ telegramId, firstName, language });
    return this.userRepository.save(user);
  }

  async updateLanguage(telegramId: string, language: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.language = language;
      return this.userRepository.save(user);
    }
    throw new Error('Foydalanuvchi topilmadi');
  }
}