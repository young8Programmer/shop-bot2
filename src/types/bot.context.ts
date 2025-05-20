import * as TelegramBot from 'node-telegram-bot-api';

export interface SessionData {
  phone?: string;
  address?: string;
  deliveryType?: string;
  page?: number;
}

export interface CustomContext {
  message?: TelegramBot.Message;
  chat?: TelegramBot.Chat;
  from?: TelegramBot.User;
  match?: RegExpExecArray;
  session: SessionData;
}

export interface Sessions {
  [key: number]: SessionData;
}