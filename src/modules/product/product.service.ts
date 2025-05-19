import { Injectable } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { Product } from '../../entities/product.entity';

@Injectable()
export class ProductService {
  constructor(private productRepository: ProductRepository) {}

  async findByCategory(categoryId: number): Promise<Product[]> {
    return this.productRepository.find({ where: { category: { id: categoryId }, isActive: true } });
  }

  async create(categoryId: number, nameUz: string, nameRu: string, nameEn: string, price: number, descriptionUz: string, descriptionRu: string, descriptionEn: string, imageUrl: string): Promise<Product> {
    const product = this.productRepository.create({ category: { id: categoryId }, nameUz, nameRu, nameEn, price, descriptionUz, descriptionRu, descriptionEn, imageUrl });
    return this.productRepository.save(product);
  }

  async update(id: number, nameUz: string, nameRu: string, nameEn: string, price: number, descriptionUz: string, descriptionRu: string, descriptionEn: string, imageUrl: string, isActive: boolean): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (product) {
      product.nameUz = nameUz;
      product.nameRu = nameRu;
      product.nameEn = nameEn;
      product.price = price;
      product.descriptionUz = descriptionUz;
      product.descriptionRu = descriptionRu;
      product.descriptionEn = descriptionEn;
      product.imageUrl = imageUrl;
      product.isActive = isActive;
      return this.productRepository.save(product);
    }
    throw new Error('Mahsulot topilmadi');
  }
}