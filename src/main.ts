import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as i18n from 'i18n';
import { join } from 'path';

i18n.configure({
  locales: ['uz', 'ru', 'en'],
  directory: join(__dirname, 'i18n'),
  defaultLocale: 'uz',
  objectNotation: true,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(i18n.middleware())
  await app.listen(3000);
}
bootstrap();