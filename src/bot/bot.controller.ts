import { Controller } from '@nestjs/common';
import { BotService } from './bot.service';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

interface CustomContext {
  message?: TelegramBot.Message;
  chat: TelegramBot.Chat;
  from: TelegramBot.User;
  match?: RegExpExecArray;
  session: SessionData;
}

interface SessionData {
  step?: string;
  page?: number;
  categoryId?: number;
  phone?: string;
  address?: string;
  deliveryType?: string;
  product?: Partial<any>;
  category?: Partial<any>;
  productId?: number;
  language?: string;
  [key: string]: any;
}

interface Sessions {
  [userId: number]: SessionData;
}

@Controller('bot')
export class BotController {
  private bot: TelegramBot;
  private sessions: Sessions = {};
  private readonly adminIds: number[] = [5661241603];
  private readonly ITEMS_PER_PAGE = 5;
  private readonly DEFAULT_LANGUAGE = 'uz';

  constructor(
    private botService: BotService,
    private configService: ConfigService,
    private i18n: I18nService,
  ) {
    const botToken = this.configService.get<string>('BOT_TOKEN') || '7942071036:AAFz_o_p2p2o-Gq-1C1YZMQSdODCHJiu2dY';
    if (!botToken) throw new Error('BOT_TOKEN not found');
    this.bot = new TelegramBot(botToken, { polling: true });
    this.initializeBot();
  }

  private async getTranslation(key: string, lang: string, args?: any): Promise<string> {
    try {
      return await this.i18n.t(`translation.${key}`, { lang, args });
    } catch (error) {
      console.error(`Translation error for key "${key}" in language "${lang}":`, error);
      return `Translation missing for ${key}`;
    }
  }

  private initializeBot() {
    this.bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('prompts.enter_name', this.DEFAULT_LANGUAGE),
            { reply_markup: { force_reply: true } }
          );
          ctx.session.step = 'register_name';
        } else {
          ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
          await this.sendMainMenu(ctx);
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /start:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.on('message', async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user && ctx.session.step !== 'register_name') {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('errors.user_not_found', this.DEFAULT_LANGUAGE)
          );
          return;
        }
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;

        if (ctx.session.step === 'register_name' && msg.text) {
          if (!user) {
            await this.botService.createUser(ctx.from.id.toString(), msg.text!, this.DEFAULT_LANGUAGE);
            user = await this.botService.getUser(ctx.from.id.toString());
            if (!user) throw new Error('User creation failed');
          }
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.welcome', lang) + '\n' + (await this.getTranslation('prompts.choose_language', lang)),
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
                  [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
                  [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
                ],
              },
            }
          );
          delete ctx.session.step;
        } else if (msg.text === (await this.getTranslation('buttons.change_language', lang))) {
          await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('prompts.choose_language', lang), {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
                [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
                [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
              ],
            },
          });
        } else if (ctx.session.step === 'support_message' && msg.text) {
          await this.botService.sendMessage(user!.id, this.adminIds[0].toString(), msg.text!);
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.support_message_sent', lang)
          );
          delete ctx.session.step;
        } else if (this.adminIds.includes(ctx.from.id)) {
          if (ctx.session.step === 'add_product_name' && msg.text) {
            ctx.session.product = { nameUz: msg.text };
            ctx.session.step = 'add_product_desc';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_desc_uz', lang)
            );
          } else if (ctx.session.step === 'add_product_desc' && msg.text) {
            ctx.session.product!.descriptionUz = msg.text;
            ctx.session.step = 'add_product_name_ru';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_name_ru', lang)
            );
          } else if (ctx.session.step === 'add_product_name_ru' && msg.text) {
            ctx.session.product!.nameRu = msg.text;
            ctx.session.step = 'add_product_desc_ru';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_desc_ru', lang)
            );
          } else if (ctx.session.step === 'add_product_desc_ru' && msg.text) {
            ctx.session.product!.descriptionRu = msg.text;
            ctx.session.step = 'add_product_name_en';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_name_en', lang)
            );
          } else if (ctx.session.step === 'add_product_name_en' && msg.text) {
            ctx.session.product!.nameEn = msg.text;
            ctx.session.step = 'add_product_desc_en';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_desc_en', lang)
            );
          } else if (ctx.session.step === 'add_product_desc_en' && msg.text) {
            ctx.session.product!.descriptionEn = msg.text;
            ctx.session.step = 'add_product_price';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_price', lang)
            );
          } else if (ctx.session.step === 'add_product_price' && msg.text) {
            const price = parseInt(msg.text, 10);
            if (isNaN(price) || price <= 0) {
              await this.bot.sendMessage(
                ctx.chat.id,
                await this.getTranslation('errors.invalid_price', lang)
              );
              return;
            }
            ctx.session.product!.price = price;
            ctx.session.step = 'add_product_category';
            const categories = await this.botService.getCategories();
            const buttons = categories.map((cat) => [
              {
                text: cat[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`],
                callback_data: `set_category_${cat.id}`,
              },
            ]);
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.select_category', lang),
              { reply_markup: { inline_keyboard: buttons } }
            );
          } else if (ctx.session.step === 'broadcast' && msg.text) {
            const users = await this.botService.getAllUsers();
            for (const u of users) {
              await this.bot.sendMessage(u.telegramId, msg.text);
            }
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('messages.broadcast_sent', lang)
            );
            delete ctx.session.step;
          } else if (ctx.session.step === 'add_category_name' && msg.text) {
            ctx.session.category = { nameUz: msg.text };
            ctx.session.step = 'add_category_name_ru';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_category_name_ru', lang)
            );
          } else if (ctx.session.step === 'add_category_name_ru' && msg.text) {
            ctx.session.category!.nameRu = msg.text;
            ctx.session.step = 'add_category_name_en';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_category_name_en', lang)
            );
          } else if (ctx.session.step === 'add_category_name_en' && msg.text) {
            ctx.session.category!.nameEn = msg.text;
            await this.botService.createCategory(ctx.session.category!);
            await this.showCategoryManagement(ctx);
            delete ctx.session.step;
            delete ctx.session.category;
          }
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in message handler:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      if (!callbackQuery.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        chat: callbackQuery.message!.chat,
        from: callbackQuery.from,
        session: this.sessions[callbackQuery.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const data = callbackQuery.data;

        if (data?.startsWith('lang_')) {
          const newLang = data.split('_')[1];
          await this.botService.updateLanguage(ctx.from.id.toString(), newLang);
          user = await this.botService.getUser(ctx.from.id.toString());
          ctx.session.language = newLang;
          await this.sendMainMenu(ctx);
          await this.bot.answerCallbackQuery(callbackQuery.id!);
        } else if (data?.startsWith('category_')) {
          const categoryId = parseInt(data.split('_')[1], 10);
          ctx.session.categoryId = categoryId;
          ctx.session.page = 0;
          await this.showProducts(ctx, categoryId);
          await this.bot.answerCallbackQuery(callbackQuery.id!);
        } else if (data === 'next' || data === 'prev') {
          const categoryId = ctx.session.categoryId;
          if (categoryId) {
            ctx.session.page = data === 'next' ? (ctx.session.page || 0) + 1 : (ctx.session.page || 1) - 1;
            await this.showProducts(ctx, categoryId);
            await this.bot.answerCallbackQuery(callbackQuery.id!);
          }
        } else if (data === 'delivery' || data === 'pickup') {
          ctx.session.deliveryType = data;
          await this.showPaymentOptions(ctx);
          await this.bot.answerCallbackQuery(callbackQuery.id!);
        } else if (data?.startsWith('payment_')) {
          const paymentMethod = data.split('_')[1];
          const cart = await this.botService.getCart(user.id);
          if (!cart.length) {
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('messages.cart_empty', lang)
            );
            await this.bot.answerCallbackQuery(callbackQuery.id!);
            return;
          }
          for (const item of cart) {
            await this.botService.createOrder(
              user.id,
              item.product.id,
              item.quantity,
              ctx.session.phone || '',
              ctx.session.address || '',
              ctx.session.deliveryType || 'delivery',
              paymentMethod
            );
          }
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.order_placed', lang)
          );
          await this.botService.clearCart(user.id);
          ctx.session = { language: lang };
          await this.bot.answerCallbackQuery(callbackQuery.id!);
        } else if (this.adminIds.includes(ctx.from.id)) {
          if (data === 'manage_products') {
            await this.showProductManagement(ctx);
          } else if (data === 'manage_categories') {
            await this.showCategoryManagement(ctx);
          } else if (data === 'view_orders') {
            await this.showOrdersAdmin(ctx);
          } else if (data === 'statistics') {
            await this.showStatistics(ctx);
          } else if (data === 'broadcast') {
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.broadcast_message', lang)
            );
            ctx.session.step = 'broadcast';
          } else if (data === 'view_users') {
            await this.showUsers(ctx);
          } else if (data?.startsWith('add_product')) {
            ctx.session.step = 'add_product_name';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_product_name_uz', lang)
            );
          } else if (data?.startsWith('edit_product_')) {
            const productId = parseInt(data.split('_')[2], 10);
            ctx.session.productId = productId;
            await this.showEditProduct(ctx, productId);
          } else if (data?.startsWith('delete_product_')) {
            const productId = parseInt(data.split('_')[2], 10);
            await this.botService.deleteProduct(productId);
            await this.showProductManagement(ctx);
          } else if (data?.startsWith('add_category')) {
            ctx.session.step = 'add_category_name';
            await this.bot.sendMessage(
              ctx.chat.id,
              await this.getTranslation('prompts.enter_category_name_uz', lang)
            );
          } else if (data?.startsWith('edit_category_')) {
            const categoryId = parseInt(data.split('_')[2], 10);
            ctx.session.categoryId = categoryId;
            await this.showEditCategory(ctx, categoryId);
          } else if (data?.startsWith('delete_category_')) {
            const categoryId = parseInt(data.split('_')[2], 10);
            await this.botService.deleteCategory(categoryId);
            await this.showCategoryManagement(ctx);
          } else if (data?.startsWith('update_order_')) {
            const [_, orderId, status] = data.split('_');
            await this.botService.updateOrderStatus(parseInt(orderId, 10), status);
            await this.showOrdersAdmin(ctx);
          } else if (data?.startsWith('set_category_')) {
            const categoryId = parseInt(data.split('_')[2], 10);
            ctx.session.product!.category = { id: categoryId };
            await this.botService.createProduct(ctx.session.product!);
            await this.showProductManagement(ctx);
            delete ctx.session.step;
            delete ctx.session.product;
          }
          await this.bot.answerCallbackQuery(callbackQuery.id!);
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in callback_query:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
        await this.bot.answerCallbackQuery(callbackQuery.id!);
      }
    });

    this.bot.onText(/\/products|Mahsulotlar|Товары/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        ctx.session.page = 0;
        await this.showCategories(ctx);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /products:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/search (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        match,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const query = match[1];
        const products = await this.botService.searchProducts(query);
        if (!products.length) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.no_products_found', lang)
          );
          return;
        }
        let message = (await this.getTranslation('messages.found_products', lang)) + '\n';
        products.forEach((product, index) => {
          const name = product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
          message += `${index + 1}. ${name} - ${product.price} UZS\n/add_${product.id}\n`;
        });
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /search:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.search', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/add_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        match,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const productId = parseInt(match[1], 10);
        await this.botService.addToCart(user.id, productId, 1);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('messages.added_to_cart', lang)
        );
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /add:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/remove_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        match,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const productId = parseInt(match[1], 10);
        await this.botService.removeFromCart(user.id, productId);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('messages.removed_from_cart', lang)
        );
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /remove:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/set_quantity_(\d+) (\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        match,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const productId = parseInt(match[1], 10);
        const quantity = parseInt(match[2], 10);
        if (quantity <= 0) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('errors.invalid_quantity', lang)
          );
          return;
        }
        await this.botService.updateCartQuantity(user.id, productId, quantity);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('messages.quantity_updated', lang)
        );
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /set_quantity:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/Savat|Корзина|Cart/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const cart = await this.botService.getCart(user.id);
        if (!cart.length) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.cart_empty', lang)
          );
          return;
        }
        let message = (await this.getTranslation('messages.cart', lang)) + '\n';
        for (const item of cart) {
          const name = item.product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
          message += `${name} - ${item.quantity} ${await this.getTranslation('common.units', lang)} - ${item.product.price * item.quantity} UZS\n/remove_${item.product.id} | /set_quantity_${item.product.id} <${await this.getTranslation('common.quantity', lang)}>\n`;
        }
        message += '\n' + (await this.getTranslation('prompts.place_order', lang)) + ': /place_order';
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in Cart:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/place_order/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const cart = await this.botService.getCart(user.id);
        if (!cart.length) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.cart_empty', lang)
          );
          return;
        }
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('prompts.enter_phone', lang),
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: await this.getTranslation('buttons.send_phone', lang),
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
        ctx.session.step = 'get_phone';
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /place_order:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.on('contact', async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        if (ctx.session.step === 'get_phone') {
          const phone = msg.contact?.phone_number;
          if (!phone) throw new Error('Phone number not found');
          ctx.session.phone = phone;
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('prompts.enter_address', lang),
            {
              reply_markup: {
                keyboard: [
                  [
                    {
                      text: await this.getTranslation('buttons.send_location', lang),
                      request_location: true,
                    },
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }
          );
          ctx.session.step = 'get_location';
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in contact:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.on('location', async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        if (ctx.session.step === 'get_location') {
          const location = msg.location;
          if (!location) throw new Error('Location not found');
          ctx.session.address = `Lat: ${location.latitude}, Lon: ${location.longitude}`;
          await this.showDeliveryOptions(ctx);
          ctx.session.step = 'delivery_option';
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in location:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/order_history|Buyurtmalar tarixi|История заказов/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        const orders = await this.botService.getOrders(user.id);
        if (!orders.length) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('messages.no_orders', lang)
          );
          return;
        }
        let message = (await this.getTranslation('messages.order_history', lang)) + '\n';
        for (const order of orders) {
          const name = order.product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
          message += `${name} - ${order.quantity} ${await this.getTranslation('common.units', lang)} - ${order.status}\n`;
        }
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /order_history:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/support|Qo‘llab-quvvatlash|Поддержка/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('prompts.support_message', lang)
        );
        ctx.session.step = 'support_message';
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /support:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });

    this.bot.onText(/\/admin/, async (msg: TelegramBot.Message) => {
      if (!msg.from?.id) throw new Error('User ID not found');
      const ctx: CustomContext = {
        message: msg,
        chat: msg.chat,
        from: msg.from,
        session: this.sessions[msg.from.id] || { language: this.DEFAULT_LANGUAGE },
      };
      let user;
      try {
        user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('User not found');
        ctx.session.language = user.language || this.DEFAULT_LANGUAGE;
        const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
        if (!this.adminIds.includes(ctx.from.id)) {
          await this.bot.sendMessage(
            ctx.chat.id,
            await this.getTranslation('errors.no_admin_access', lang)
          );
          return;
        }
        await this.sendAdminMenu(ctx);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /admin:', error);
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('errors.general', ctx.session.language || this.DEFAULT_LANGUAGE)
        );
      }
    });
  }

  private async sendMainMenu(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('messages.welcome', lang), {
        reply_markup: {
          keyboard: [
            [
              { text: await this.getTranslation('buttons.products', lang) },
              { text: await this.getTranslation('buttons.cart', lang) },
            ],
            [
              { text: await this.getTranslation('buttons.order_history', lang) },
              { text: await this.getTranslation('buttons.support', lang) },
            ],
            [{ text: await this.getTranslation('buttons.change_language', lang) }],
          ],
          resize_keyboard: true,
        },
      });
    } catch (error) {
      console.error('Error in sendMainMenu:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showCategories(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const categories = await this.botService.getCategories();
      if (!categories.length) {
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('messages.no_categories', lang)
        );
        return;
      }
      const buttons = categories.map((cat) => [
        {
          text: cat[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`],
          callback_data: `category_${cat.id}`,
        },
      ]);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('messages.categories', lang), {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (error) {
      console.error('Error in showCategories:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showProducts(ctx: CustomContext, categoryId: number) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const products = await this.botService.getProducts(categoryId);
      if (!products.length) {
        await this.bot.sendMessage(
          ctx.chat.id,
          await this.getTranslation('messages.no_products', lang)
        );
        return;
      }
      const page = ctx.session.page || 0;
      const start = page * this.ITEMS_PER_PAGE;
      const end = start + this.ITEMS_PER_PAGE;
      const paginatedProducts = products.slice(start, end);
      let message = (await this.getTranslation('messages.products', lang)) + '\n';
      paginatedProducts.forEach((product) => {
        const name = product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
        message += `${name} - ${product.price} UZS\n/add_${product.id}\n`;
      });
      const inlineKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      if (start > 0)
        inlineKeyboard.push([
          { text: await this.getTranslation('buttons.previous', lang), callback_data: 'prev' },
        ]);
      if (end < products.length)
        inlineKeyboard.push([
          { text: await this.getTranslation('buttons.next', lang), callback_data: 'next' },
        ]);
      await this.bot.sendMessage(ctx.chat.id, message, {
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } catch (error) {
      console.error('Error in showProducts:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showDeliveryOptions(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('prompts.select_delivery', lang), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: await this.getTranslation('buttons.delivery', lang), callback_data: 'delivery' },
            ],
            [{ text: await this.getTranslation('buttons.pickup', lang), callback_data: 'pickup' }],
          ],
        },
      });
    } catch (error) {
      console.error('Error in showDeliveryOptions:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showPaymentOptions(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('prompts.select_payment', lang), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: await this.getTranslation('buttons.cash', lang), callback_data: 'payment_cash' },
            ],
            [{ text: 'Payme', callback_data: 'payment_payme' }],
            [{ text: 'Click', callback_data: 'payment_click' }],
            [{ text: 'Stripe', callback_data: 'payment_stripe' }],
            [
              {
                text: await this.getTranslation('buttons.onspot', lang),
                callback_data: 'payment_onspot',
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error('Error in showPaymentOptions:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async sendAdminMenu(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('messages.admin_panel', lang), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: await this.getTranslation('buttons.manage_products', lang),
                callback_data: 'manage_products',
              },
            ],
            [
              {
                text: await this.getTranslation('buttons.manage_categories', lang),
                callback_data: 'manage_categories',
              },
            ],
            [
              {
                text: await this.getTranslation('buttons.view_orders', lang),
                callback_data: 'view_orders',
              },
            ],
            [
              {
                text: await this.getTranslation('buttons.statistics', lang),
                callback_data: 'statistics',
              },
            ],
            [
              {
                text: await this.getTranslation('buttons.broadcast', lang),
                callback_data: 'broadcast',
              },
            ],
            [
              {
                text: await this.getTranslation('buttons.view_users', lang),
                callback_data: 'view_users',
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error('Error in sendAdminMenu:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showProductManagement(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const products = await this.botService.getAllProducts();
      let message = (await this.getTranslation('messages.products', lang)) + '\n';
      products.forEach((product) => {
        const name = product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
        message += `${name} - ${product.price} UZS\n/edit_product_${product.id} | /delete_product_${product.id}\n`;
      });
      message += '\n' + (await this.getTranslation('prompts.add_product', lang)) + ': /add_product';
      await this.bot.sendMessage(ctx.chat.id, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: await this.getTranslation('buttons.add_product', lang),
                callback_data: 'add_product',
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error('Error in showProductManagement:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showEditProduct(ctx: CustomContext, productId: number) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const product = await this.botService.getProduct(productId);
      if (!product) throw new Error('Product not found');
      ctx.session.step = 'edit_product_name';
      const name = product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
      await this.bot.sendMessage(
        ctx.chat.id,
        await this.getTranslation('prompts.edit_product_name', lang, { current: name }),
        { reply_markup: { force_reply: true } }
      );
      ctx.session.product = product;
      this.sessions[ctx.from.id] = ctx.session;
    } catch (error) {
      console.error('Error in showEditProduct:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showCategoryManagement(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const categories = await this.botService.getCategories();
      let message = (await this.getTranslation('messages.categories', lang)) + '\n';
      categories.forEach((cat) => {
        const name = cat[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
        message += `${name}\n/edit_category_${cat.id} | /delete_category_${cat.id}\n`;
      });
      message += '\n' + (await this.getTranslation('prompts.add_category', lang)) + ': /add_category';
      await this.bot.sendMessage(ctx.chat.id, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: await this.getTranslation('buttons.add_category', lang),
                callback_data: 'add_category',
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error('Error in showCategoryManagement:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showEditCategory(ctx: CustomContext, categoryId: number) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const category = await this.botService.getCategory(categoryId);
      if (!category) throw new Error('Category not found');
      ctx.session.step = 'edit_category_name';
      const name = category[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
      await this.bot.sendMessage(
        ctx.chat.id,
        await this.getTranslation('prompts.edit_category_name', lang, { current: name }),
        { reply_markup: { force_reply: true } }
      );
      ctx.session.category = category;
      this.sessions[ctx.from.id] = ctx.session;
    } catch (error) {
      console.error('Error in showEditCategory:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showOrdersAdmin(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const orders = await this.botService.getAllOrders();
      const units = await this.getTranslation('common.units', lang); // Fetch translation once
      let message = (await this.getTranslation('messages.orders', lang)) + '\n';
      for (const order of orders) {
        const name = order.product[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
        message += `${order.id}. ${name} - ${order.quantity} ${units} - ${order.status}\n/update_order_${order.id}_new | /update_order_${order.id}_processing | /update_order_${order.id}_closed\n`;
      }
      await this.bot.sendMessage(ctx.chat.id, message);
    } catch (error) {
      console.error('Error in showOrdersAdmin:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showStatistics(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const stats = await this.botService.getStatistics();
      const message = await this.getTranslation('messages.statistics', lang, {
        last7DaysOrders: stats.last7DaysOrders,
        last7DaysRevenue: stats.last7DaysRevenue,
        last30DaysOrders: stats.last30DaysOrders,
        last30DaysRevenue: stats.last30DaysRevenue,
      });
      await this.bot.sendMessage(ctx.chat.id, message);
    } catch (error) {
      console.error('Error in showStatistics:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }

  private async showUsers(ctx: CustomContext) {
    const lang = ctx.session.language || this.DEFAULT_LANGUAGE;
    try {
      const users = await this.botService.getAllUsers();
      let message = (await this.getTranslation('messages.users', lang)) + '\n';
      users.forEach((user) => {
        message += `${user.firstName} (${user.telegramId}) - ${user.language || this.DEFAULT_LANGUAGE}\n`;
      });
      await this.bot.sendMessage(ctx.chat.id, message);
    } catch (error) {
      console.error('Error in showUsers:', error);
      await this.bot.sendMessage(ctx.chat.id, await this.getTranslation('errors.general', lang));
    }
  }
}