import { Injectable } from '@nestjs/common';
import { CategoryRepository } from './category.repository';

@Injectable()
export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  async findAll(): Promise<any[]> { // `Category[]` ni entityga moslashtirish uchun `any[]` ishlatildi, entityni import qilish kerak
    return this.categoryRepository.find();
  }

  async create(nameUz: string, nameRu: string, nameEn: string): Promise<void> {
    const category = this.categoryRepository.create({ nameUz, nameRu, nameEn });
    await this.categoryRepository.save(category);
  }
}