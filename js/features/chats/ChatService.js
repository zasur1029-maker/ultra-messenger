/**
 * ChatService — правильная логика чатов между двумя пользователями.
 * Ключевая идея:
 *   - id чата = 'chat_' + sorted([userA, userB]).join('_')
 *   - ОДИН чат для обоих участников
 *   - НЕТ ownerUsername
 *   - Все сообщения видны обоим
 */
import { DB } from '../../data/DB.js';
import { bus } from '../../core/EventBus.js';
import { store } from '../../core/Store.js';

export const ChatService = {
  /** ID чата между двумя пользователями (детерминированный) */
  pairId(usernameA, usernameB) {
    const sorted = [usernameA, usernameB].map((u) => String(u).toLowerCase().replace(/^@+/, '')).sort();
    return 'chat_' + sorted.join('__');
  },

  /** Найти или создать чат между мной и другим пользователем */
  async ensureChat(otherUser) {
    const me = store.state.user;
    if (!me || !otherUser) throw new Error('Нет пользователя');

    const chatId = this.pairId(me.username, otherUser.username);

    // Ищем в локальном state
    let chat = store.state.chats.find((c) => c.id === chatId);
    if (chat) return chat;

    // Ищем в БД
    chat = await DB.get('chats', chatId);
    if (chat) {
      // Добавляем в state
      if (!store.state.chats.find((c) => c.id === chatId)) {
        store.state.chats.push(chat);
      }
      return chat;
    }

    // Создаём новый
    const newChat = {
      id: chatId,
      type: 'personal',
      title: otherUser.name,
      gradient: otherUser.gradient,
      avatar: otherUser.avatar,
      participants: [
        { id: me.username, name: me.name, gradient: me.gradient, avatar: me.avatar },
        { id: otherUser.username, name: otherUser.name, gradient: otherUser.gradient, avatar: otherUser.avatar }
      ],
      pinned: false,
      muted: false,
      archived: false,
      favorite: false,
      unread: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    console.log('[ChatService] Создан чат:', chatId);
    await DB.put('chats', newChat);
    store.state.chats.push(newChat);
    store.state.messages[chatId] = store.state.messages[chatId] || [];
    bus.emit('chats:update');

    return newChat;
  },

  /** Отправить сообщение */
  async sendMessage(chatId, text) {
    const me = store.state.user;
    if (!me) return null;

    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      chatId,
      authorId: me.username,        // всегда username
      authorName: me.name,
      text,
      type: 'text',
      attachments: [],
      reactions: {},
      status: 'sent',
      createdAt: Date.now()
    };

    // Сохраняем в БД
    await DB.put('messages', msg);

    // Обновляем чат
    const chat = store.state.chats.find((c) => c.id === chatId);
    if (chat) {
      chat.updatedAt = Date.now();
      await DB.put('chats', chat);
    }

    // Обновляем state
    if (!store.state.messages[chatId]) store.state.messages[chatId] = [];
    store.state.messages[chatId].push(msg);

    bus.emit('messages:append', { chatId, message: msg });
    bus.emit('chats:update');

    return msg;
  },

  /** Перезагрузить чаты и сообщения для текущего пользователя */
  async reload() {
    const me = store.state.user;
    if (!me) return;

    const allChats = await DB.getAll('chats');
    // Показываем чаты где я участник, или мои личные (бот/избранное)
    const myChats = allChats.filter((c) => {
      if (c.participants && c.participants.length > 0) {
        return c.participants.some((p) => p.id === me.username);
      }
      // Боты/избранное — личные
      return !c.ownerUsername || c.ownerUsername === me.username;
    });

    store.state.chats = myChats;

    // Загружаем сообщения
    const messages = {};
    for (const chat of myChats) {
      messages[chat.id] = await DB.getMessages(chat.id, 500);
    }
    store.state.messages = messages;

    console.log('[ChatService] Загружено:', myChats.length, 'чатов,', Object.values(messages).flat().length, 'сообщений');
    bus.emit('chats:update');
  }
};

export default ChatService;
