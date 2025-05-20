import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({ relations: ['category'] });
  }

  async findByCategory(categoryId: number): Promise<Product[]> {
    return this.productRepository.find({
      where: { category: { id: categoryId } },
      relations: ['category'],
    });
  }

  async search(query: string): Promise<Product[]> {
    return this.productRepository.createQueryBuilder('product')
      .where('product.nameUz LIKE :query', { query: `%${query}%` })
      .orWhere('product.nameRu LIKE :query', { query: `%${query}%` })
      .orWhere('product.nameEn LIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async findOne(id: number): Promise<any> {
    return this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
  }

  async create(product: Partial<Product>): Promise<Product> {
    const newProduct = this.productRepository.create(product);
    return this.productRepository.save(newProduct);
  }

  async delete(id: number): Promise<void> {
    await this.productRepository.delete(id);
  }
}