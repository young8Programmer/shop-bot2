import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<any> {
    return this.userRepository.findOne({ where: { telegramId } });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(user);
    return this.userRepository.save(newUser);
  }

  async updateLanguage(telegramId: string, language: string): Promise<any> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.language = language;
      return this.userRepository.save(user);
    }
    return null;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }
}