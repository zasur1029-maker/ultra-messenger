/**
 * Store — реактивное состояние на Proxy.
 * Любое изменение корневого ключа эмитит 'state:key'.
 * Вложенные объекты оборачиваются рекурсивно.
 */
import { bus } from './EventBus.js';

function makeReactive(obj, path = '') {
  return new Proxy(obj, {
    get(target, key) {
      const value = target[key];
      if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Node)) {
        return makeReactive(value, `${path}.${key}`);
      }
      return value;
    },
    set(target, key, value) {
      const old = target[key];
      target[key] = value;
      if (old !== value) {
        bus.emit(`state:${path ? path.slice(1) + '.' : ''}${key}`, value);
        bus.emit('state:changed', { path, key, value, old });
      }
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      bus.emit('state:changed', { path, key, value: undefined });
      return true;
    }
  });
}

export function createStore(initial) {
  const state = makeReactive(initial);
  return {
    state,
    /** Получить снимок (глубокую копию) — для сохранения */
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },
    /** Пакетное обновление (один emit) */
    patch(updates) {
      for (const [k, v] of Object.entries(updates)) state[k] = v;
    }
  };
}

export const store = createStore({
  user: null,
  activeChatId: null,
  chats: [],
  messages: {},       // { [chatId]: Message[] }
  ui: {
    filter: 'all',
    searchQuery: '',
    emojiPickerOpen: false,
    replyTo: null,
    editingId: null
  }
});
