/**
 * DB v3 — правильная схема для чатов между пользователями.
 * Хранилища:
 *   - users     (keyPath: id) — все пользователи
 *   - chats     (keyPath: id) — все чаты (общие для участников)
 *   - messages  (keyPath: id) — все сообщения (по chatId)
 *   - meta      (keyPath: key) — сессии, настройки
 */
const DB_NAME = 'ultra_msg_v3';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      console.log('[DB] Создаю схему v3');

      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chats')) {
        const s = db.createObjectStore('chats', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('messages')) {
        const s = db.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('chatId', 'chatId');
        s.createIndex('chatId_createdAt', ['chatId', 'createdAt']);
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      console.log('[DB] Открыта:', DB_NAME);
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function unwrap(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(unwrap);
  if (obj instanceof Date) return obj;
  if (obj instanceof Blob) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch { return obj; }
}

export const DB = {
  async get(store, key) {
    const s = await tx(store, 'readonly');
    return reqToPromise(s.get(key));
  },

  async getAll(store, query, count) {
    const s = await tx(store, 'readonly');
    return reqToPromise(s.getAll(query, count));
  },

  async put(store, value) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.put(unwrap(value)));
  },

  async putMany(store, values) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const s = transaction.objectStore(store);
      values.forEach((v) => s.put(unwrap(v)));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async delete(store, key) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.delete(key));
  },

  async clear(store) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.clear());
  },

  async count(store) {
    const s = await tx(store, 'readonly');
    return reqToPromise(s.count());
  },

  async getMessages(chatId, limit = 500) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readonly');
      const index = transaction.objectStore('messages').index('chatId_createdAt');
      const range = IDBKeyRange.bound([chatId, -Infinity], [chatId, Infinity]);
      const req = index.getAll(range, limit);
      req.onsuccess = () => {
        resolve(req.result.sort((a, b) => a.createdAt - b.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deleteMessagesByChat(chatId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const index = store.index('chatId');
      const req = index.openCursor(IDBKeyRange.only(chatId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  /** Удалить старые базы */
  async dropLegacy() {
    try {
      indexedDB.deleteDatabase('ultra_msg');
      indexedDB.deleteDatabase('um_stories');
      console.log('[DB] Старые базы удалены');
    } catch {}
  }
};
