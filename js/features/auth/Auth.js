/**
 * Аутентификация через @username.
 * Логика:
 *   - Если username есть в БД → вход (session сохраняется)
 *   - Если нет → создать аккаунт
 */
import { DB } from '../../data/DB.js';
import { createUser } from '../../data/Models.js';
import { uid, gradientFor } from '../../core/Utils.js';
import { bus } from '../../core/EventBus.js';
import { store } from '../../core/Store.js';
import { GRADIENTS } from '../../data/Seed.js';

const AVATAR_GRADIENTS = GRADIENTS.slice(0, 8);

/** Нормализует username: убирает @, lowercase, trim */
export function normUsername(u) {
  return String(u || '').trim().replace(/^@+/, '').toLowerCase();
}

/** Валиден ли username */
export function isValidUsername(u) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(normUsername(u));
}

export const Auth = {
  async init() {
    const session = await DB.get('meta', 'session');
    console.log('[Auth] Сессия из БД:', session);

    if (!session?.username) {
      console.log('[Auth] Сессии нет');
      return { hasSession: false };
    }

    const user = await this.findByUsername(session.username);
    console.log('[Auth] Найден юзер по сессии:', user);

    if (!user) {
      console.log('[Auth] Юзер не найден — очищаю сессию');
      await DB.delete('meta', 'session');
      return { hasSession: false };
    }

    store.state.user = user;
    console.log('[Auth] ✅ Зашли как', user.name, '@' + user.username);
    return { hasSession: true };
  },

  /** Найти по username (нормализованному) */
  async findByUsername(username) {
    const norm = normUsername(username);
    const all = await DB.getAll('users');
    console.log('[Auth] Ищу:', norm, ' среди:', all.map((u) => u.username));
    return all.find((u) => normUsername(u.username) === norm) || null;
  },

  async usernameExists(username) {
    return !!(await this.findByUsername(username));
  },

  async createUser({ username, name, avatarGradient }) {
    const norm = normUsername(username);
    const existing = await this.findByUsername(norm);
    if (existing) {
      // Уже есть — логинимся под ним вместо создания
      console.log('[Auth] Пользователь уже существует — логинюсь');
      return this.login(norm);
    }

    const user = createUser({
      id: uid('user'),
      name: name || norm,
      gradient: avatarGradient || gradientFor(name || norm),
      username: norm
    });
    await DB.put('users', user);
    await DB.put('meta', { key: 'session', username: norm, createdAt: Date.now() });
    store.state.user = user;
    console.log('[Auth] ✅ Создан новый:', user);
    bus.emit('auth:loggedIn', user);
    return user;
  },

  async login(username) {
    const norm = normUsername(username);
    const user = await this.findByUsername(norm);
    if (!user) throw new Error('Пользователь не найден');
    await DB.put('meta', { key: 'session', username: norm, createdAt: Date.now() });
    store.state.user = user;
    console.log('[Auth] ✅ Логин:', user);
    bus.emit('auth:loggedIn', user);
    return user;
  },

  async logout() {
    await DB.delete('meta', 'session');
    store.state.user = null;
    bus.emit('auth:loggedOut');
  },

  /** Жёсткий выход — очищает все сессии и перезагружает */
  async forceLogout() {
    console.log('[Auth] Жёсткий выход');
    // Удаляем все варианты session
    await DB.delete('meta', 'session');
    // Удаляем через все возможные ключи
    try {
      const allMeta = await DB.getAll('meta');
      for (const m of allMeta) {
        if (m.key === 'session' || m.key?.startsWith('session')) {
          await DB.delete('meta', m.key);
        }
      }
    } catch (e) {
      console.warn(e);
    }
    // Очищаем store
    store.state.user = null;
    store.state.activeChatId = null;
    bus.emit('auth:loggedOut');
  },

  async listUsers() {
    return DB.getAll('users');
  }
};

export { AVATAR_GRADIENTS };
