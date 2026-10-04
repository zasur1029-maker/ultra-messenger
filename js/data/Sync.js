/**
 * Sync v2 — мгновенная синхронизация через WebSocket.
 */
import { bus } from '../core/EventBus.js';
import { store } from '../core/Store.js';

const SERVER_URL = window.location.origin;
const WS_URL = SERVER_URL.replace(/^http/, 'ws');

let ws = null;
let connected = false;
let reconnectTimer = null;
let pendingQueue = [];

export const Sync = {
  get connected() { return connected; },

  connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        connected = true;
        console.log('[Sync] ✅ Подключён');
                // Отправляем статус «онлайн»
        if (store.state.user) {
          this.send({ type: 'online', username: store.state.user.username, online: true });
        }
      };

      ws.onclose = () => {
        connected = false;
        console.warn('[Sync] ❌ Отключён');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => this.connect(), 2000);
      };

      ws.onerror = () => {};

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) { console.error('[Sync] Parse error:', e); }
      };
    } catch (e) {
      console.warn('[Sync] Не подключиться:', e);
    }
  },

  /** Отправка через WebSocket (мгновенно) */
  send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      // Откладываем до подключения
      pendingQueue.push(data);
      this.connect();
    }
  },

  async handleMessage(msg) {
    switch (msg.type) {
      case 'init':
        if (msg.data.users) store.state.users = msg.data.users;
        if (msg.data.chats) store.state.chats = msg.data.chats;
        if (msg.data.messages) {
          const byChat = {};
          msg.data.messages.forEach((m) => {
            if (!byChat[m.chatId]) byChat[m.chatId] = [];
            byChat[m.chatId].push(m);
          });
          store.state.messages = byChat;
        }
        bus.emit('chats:update');
        bus.emit('messages:render');
        break;

      case 'users:refresh':
      case 'chats:refresh':
      case 'messages:refresh':
        try {
          const res = await fetch('/api/data');
          const data = await res.json();
          if (data.users) store.state.users = data.users;
          if (data.chats) store.state.chats = data.chats;
          if (data.messages) {
            const byChat = {};
            data.messages.forEach((m) => {
              if (!byChat[m.chatId]) byChat[m.chatId] = [];
              byChat[m.chatId].push(m);
            });
            store.state.messages = byChat;
          }
          bus.emit('chats:update');
          // не рендерим весь список при refresh
        } catch (e) {}
        break;

      case 'messages:update': {
        const m = msg.message;
        if (!store.state.messages[m.chatId]) store.state.messages[m.chatId] = [];
        const existing = store.state.messages[m.chatId].find((x) => x.id === m.id);
        
        // Если сообщение без attachments (уведомление) — подгружаем с сервера
        if (!m.attachments || m.attachments.length === 0) {
          fetch('/api/data').then((r) => r.json()).then((data) => {
            const full = (data.messages || []).find((x) => x.id === m.id);
            if (full) {
              if (!store.state.messages[full.chatId]) store.state.messages[full.chatId] = [];
              const idx = store.state.messages[full.chatId].findIndex((x) => x.id === full.id);
              if (idx >= 0) {
                Object.assign(store.state.messages[full.chatId][idx], full);
              } else {
                store.state.messages[full.chatId].push(full);
              }
              bus.emit('messages:render');
              console.log('[Sync] 📩 Загружено с сервера:', full.type);
            }
          }).catch(() => {});
          bus.emit('chats:update');
          this._sound();
          break;
        }
        
        // Обычное сообщение
        if (existing) {
          Object.assign(existing, m);
          bus.emit('messages:update', { chatId: m.chatId, message: existing });
        } else {
          store.state.messages[m.chatId].push(m);
          bus.emit('messages:append', { chatId: m.chatId, message: m });
          bus.emit('chats:update');
          this._sound();
        }
        break;
      }

      case 'message:read': {
        // Обновляем статус всех сообщений
        const { chatId, readerId } = msg;
        const list = store.state.messages[chatId] || [];
        list.forEach((m) => {
          if (m.authorId !== readerId && m.status !== 'read') {
            m.status = 'read';
          }
        });
        bus.emit('messages:render');
        bus.emit('chats:update');
        break;
      }

      case 'user:online': {
        const { username, online } = msg;
        if (!store.state.onlineUsers) store.state.onlineUsers = {};
        store.state.onlineUsers[username] = online;
        bus.emit('chats:update');
        bus.emit('users:status', { username, status: { online } });
        break;
      }

      case 'user:typing': {
        const { username, chatId, typing } = msg;
        if (!store.state.typingUsers) store.state.typingUsers = {};
        store.state.typingUsers[chatId] = typing ? username : null;
        bus.emit('users:typing', { chatId, username, typing });
        break;
      }
    }
  },

  _sound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  },

  sendDrawing(chatId, strokes) {
    this.send({ type: 'drawing', drawing: { chatId, strokes } });
  },

  sendMessage(message) {
    this.send({ type: 'message', message });
  },
  sendChat(chat) {
    this.send({ type: 'chat', chat });
  },
  sendUser(user) {
    this.send({ type: 'user', user });
  },
  markRead(chatId, readerId) {
    this.send({ type: 'mark-read', chatId, readerId });
  },
  setOnline(username, online) {
    this.send({ type: 'online', username, online });
  },
  setTyping(username, chatId, typing) {
    this.send({ type: 'typing', username, chatId, typing });
  }
};

export default Sync;
