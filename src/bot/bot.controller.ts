import { Controller } from '@nestjs/common';
import { BotService } from './bot.service';
import * as TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import * as i18n from 'i18n';
import { join } from 'path';

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
  private readonly adminId: number;
  private readonly ITEMS_PER_PAGE = 5;

  constructor(
    private botService: BotService,
    private configService: ConfigService,
  ) {
    this.adminId = 5661241603;
    const botToken = "7942071036:AAFz_o_p2p2o-Gq-1C1YZMQSdODCHJiu2dY";
    if (!botToken) throw new Error('BOT_TOKEN topilmadi');
    this.bot = new TelegramBot(botToken, { polling: true });
    i18n.configure({
      locales: ['uz', 'ru', 'en'],
      directory: join(__dirname, 'i18n'),
      defaultLocale: 'uz',
      objectNotation: true,
    });
    this.initializeBot();
  }

  private initializeBot() {
    this.bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        let user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_name', locale: 'uz' }), { reply_markup: { force_reply: true } });
          ctx.session = { ...ctx.session, step: 'register_name' };
        } else {
          ctx.session.language = user.language;
          await this.sendMainMenu(ctx);
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in /start:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('message', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.session.step === 'register_name' && msg.text) {
          const name = msg.text;
          await this.botService.createUser(ctx.from.id.toString(), name, 'uz');
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'welcome', locale: 'uz' }) + ' ' + i18n.__({ phrase: 'choose_language', locale: 'uz' }), {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🇺🇿 O‘zbek', callback_data: 'lang_uz' }],
                [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
                [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
              ],
            },
          });
          delete ctx.session.step;
          this.sessions[ctx.from.id] = ctx.session;
        }
      } catch (error) {
        console.error('Error in register_name:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (callbackQuery.data?.startsWith('lang_')) {
          const lang = callbackQuery.data.split('_')[1];
          let user = await this.botService.getUser(ctx.from.id.toString());
          if (!user) {
            user = await this.botService.createUser(ctx.from.id.toString(), ctx.from.first_name || 'Unknown', lang);
          } else {
            user = await this.botService.updateLanguage(ctx.from.id.toString(), lang);
          }
          ctx.session.language = lang;
          await this.sendMainMenu(ctx);
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[ctx.from.id] = ctx.session;
        }
      } catch (error) {
        console.error('Error in setLanguage:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Mahsulotlarni ko‘rsatish
    this.bot.onText(/Mahsulotlar|Товары|Products/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        ctx.session.page = 0;
        await this.showCategories(ctx);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showCategories:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Kategoriyalarni ko‘rsatish
    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const data = callbackQuery.data;
        if (data?.startsWith('category_')) {
          const categoryId = parseInt(data.split('_')[1], 10);
          ctx.session.categoryId = categoryId;
          ctx.session.page = 0;
          await this.showProducts(ctx, categoryId);
          await this.bot.answerCallbackQuery(callbackQuery.id);
        } else if (data === 'next' || data === 'prev') {
          const categoryId = ctx.session.categoryId;
          if (categoryId) {
            ctx.session.page = data === 'next' ? (ctx.session.page || 0) + 1 : (ctx.session.page || 1) - 1;
            await this.showProducts(ctx, categoryId);
            await this.bot.answerCallbackQuery(callbackQuery.id);
          }
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showProducts:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Qidiruv
    this.bot.onText(/\/search (.+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const query = match[1];
        const products = await this.botService.searchProducts(query);
        if (!products.length) {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'no_products_found', locale: ctx.session.language || 'uz' }));
          return;
        }
        let message = i18n.__({ phrase: 'found_products', locale: ctx.session.language || 'uz' }) + '\n';
        products.forEach((product, index) => {
          const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof product;
          message += `${index + 1}. ${product[nameField] || product.nameUz} - ${product.price} UZS\n/add_${product.id}\n`;
        });
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in search:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'search_error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Savatga qo‘shish, o‘chirish, sonini o‘zgartirish
    this.bot.onText(/\/add_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const productId = parseInt(match[1], 10);
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        await this.botService.addToCart(user.id, productId, 1);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'product_added', locale: ctx.session.language || 'uz' }));
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in addToCart:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.onText(/\/remove_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const productId = parseInt(match[1], 10);
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        await this.botService.removeFromCart(user.id, productId);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'product_removed', locale: ctx.session.language || 'uz' }));
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in removeFromCart:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.onText(/\/set_quantity_(\d+) (\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const productId = parseInt(match[1], 10);
        const quantity = parseInt(match[2], 10);
        if (quantity <= 0) throw new Error('Son 0 dan katta bo‘lishi kerak');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        await this.botService.updateCartQuantity(user.id, productId, quantity);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'quantity_updated', locale: ctx.session.language || 'uz' }));
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in setQuantity:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Savatni ko‘rsatish
    this.bot.onText(/Savat|Корзина|Cart/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        const cart = await this.botService.getCart(user.id);
        if (!cart.length) {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'empty_cart', locale: ctx.session.language || 'uz' }));
          return;
        }
        let message = i18n.__({ phrase: 'cart', locale: ctx.session.language || 'uz' }) + ':\n';
        cart.forEach((item) => {
          const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof item.product;
          message += `${item.product[nameField] || item.product.nameUz} - ${item.quantity} ${i18n.__({ phrase: 'pieces', locale: ctx.session.language || 'uz' })} - ${item.product.price * item.quantity} UZS\n/remove_${item.product.id} | /set_quantity_${item.product.id} <${i18n.__({ phrase: 'quantity', locale: ctx.session.language || 'uz' })}>\n`;
        });
        message += '\n' + i18n.__({ phrase: 'place_order', locale: ctx.session.language || 'uz' }) + ': /place_order';
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showCart:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Buyurtma berish
    this.bot.onText(/\/place_order/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_phone', locale: ctx.session.language || 'uz' }), {
          reply_markup: { keyboard: [[{ text: i18n.__({ phrase: 'send_phone', locale: ctx.session.language || 'uz' }), request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
        });
        ctx.session.step = 'get_phone';
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in placeOrder:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('contact', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.session.step === 'get_phone') {
          const phone = msg.contact?.phone_number;
          if (!phone) throw new Error('Telefon raqami topilmadi');
          ctx.session.phone = phone;
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_address', locale: ctx.session.language || 'uz' }), {
            reply_markup: { keyboard: [[{ text: i18n.__({ phrase: 'send_location', locale: ctx.session.language || 'uz' }), request_location: true }]], resize_keyboard: true, one_time_keyboard: true },
          });
          ctx.session.step = 'get_location';
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in getPhone:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('location', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.session.step === 'get_location') {
          const location = msg.location;
          if (!location) throw new Error('Lokatsiya topilmadi');
          ctx.session.address = `Lat: ${location.latitude}, Lon: ${location.longitude}`;
          await this.showDeliveryOptions(ctx);
          ctx.session.step = 'delivery_option';
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in getLocation:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Yetkazib berish turi
    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (callbackQuery.data === 'delivery' || callbackQuery.data === 'pickup') {
          ctx.session.deliveryType = callbackQuery.data;
          await this.showPaymentOptions(ctx);
          await this.bot.answerCallbackQuery(callbackQuery.id);
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in setDeliveryType:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // To‘lov usuli
    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (callbackQuery.data?.startsWith('payment_')) {
          const paymentMethod = callbackQuery.data.split('_')[1];
          const user = await this.botService.getUser(ctx.from.id.toString());
          if (!user) throw new Error('Foydalanuvchi topilmadi');
          ctx.session.language = user.language;
          const cart = await this.botService.getCart(user.id);
          if (!cart.length) {
            await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'empty_cart', locale: ctx.session.language || 'uz' }));
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
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'order_placed', locale: ctx.session.language || 'uz' }));
          await this.botService.clearCart(user.id);
          ctx.session = {};
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[ctx.from.id] = ctx.session;
        }
      } catch (error) {
        console.error('Error in setPaymentMethod:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Buyurtmalar tarixi
    this.bot.onText(/Buyurtmalar tarixi|История заказов|Order History/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        const orders = await this.botService.getOrders(user.id);
        if (!orders.length) {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'no_orders', locale: ctx.session.language || 'uz' }));
          return;
        }
        let message = i18n.__({ phrase: 'order_history', locale: ctx.session.language || 'uz' }) + ':\n';
        orders.forEach((order) => {
          const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof order.product;
          message += `${order.product[nameField] || order.product.nameUz} - ${order.quantity} ${i18n.__({ phrase: 'pieces', locale: ctx.session.language || 'uz' })} - ${order.status}\n`;
        });
        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showOrders:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Qo‘llab-quvvatlash
    this.bot.onText(/Qo‘llab-quvvatlash|Поддержка|Support/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) throw new Error('Foydalanuvchi topilmadi');
        ctx.session.language = user.language;
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'support_message', locale: ctx.session.language || 'uz' }));
        ctx.session.step = 'support_message';
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in supportChat:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('message', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.session.step === 'support_message' && msg.text) {
          const user = await this.botService.getUser(ctx.from.id.toString());
          if (!user) throw new Error('Foydalanuvchi topilmadi');
          ctx.session.language = user.language;
          await this.botService.sendMessage(user.id, this.adminId.toString(), msg.text);
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'message_sent', locale: ctx.session.language || 'uz' }));
          delete ctx.session.step;
          this.sessions[ctx.from.id] = ctx.session;
        }
      } catch (error) {
        console.error('Error in supportMessage:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    // Admin paneli
    this.bot.onText(/\/admin/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.from.id !== this.adminId) {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'no_admin_rights', locale: ctx.session.language || 'uz' }));
          return;
        }
        await this.sendAdminMenu(ctx);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in admin:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.from.id !== this.adminId) return;
        const data = callbackQuery.data;
        if (data === 'manage_products') {
          await this.showProductManagement(ctx);
        } else if (data === 'manage_categories') {
          await this.showCategoryManagement(ctx);
        } else if (data === 'view_orders') {
          await this.showOrdersAdmin(ctx);
        } else if (data === 'statistics') {
          await this.showStatistics(ctx);
        } else if (data === 'broadcast') {
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'send_broadcast', locale: ctx.session.language || 'uz' }));
          ctx.session.step = 'broadcast';
        } else if (data === 'view_users') {
          await this.showUsers(ctx);
        } else if (data?.startsWith('add_product')) {
          ctx.session.step = 'add_product_name';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_name_uz', locale: ctx.session.language || 'uz' }));
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
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_category_name_uz', locale: ctx.session.language || 'uz' }));
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
        }
        await this.bot.answerCallbackQuery(callbackQuery.id);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in admin callback:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('message', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from!, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.from.id !== this.adminId) return;
        if (ctx.session.step === 'add_product_name' && msg.text) {
          ctx.session.product = { nameUz: msg.text, step: 'add_product_desc' };
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_desc_uz', locale: ctx.session.language || 'uz' }));
          ctx.session.step = 'add_product_desc';
        } else if (ctx.session.step === 'add_product_desc' && msg.text) {
          ctx.session.product!.descriptionUz = msg.text;
          ctx.session.step = 'add_product_name_ru';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_name_ru', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_product_name_ru' && msg.text) {
          ctx.session.product!.nameRu = msg.text;
          ctx.session.step = 'add_product_desc_ru';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_desc_ru', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_product_desc_ru' && msg.text) {
          ctx.session.product!.descriptionRu = msg.text;
          ctx.session.step = 'add_product_name_en';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_name_en', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_product_name_en' && msg.text) {
          ctx.session.product!.nameEn = msg.text;
          ctx.session.step = 'add_product_desc_en';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_desc_en', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_product_desc_en' && msg.text) {
          ctx.session.product!.descriptionEn = msg.text;
          ctx.session.step = 'add_product_price';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_product_price', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_product_price' && msg.text) {
          ctx.session.product!.price = parseInt(msg.text, 10);
          ctx.session.step = 'add_product_category';
          const categories = await this.botService.getCategories();
          const buttons = categories.map((cat) => {
            const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof cat;
            return [{ text: cat[nameField] || cat.nameUz, callback_data: `set_category_${cat.id}` }];
          });
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'choose_category', locale: ctx.session.language || 'uz' }), { reply_markup: { inline_keyboard: buttons } });
        } else if (ctx.session.step === 'broadcast' && msg.text) {
          const users = await this.botService.getAllUsers();
          for (const user of users) {
            await this.bot.sendMessage(user.telegramId, msg.text);
          }
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'broadcast_sent', locale: ctx.session.language || 'uz' }));
          delete ctx.session.step;
        } else if (ctx.session.step === 'add_category_name' && msg.text) {
          ctx.session.category = { nameUz: msg.text };
          ctx.session.step = 'add_category_name_ru';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_category_name_ru', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_category_name_ru' && msg.text) {
          ctx.session.category!.nameRu = msg.text;
          ctx.session.step = 'add_category_name_en';
          await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'enter_category_name_en', locale: ctx.session.language || 'uz' }));
        } else if (ctx.session.step === 'add_category_name_en' && msg.text) {
          ctx.session.category!.nameEn = msg.text;
          await this.botService.createCategory(ctx.session.category!);
          await this.showCategoryManagement(ctx);
          delete ctx.session.step;
          delete ctx.session.category;
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in admin message:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { chat: callbackQuery.message!.chat, from: callbackQuery.from, session: this.sessions[callbackQuery.from.id] || {} };
      try {
        if (!ctx.from?.id) throw new Error('Foydalanuvchi ID topilmadi');
        if (ctx.from.id !== this.adminId) return;
        if (callbackQuery.data?.startsWith('set_category_')) {
          const categoryId = parseInt(callbackQuery.data.split('_')[2], 10);
          ctx.session.product!.category = { id: categoryId } as any;
          await this.botService.createProduct(ctx.session.product!);
          await this.showProductManagement(ctx);
          delete ctx.session.step;
          delete ctx.session.product;
          await this.bot.answerCallbackQuery(callbackQuery.id);
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in setCategory:', error);
        await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'error', locale: ctx.session.language || 'uz' }));
      }
    });
  }

  private async sendMainMenu(ctx: CustomContext) {
    const user = await this.botService.getUser(ctx.from.id.toString());
    if (!user) throw new Error('Foydalanuvchi topilmadi');
    ctx.session.language = user.language;
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'welcome', locale: ctx.session.language || 'uz' }), {
      reply_markup: {
        keyboard: [
          [
            { text: i18n.__({ phrase: 'products', locale: ctx.session.language || 'uz' }) },
            { text: i18n.__({ phrase: 'cart', locale: ctx.session.language || 'uz' }) },
          ],
          [
            { text: i18n.__({ phrase: 'order_history', locale: ctx.session.language || 'uz' }) },
            { text: i18n.__({ phrase: 'support', locale: ctx.session.language || 'uz' }) },
          ],
          [
            { text: i18n.__({ phrase: 'change_language', locale: ctx.session.language || 'uz' }) },
          ],
        ],
        resize_keyboard: true,
      },
    });
  }

  private async showCategories(ctx: CustomContext) {
    const categories = await this.botService.getCategories();
    if (!categories.length) {
      await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'no_categories', locale: ctx.session.language || 'uz' }));
      return;
    }
    const buttons = categories.map((cat) => {
      const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof cat;
      return [{ text: cat[nameField] || cat.nameUz, callback_data: `category_${cat.id}` }];
    });
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'categories', locale: ctx.session.language || 'uz' }), {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  private async showProducts(ctx: CustomContext, categoryId: number) {
    const products = await this.botService.getProducts(categoryId);
    if (!products.length) {
      await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'no_products', locale: ctx.session.language || 'uz' }));
      return;
    }
    const page = ctx.session.page || 0;
    const start = page * this.ITEMS_PER_PAGE;
    const end = start + this.ITEMS_PER_PAGE;
    const paginatedProducts = products.slice(start, end);
    let message = i18n.__({ phrase: 'products', locale: ctx.session.language || 'uz' }) + ':\n';
    paginatedProducts.forEach((product) => {
      const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof product;
      message += `${product[nameField] || product.nameUz} - ${product.price} UZS\n/add_${product.id}\n`;
    });
    const inlineKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
    if (start > 0) inlineKeyboard.push([{ text: i18n.__({ phrase: 'previous', locale: ctx.session.language || 'uz' }), callback_data: 'prev' }]);
    if (end < products.length) inlineKeyboard.push([{ text: i18n.__({ phrase: 'next', locale: ctx.session.language || 'uz' }), callback_data: 'next' }]);
    await this.bot.sendMessage(ctx.chat.id, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
  }

  private async showDeliveryOptions(ctx: CustomContext) {
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'choose_delivery', locale: ctx.session.language || 'uz' }), {
      reply_markup: {
        inline_keyboard: [
          [{ text: i18n.__({ phrase: 'delivery', locale: ctx.session.language || 'uz' }), callback_data: 'delivery' }],
          [{ text: i18n.__({ phrase: 'pickup', locale: ctx.session.language || 'uz' }), callback_data: 'pickup' }],
        ],
      },
    });
  }

  private async showPaymentOptions(ctx: CustomContext) {
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'choose_payment', locale: ctx.session.language || 'uz' }), {
      reply_markup: {
        inline_keyboard: [
          [{ text: i18n.__({ phrase: 'cash', locale: ctx.session.language || 'uz' }), callback_data: 'payment_cash' }],
          [{ text: 'Payme', callback_data: 'payment_payme' }],
          [{ text: 'Click', callback_data: 'payment_click' }],
          [{ text: 'Stripe', callback_data: 'payment_stripe' }],
          [{ text: i18n.__({ phrase: 'on_spot', locale: ctx.session.language || 'uz' }), callback_data: 'payment_onspot' }],
        ],
      },
    });
  }

  private async sendAdminMenu(ctx: CustomContext) {
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'admin_panel', locale: ctx.session.language || 'uz' }), {
      reply_markup: {
        inline_keyboard: [
          [{ text: i18n.__({ phrase: 'manage_products', locale: ctx.session.language || 'uz' }), callback_data: 'manage_products' }],
          [{ text: i18n.__({ phrase: 'manage_categories', locale: ctx.session.language || 'uz' }), callback_data: 'manage_categories' }],
          [{ text: i18n.__({ phrase: 'view_orders', locale: ctx.session.language || 'uz' }), callback_data: 'view_orders' }],
          [{ text: i18n.__({ phrase: 'statistics', locale: ctx.session.language || 'uz' }), callback_data: 'statistics' }],
          [{ text: i18n.__({ phrase: 'broadcast', locale: ctx.session.language || 'uz' }), callback_data: 'broadcast' }],
          [{ text: i18n.__({ phrase: 'view_users', locale: ctx.session.language || 'uz' }), callback_data: 'view_users' }],
        ],
      },
    });
  }

  private async showProductManagement(ctx: CustomContext) {
    const products = await this.botService.getAllProducts();
    let message = i18n.__({ phrase: 'products', locale: ctx.session.language || 'uz' }) + ':\n';
    products.forEach((product) => {
      const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof product;
      message += `${product[nameField] || product.nameUz} - ${product.price} UZS\n/edit_product_${product.id} | /delete_product_${product.id}\n`;
    });
    message += '\n' + i18n.__({ phrase: 'add_new_product', locale: ctx.session.language || 'uz' }) + ': /add_product';
    await this.bot.sendMessage(ctx.chat.id, message, { reply_markup: { inline_keyboard: [[{ text: i18n.__({ phrase: 'add_product', locale: ctx.session.language || 'uz' }), callback_data: 'add_product' }]] } });
  }

  private async showEditProduct(ctx: CustomContext, productId: number) {
    const product = await this.botService.getProduct(productId);
    if (!product) throw new Error('Mahsulot topilmadi');
    ctx.session.step = 'edit_product_name';
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'edit_product_name', locale: ctx.session.language || 'uz' }) + ` (hozirgi: ${product.nameUz}):`, { reply_markup: { force_reply: true } });
    ctx.session.product = product;
    this.sessions[ctx.from.id] = ctx.session;
  }

  private async showCategoryManagement(ctx: CustomContext) {
    const categories = await this.botService.getCategories();
    let message = i18n.__({ phrase: 'categories', locale: ctx.session.language || 'uz' }) + ':\n';
    categories.forEach((cat) => {
      const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof cat;
      message += `${cat[nameField] || cat.nameUz}\n/edit_category_${cat.id} | /delete_category_${cat.id}\n`;
    });
    message += '\n' + i18n.__({ phrase: 'add_new_category', locale: ctx.session.language || 'uz' }) + ': /add_category';
    await this.bot.sendMessage(ctx.chat.id, message, { reply_markup: { inline_keyboard: [[{ text: i18n.__({ phrase: 'add_category', locale: ctx.session.language || 'uz' }), callback_data: 'add_category' }]] } });
  }

  private async showEditCategory(ctx: CustomContext, categoryId: number) {
    const category = await this.botService.getCategory(categoryId);
    if (!category) throw new Error('Kategoriya topilmadi');
    ctx.session.step = 'edit_category_name';
    await this.bot.sendMessage(ctx.chat.id, i18n.__({ phrase: 'edit_category_name', locale: ctx.session.language || 'uz' }) + ` (hozirgi: ${category.nameUz}):`, { reply_markup: { force_reply: true } });
    ctx.session.category = category;
    this.sessions[ctx.from.id] = ctx.session;
  }

  private async showOrdersAdmin(ctx: CustomContext) {
    const orders = await this.botService.getAllOrders();
    let message = i18n.__({ phrase: 'orders', locale: ctx.session.language || 'uz' }) + ':\n';
    orders.forEach((order) => {
      const nameField = `name${(ctx.session.language || 'uz').charAt(0).toUpperCase() + (ctx.session.language || 'uz').slice(1)}` as keyof typeof order.product;
      message += `${order.id}. ${order.product[nameField] || order.product.nameUz} - ${order.quantity} ${i18n.__({ phrase: 'pieces', locale: ctx.session.language || 'uz' })} - ${order.status}\n/update_order_${order.id}_new | /update_order_${order.id}_processing | /update_order_${order.id}_closed\n`;
    });
    await this.bot.sendMessage(ctx.chat.id, message);
  }

  private async showStatistics(ctx: CustomContext) {
    const stats = await this.botService.getStatistics();
    const message = i18n.__({ phrase: 'statistics', locale: ctx.session.language || 'uz' }) + ':\n' +
      i18n.__({ phrase: 'last_7_days', locale: ctx.session.language || 'uz' }) + `: ${stats.last7DaysOrders} ${i18n.__({ phrase: 'orders', locale: ctx.session.language || 'uz' })}, ${stats.last7DaysRevenue} UZS\n` +
      i18n.__({ phrase: 'last_30_days', locale: ctx.session.language || 'uz' }) + `: ${stats.last30DaysOrders} ${i18n.__({ phrase: 'orders', locale: ctx.session.language || 'uz' })}, ${stats.last30DaysRevenue} UZS`;
    await this.bot.sendMessage(ctx.chat.id, message);
  }

  private async showUsers(ctx: CustomContext) {
    const users = await this.botService.getAllUsers();
    let message = i18n.__({ phrase: 'users', locale: ctx.session.language || 'uz' }) + ':\n';
    users.forEach((user) => {
      message += `${user.firstName} (${user.telegramId}) - ${user.language}\n`;
    });
    await this.bot.sendMessage(ctx.chat.id, message);
  }
}