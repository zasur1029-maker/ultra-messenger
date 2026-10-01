import { DB } from '../../data/DB.js';
import { bus } from '../../core/EventBus.js';

const STATUS_KEY = 'um_user_status';

export const Users = {
  async all() {
    return DB.getAll('users');
  },

  async findByUsername(username) {
    const norm = String(username || '').trim().replace(/^@+/, '').toLowerCase();
    if (!norm) return null;
    const all = await this.all();
    return all.find((u) => (u.username || '').toLowerCase() === norm) || null;
  },

  async search(query) {
    const q = String(query || '').trim().toLowerCase().replace(/^@+/, '');
    if (!q) return [];
    const all = await this.all();
    return all.filter((u) => {
      const uname = (u.username || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      return uname.includes(q) || name.includes(q);
    });
  },

  async save(user) {
    await DB.put('users', user);
    bus.emit('users:updated', user);
    return user;
  },

  getStatus(username) {
    const statuses = this._loadStatuses();
    const s = statuses[username] || {};
    if (s.online) return { type: 'online', text: 'онлайн', lastSeen: s.lastSeen };
    if (s.lastSeen) {
      const diff = Date.now() - s.lastSeen;
      const min = Math.floor(diff / 60000);
      if (min < 1) return { type: 'recently', text: 'был(а) только что' };
      if (min < 60) return { type: 'recently', text: `был(а) ${min} мин назад` };
      const hours = Math.floor(min / 60);
      if (hours < 24) return { type: 'recently', text: `был(а) ${hours} ч назад` };
      const days = Math.floor(hours / 24);
      return { type: 'offline', text: `был(а) ${days} дн назад` };
    }
    return { type: 'offline', text: 'не в сети' };
  },

  setStatus(username, { online = false, typing = false, recording = false } = {}) {
    const statuses = this._loadStatuses();
    if (!statuses[username]) statuses[username] = {};
    statuses[username].online = online;
    statuses[username].typing = typing;
    statuses[username].recording = recording;
    statuses[username].lastSeen = Date.now();
    this._saveStatuses(statuses);
    bus.emit('users:status', { username, status: statuses[username] });
  },

  getChatStatus(chat) {
    if (chat.type === 'bot') return { type: 'online', text: 'бот' };
    if (chat.type === 'group') return { type: 'group', text: `${(chat.participants || []).length} участников` };
    if (chat.type === 'channel') return { type: 'channel', text: 'канал' };
    if (chat.type === 'saved') return { type: 'saved', text: 'сохранённые' };
    // Для личных чатов — статус собеседника
    const me = (window.__STORE__ && window.__STORE__.state.user) || null;
    const partner = (chat.participants || []).find((p) => p.id !== me?.username);
    if (partner) return this.getStatus(partner.id);
    return this.getStatus(chat.id);
  },

  simulateBots() {
    const bots = ['bot_friend', 'bot_colleague', 'bot_mom', 'bot_helper', 'bot_gf', 'bot_english'];
    const statuses = this._loadStatuses();
    bots.forEach((id) => {
      if (!statuses[id]) {
        statuses[id] = {
          online: Math.random() < 0.6,
          lastSeen: Date.now() - Math.floor(Math.random() * 3600000)
        };
      }
    });
    this._saveStatuses(statuses);
  },

  startSimulation() {
    setInterval(() => {
      const bots = ['bot_friend', 'bot_colleague', 'bot_mom', 'bot_helper', 'bot_gf', 'bot_english'];
      const statuses = this._loadStatuses();
      const bot = bots[Math.floor(Math.random() * bots.length)];
      if (!statuses[bot]) statuses[bot] = {};
      if (Math.random() < 0.2) {
        statuses[bot].online = !statuses[bot].online;
        statuses[bot].lastSeen = Date.now();
        this._saveStatuses(statuses);
        bus.emit('users:status', { username: bot, status: statuses[bot] });
      }
    }, 15000);
  },

  _loadStatuses() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); }
    catch { return {}; }
  },

  _saveStatuses(s) {
    try { localStorage.setItem(STATUS_KEY, JSON.stringify(s)); } catch {}
  }
};

export default Users;
