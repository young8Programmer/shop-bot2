import { Controller } from '@nestjs/common';
import { BotService } from './bot.service';
import * as TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

dotenv.config();

interface SessionData {
  phone?: string;
  address?: string;
  deliveryType?: string;
}

interface CustomContext {
  message?: TelegramBot.Message;
  chat?: TelegramBot.Chat;
  from?: TelegramBot.User;
  match?: RegExpExecArray;
  session: SessionData;
}

interface Sessions {
  [key: number]: SessionData;
}

@Controller('bot')
export class BotController {
  private bot: TelegramBot;
  private sessions: Sessions = {};

  constructor(private botService: BotService) {
    this.bot = new TelegramBot('7942071036:AAFz_o_p2p2o-Gq-1C1YZMQSdODCHJiu2dY', { polling: true });
    this.initializeBot();
  }

  private initializeBot() {
    this.bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Received /start command from user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        console.log('User fetched:', user);

        if (!user) {
          console.log('New user, prompting language selection');
          await this.bot.sendMessage(ctx.chat.id, 'Xush kelibsiz!', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🇺🇿 O\'zbek', callback_data: 'lang_uz' }],
                [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
                [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
              ],
            },
          });
        } else {
          console.log('Existing user, setting locale:', user.language);
          await this.bot.sendMessage(ctx.chat.id, 'Xush kelibsiz!', {
            reply_markup: {
              keyboard: [
                [{ text: 'Mahsulotlar' }, { text: 'Savat' }],
                [{ text: 'Buyurtmalar' }, { text: 'Qo\'llab-quvvatlash' }],
                [{ text: 'Tilni o\'zgartirish' }],
              ],
              resize_keyboard: true,
            },
          });
        }
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in start command:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { from: callbackQuery.from, session: this.sessions[callbackQuery.from?.id || 0] || {} };
      const data = callbackQuery.data;
      if (!data) return;

      if (data.startsWith('lang_')) {
        try {
          const lang = data.split('_')[1];
          let user = await this.botService.getUser(callbackQuery.from.id.toString());
          console.log('User fetched for language change:', user);

          if (!user) {
            console.log('Creating new user with language:', lang);
            user = await this.botService.createUser(callbackQuery.from.id.toString(), callbackQuery.from.first_name || 'Unknown', lang);
          } else {
            console.log('Updating user language to:', lang);
            user = await this.botService.updateLanguage(callbackQuery.from.id.toString(), lang);
          }

          await this.bot.sendMessage(callbackQuery.message.chat.id, 'Xush kelibsiz!', {
            reply_markup: {
              keyboard: [
                [{ text: 'Mahsulotlar' }, { text: 'Savat' }],
                [{ text: 'Buyurtmalar' }, { text: 'Qo\'llab-quvvatlash' }],
                [{ text: 'Tilni o\'zgartirish' }],
              ],
              resize_keyboard: true,
            },
          });
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[callbackQuery.from.id] = ctx.session;
        } catch (error) {
          console.error('Error in setLanguage:', error);
          await this.bot.sendMessage(callbackQuery.message.chat.id, 'Tilni o\'zgartirishda xatolik yuz berdi.');
        }
      }
    });

    this.bot.onText(/Mahsulotlar|Товары|Products/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Show categories triggered for user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const categories = await this.botService.getCategories();
        console.log('Categories fetched:', categories);

        if (!categories.length) {
          await this.bot.sendMessage(ctx.chat.id, 'Kategoriyalar mavjud emas.');
          return;
        }

        const buttons = categories.map((cat) => [{ text: cat.nameUz, callback_data: `category_${cat.id}` }]);
        await this.bot.sendMessage(ctx.chat.id, 'Kategoriyalar:', {
          reply_markup: { inline_keyboard: buttons },
        });
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showCategories:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Kategoriyalarni ko\'rsatishda xatolik yuz berdi.');
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { from: callbackQuery.from, session: this.sessions[callbackQuery.from?.id || 0] || {} };
      const data = callbackQuery.data;
      if (data?.startsWith('category_')) {
        try {
          const categoryId = parseInt(data.split('_')[1], 10);
          if (!categoryId) {
            await this.bot.sendMessage(callbackQuery.message.chat.id, 'Kategoriya topilmadi.');
            return;
          }

          if (!callbackQuery.from?.id) {
            throw new Error('Foydalanuvchi ID topilmadi');
          }

          const user = await this.botService.getUser(callbackQuery.from.id.toString());
          if (!user) {
            throw new Error('Foydalanuvchi topilmadi');
          }

          const products = await this.botService.getProducts(categoryId);
          console.log('Products fetched:', products);

          if (!products.length) {
            await this.bot.sendMessage(callbackQuery.message.chat.id, 'Ushbu kategoriyada mahsulotlar mavjud emas.');
            return;
          }

          let message = 'Mahsulotlar:\n';
          products.forEach((product, index) => {
            message += `${index + 1}. ${product.nameUz} - ${product.price} UZS\nTavsif: ${product.descriptionUz}\nSavatga qo\'shish: /add_${product.id}\n\n`;
          });

          await this.bot.sendMessage(callbackQuery.message.chat.id, message);
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[callbackQuery.from.id] = ctx.session;
        } catch (error) {
          console.error('Error in showProducts:', error);
          await this.bot.sendMessage(callbackQuery.message.chat.id, 'Mahsulotlarni ko\'rsatishda xatolik yuz berdi.');
        }
      }
    });

    this.bot.onText(/\/add_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Add to cart triggered:', ctx.match);
        const productId = match ? parseInt(match[1], 10) : 0;
        if (!productId) {
          await this.bot.sendMessage(ctx.chat.id, 'Mahsulot topilmadi.');
          return;
        }

        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        await this.botService.addToCart(user.id, productId, 1);
        await this.bot.sendMessage(ctx.chat.id, 'Mahsulot savatga qo\'shildi.');
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in addToCart:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Savatga qo\'shishda xatolik yuz berdi.');
      }
    });

    this.bot.onText(/Savat|Корзина|Cart/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Show cart triggered for user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const cart = await this.botService.getCart(user.id);
        console.log('Cart fetched:', cart);

        if (!cart.length) {
          await this.bot.sendMessage(ctx.chat.id, 'Savat bo\'sh.');
          return;
        }

        let message = 'Savat:\n';
        cart.forEach((item, index) => {
          message += `${index + 1}. ${item.product.nameUz} - ${item.quantity} dona - ${item.product.price * item.quantity} UZS\nO\'chirish: /remove_${item.product.id}\n`;
        });
        message += '\nBuyurtma berish: /place_order';

        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showCart:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Savatni ko\'rsatishda xatolik yuz berdi.');
      }
    });

    this.bot.onText(/\/remove_(\d+)/, async (msg: TelegramBot.Message, match: RegExpExecArray) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, match, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Remove from cart triggered:', ctx.match);
        const productId = match ? parseInt(match[1], 10) : 0;
        if (!productId) {
          await this.bot.sendMessage(ctx.chat.id, 'Mahsulot topilmadi.');
          return;
        }

        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        await this.botService.removeFromCart(user.id, productId);
        await this.bot.sendMessage(ctx.chat.id, 'Mahsulot savatdan o\'chirildi.');
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in removeFromCart:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Savatdan o\'chirishda xatolik yuz berdi.');
      }
    });

    this.bot.onText(/\/place_order/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Place order triggered for user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        await this.bot.sendMessage(ctx.chat.id, 'Telefon raqamingizni yuboring', {
          reply_markup: {
            keyboard: [[{ text: 'Telefon raqam yuborish', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in placeOrder:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Buyurtma berishda xatolik yuz berdi.');
      }
    });

    this.bot.on('contact', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Contact received from user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const phone = msg.contact?.phone_number;
        if (!phone) {
          await this.bot.sendMessage(ctx.chat.id, 'Telefon raqami topilmadi.');
          return;
        }

        ctx.session.phone = phone;
        console.log('Phone saved in session:', phone);
        await this.bot.sendMessage(ctx.chat.id, 'Manzilingizni yuboring', {
          reply_markup: {
            keyboard: [[{ text: 'Lokatsiya yuborish', request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in onContact:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Telefon raqamini qabul qilishda xatolik yuz berdi.');
      }
    });

    this.bot.on('location', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Location received from user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const location = msg.location;
        if (!location) {
          await this.bot.sendMessage(ctx.chat.id, 'Lokatsiya topilmadi.');
          return;
        }

        const address = `Lat: ${location.latitude}, Lon: ${location.longitude}`;
        ctx.session.address = address;
        console.log('Address saved in session:', address);
        await this.bot.sendMessage(ctx.chat.id, 'Yetkazib berish turini tanlang', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Yetkazib berish', callback_data: 'delivery' }],
              [{ text: 'Olib ketish', callback_data: 'pickup' }],
            ],
          },
        });
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in onLocation:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Lokatsiyani qabul qilishda xatolik yuz berdi.');
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { from: callbackQuery.from, session: this.sessions[callbackQuery.from?.id || 0] || {} };
      const data = callbackQuery.data;
      if (data && /^(delivery|pickup)$/.test(data)) {
        try {
          console.log('Delivery type selection triggered:', data);
          if (!callbackQuery.from?.id) {
            throw new Error('Foydalanuvchi ID topilmadi');
          }

          const deliveryType = data;
          const user = await this.botService.getUser(callbackQuery.from.id.toString());
          if (!user) {
            throw new Error('Foydalanuvchi topilmadi');
          }

          ctx.session.deliveryType = deliveryType;
          console.log('Delivery type saved in session:', deliveryType);
          await this.bot.sendMessage(callbackQuery.message.chat.id, 'To\'lov usulini tanlang', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Naqd', callback_data: 'payment_cash' }],
                [{ text: 'Payme', callback_data: 'payment_payme' }],
                [{ text: 'Click', callback_data: 'payment_click' }],
                [{ text: 'Stripe', callback_data: 'payment_stripe' }],
                [{ text: 'Joyida to\'lash', callback_data: 'payment_onspot' }],
              ],
            },
          });
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[callbackQuery.from.id] = ctx.session;
        } catch (error) {
          console.error('Error in onDeliveryType:', error);
          await this.bot.sendMessage(callbackQuery.message.chat.id, 'Yetkazib berish turini tanlashda xatolik yuz berdi.');
        }
      }
    });

    this.bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
      const ctx: CustomContext = { from: callbackQuery.from, session: this.sessions[callbackQuery.from?.id || 0] || {} };
      const data = callbackQuery.data;
      if (data?.startsWith('payment_')) {
        try {
          console.log('Payment method selection triggered:', data);
          if (!callbackQuery.from?.id) {
            throw new Error('Foydalanuvchi ID topilmadi');
          }

          const paymentMethod = data.split('_')[1];
          const user = await this.botService.getUser(callbackQuery.from.id.toString());
          if (!user) {
            throw new Error('Foydalanuvchi topilmadi');
          }

          const cart = await this.botService.getCart(user.id);
          console.log('Cart for order:', cart);

          if (!cart.length) {
            await this.bot.sendMessage(callbackQuery.message.chat.id, 'Savat bo\'sh, buyurtma berish mumkin emas.');
            return;
          }

          for (const item of cart) {
            await this.botService.createOrder(
              user.id,
              item.product.id,
              item.quantity,
              ctx.session.phone || 'Noma\'lum',
              ctx.session.address || 'Noma\'lum',
              ctx.session.deliveryType || 'delivery',
              paymentMethod,
            );
          }

          await this.bot.sendMessage(callbackQuery.message.chat.id, 'Buyurtma qabul qilindi.');
          await this.botService.getCart(user.id).then((items) =>
            items.forEach((item) => this.botService.removeFromCart(user.id, item.product.id)),
          );
          ctx.session = {};
          console.log('Order placed, cart cleared, session reset');
          await this.bot.answerCallbackQuery(callbackQuery.id);
          this.sessions[callbackQuery.from.id] = ctx.session;
        } catch (error) {
          console.error('Error in onPaymentMethod:', error);
          await this.bot.sendMessage(callbackQuery.message.chat.id, 'To\'lov usulini tanlashda xatolik yuz berdi.');
        }
      }
    });

    this.bot.onText(/Buyurtmalar tarixi|История заказов|Order History/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Show orders triggered for user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const orders = await this.botService.getOrders(user.id);
        console.log('Orders fetched:', orders);

        if (!orders.length) {
          await this.bot.sendMessage(ctx.chat.id, 'Sizda hali buyurtmalar mavjud emas.');
          return;
        }

        let message = 'Buyurtmalar:\n';
        orders.forEach((order, index) => {
          message += `${index + 1}. ${order.product.nameUz} - ${order.quantity} dona - ${order.status}\n`;
        });

        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in showOrders:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Buyurtmalarni ko\'rsatishda xatolik yuz berdi.');
      }
    });

    this.bot.onText(/Qo‘llab-quvvatlash|Поддержка|Support/, async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Support chat triggered for user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const messages = await this.botService.getMessages(user.id);
        console.log('Support messages fetched:', messages);

        if (!messages.length) {
          await this.bot.sendMessage(ctx.chat.id, 'Sizda hali xabarlar mavjud emas.');
          return;
        }

        let message = 'Xabarlar:\n';
        messages.forEach((msg) => {
          message += `${msg.message}\n`;
        });

        await this.bot.sendMessage(ctx.chat.id, message);
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in supportChat:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Qo\'llab-quvvatlash xabarlarini ko\'rsatishda xatolik yuz berdi.');
      }
    });

    this.bot.on('message', async (msg: TelegramBot.Message) => {
      const ctx: CustomContext = { message: msg, chat: msg.chat, from: msg.from, session: this.sessions[msg.from?.id || 0] || {} };
      try {
        console.log('Text message received from user:', ctx.from?.id);
        if (!ctx.from?.id) {
          throw new Error('Foydalanuvchi ID topilmadi');
        }

        const user = await this.botService.getUser(ctx.from.id.toString());
        if (!user) {
          throw new Error('Foydalanuvchi topilmadi');
        }

        const text = msg.text;
        if (!text || ['Qo\'llab-quvvatlash', 'Поддержка', 'Support'].some(t => text.includes(t))) {
          console.log('Ignoring support-related text');
          return;
        }

        await this.botService.sendMessage(user.id, 1, text);
        await this.bot.sendMessage(ctx.chat.id, 'Xabaringiz yuborildi.');
        this.sessions[ctx.from.id] = ctx.session;
      } catch (error) {
        console.error('Error in onMessage:', error);
        await this.bot.sendMessage(ctx.chat.id, 'Xabar yuborishda xatolik yuz berdi.');
      }
    });
  }
}