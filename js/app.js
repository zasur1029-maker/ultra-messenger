/**
 * Ultra Messenger — точка входа.
 * Per-user логика: чаты/сообщения/сессия привязаны к @username.
 */
import { $, el, sleep } from './core/Utils.js';
import { bus } from './core/EventBus.js';
import { store } from './core/Store.js';
import { DB } from './data/DB.js';
import { createSeedData } from './data/Seed.js';
import { Auth } from './features/auth/Auth.js';
import { AuthUI } from './features/auth/AuthUI.js';
import { ChatList } from './features/chats/ChatList.js';
import { ChatService } from './features/chats/ChatService.js';
import { MessageList } from './features/messages/MessageList.js';
import { Composer } from './features/input/Composer.js';
import { EmojiPicker } from './features/input/EmojiPicker.js';
import { BotSimulator } from './features/bot/BotSimulator.js';
import { Call } from './features/calls/Call.js';
import { Settings } from './features/settings/Settings.js';
import { Notifier } from './features/notifications/Notifier.js';
import { PWA } from './features/pwa/PWA.js';
import { toast } from './ui/Toast.js';
import { avatar } from './ui/Avatar.js';
import { icon } from './core/Icon.js';
import { stripMarkdown } from './features/messages/MarkdownLite.js';
import { Users } from './features/users/Users.js';
import { openUserSearch } from './features/users/UserSearch.js';

window.__BUS__ = { bus };
import('./core/Store.js').then(({ store: s }) => { window.__STORE__ = { state: s.state }; });

const APP = {
  chatList: null,
  messageList: null,
  composer: null,
  emoji: null,
  bot: null,
  call: null,
  settings: null,
  notifier: null,
  pwa: null,

  getUserKey() {
    const u = store.state.user;
    return u?.username || u?.id || 'anon';
  },

  async init() {
    try { const { Sync } = await import('./data/Sync.js'); Sync.connect(); } catch(e) {}
    // Удаляем старые базы
    try { await DB.dropLegacy(); } catch {}
    // Миграция старых сообщений
    try {
      const { migrate } = await import('./dev/migrate.js');
      await migrate();
    } catch (e) {
      console.warn('[App] Миграция не удалась:', e);
    }

    const { hasSession } = await Auth.init();
    if (hasSession) {
      document.getElementById('splash').hidden = true;
      await this.startApp(false);
    } else {
      await AuthUI.run();
      if (!store.state.user) return;
      await this.startApp(true);
    }
  },

  async startApp(isNewUser) {
    await this._loadData();

    document.getElementById('app').hidden = false;
    this.chatList = new ChatList(document.getElementById('chatList'));
    this.messageList = new MessageList(document.getElementById('messages'));
    this.composer = new Composer();
    this.emoji = new EmojiPicker();
    this.bot = new BotSimulator();
    Users.simulateBots();
    Users.startSimulation();
    this.call = new Call();
    this.settings = new Settings();
    this.notifier = new Notifier();
    this.pwa = new PWA();

    this._bindGlobal();

    // Отправляем онлайн статус
    setTimeout(() => {
      import('./data/Sync.js').then(({ Sync }) => {
        if (store.state.user?.username) {
          Sync.setOnline(store.state.user.username, true);
        }
      });
    }, 2000);

    if (store.state.activeChatId) {
      this._openChat(store.state.activeChatId);
    }

    document.getElementById('splash').hidden = true;
  },

  async _loadData() {
    // Загружаем пользователей с сервера
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      console.log('[App] Данные с сервера:', data.users?.length, 'юзеров,', data.chats?.length, 'чатов,', data.messages?.length, 'сообщений');

      // Сохраняем юзеров локально
      if (data.users) {
        for (const u of data.users) {
          await DB.put('users', u);
        }
      }
    } catch (e) {
      console.warn('[App] Сервер недоступен:', e);
    }

    // Загружаем ВСЕ чаты из базы
    const allChats = await DB.getAll('chats');
    console.log('[App] Всего чатов в базе:', allChats.length);

    store.state.chats = allChats;

    // Загружаем сообщения для каждого чата
    const messages = {};
    for (const chat of allChats) {
      messages[chat.id] = await DB.getMessages(chat.id, 500);
    }
    store.state.messages = messages;

    console.log('[App] Загружено:', allChats.length, 'чатов,', Object.values(messages).flat().length, 'сообщений');

    // Восстанавливаем активный чат
    const userKey = this.getUserKey();
    const activeMeta = await DB.get('meta', `activeChatId:${userKey}`);
    if (activeMeta?.value && allChats.find((c) => c.id === activeMeta.value)) {
      store.state.activeChatId = activeMeta.value;
    }
  },

  _bindGlobal() {
    }

    // === Остальные обработчики ===
    bus.on('ui:openChat', (chatId) => this._openChat(chatId));

    bus.on('ui:toggleEmoji', (anchor) => {
      this.emoji.toggle(anchor, (emoji) => {
        const input = this.composer.input;
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
      });
    });

    bus.on('bot:typing', ({ chatId, authorName, isTyping }) => {
      if (chatId !== store.state.activeChatId) return;
      const indicator = document.getElementById('typingIndicator');
      const name = document.getElementById('typingName');
      if (isTyping) { name.textContent = authorName; indicator.hidden = false; }
      else { indicator.hidden = true; }
    });

    // Статус «печатает» — показываем в шапке чата
    bus.on('bot:typing', ({ chatId, isTyping }) => {
      if (chatId !== store.state.activeChatId) return;
      const statusEl = document.getElementById('convStatus');
      if (!statusEl) return;
      if (isTyping) {
        statusEl.innerHTML = '<span style="color: var(--color-accent);">печатает…</span>';
      } else {
        const chat = store.state.chats.find((c) => c.id === chatId);
        if (chat) statusEl.textContent = chat.type === 'bot' ? 'бот' : 'онлайн';
      }
    });

    bus.on('bot:replied', async ({ chatId, message }) => {
      const userKey = this.getUserKey();
      await DB.put('messages', message);
      const chat = store.state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.updatedAt = Date.now();
        await DB.put('chats', chat);
      }
    });

    bus.on('messages:update', async ({ chatId, message }) => {
      const userKey = this.getUserKey();
      await DB.put('messages', message);
    });

    bus.on('chats:persist', async (chatId) => {
      const userKey = this.getUserKey();
      const chat = store.state.chats.find((c) => c.id === chatId);
      if (chat) await DB.put('chats', chat);
    });

    bus.on('chats:delete', async (chatId) => {
      await DB.delete('chats', chatId);
      await DB.deleteMessagesByChat(chatId);
    });

    bus.on('ui:openChat', async (chatId) => {
      const userKey = this.getUserKey();
      await DB.put('meta', { key: `activeChatId:${userKey}`, value: chatId });
    });

    // Меню ☰
    document.getElementById('menuBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      document.querySelector('.dropdown')?.remove();

      const menu = document.createElement('div');
      menu.className = 'dropdown';
      menu.style.cssText = 'position: fixed; background: var(--color-bg-elevated); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); padding: 6px; z-index: 999999; min-width: 240px;';

      const addItem = (iconName, label, onClick, danger = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-family: inherit; cursor: pointer; text-align: left; color: ' + (danger ? 'var(--color-danger)' : 'var(--color-text-primary)') + ';';
        btn.appendChild(icon(iconName, 18, 2));
        const span = document.createElement('span');
        span.textContent = label;
        btn.appendChild(span);
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--color-bg-hover)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          menu.remove();
          try { await onClick(); } catch (err) { console.error(err); toast.error('Ошибка: ' + err.message); }
        });
        menu.appendChild(btn);
      };

      const addDivider = () => {
        const d = document.createElement('div');
        d.style.cssText = 'height: 1px; background: var(--color-divider); margin: 6px 0;';
        menu.appendChild(d);
      };

      // === Пункты меню ===
      addItem('user', 'Профиль', () => this._showProfile());
      addItem('users', 'Сменить аккаунт', async () => {
        const { confirmDialog } = await import('./ui/Modal.js');
        if (window.confirm('Сменить аккаунт?\n\nВсе данные сохранятся.')) {
          await Auth.logout();
          location.reload();
        }
      });
      addDivider();
      addItem('search', 'Найти человека', async () => {
        const { openUserSearch } = await import('./features/users/UserSearch.js');
        openUserSearch();
      });
      addItem('settings', 'Настройки', () => this.settings.open());
      addItem('star', 'Избранное', () => bus.emit('ui:openChat', 'chat_saved'));
      addItem('bell', 'Уведомления', () => this.notifier.requestPermission());
      addItem('download', 'Установить приложение', () => this.pwa.promptInstall());
      addDivider();
      addItem('logout', 'Выйти', async () => {
        console.log('[Menu] Выйти нажата');
        const ok = window.confirm('Выйти из аккаунта?\n\nВсе данные сохранятся. Следующий вход — по @username.');
        console.log('[Menu] Нативный confirm вернул:', ok);
        if (ok) {
          console.log('[Menu] Выхожу…');
          await Auth.forceLogout();
          console.log('[Menu] Сессия очищена, перезагружаю');
          setTimeout(() => location.reload(), 100);
        }
      }, true);

      document.body.appendChild(menu);
      const rect = e.currentTarget.getBoundingClientRect();
      const mw = menu.getBoundingClientRect().width;
      menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8)) + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';

      setTimeout(() => {
        document.addEventListener('click', (ev) => {
          if (!menu.contains(ev.target)) menu.remove();
        }, { once: true });
      }, 10);
    });

    // Звонки
    document.getElementById('callAudioBtn')?.addEventListener('click', () => {
      if (store.state.activeChatId) this.call.start(store.state.activeChatId, { video: false });
    });
    document.getElementById('callVideoBtn')?.addEventListener('click', () => {
      if (store.state.activeChatId) this.call.start(store.state.activeChatId, { video: true });
    });

    // Меню чата
    document.getElementById('chatMenuBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const chat = store.state.chats.find((c) => c.id === store.state.activeChatId);
      if (!chat) return;

      document.querySelector('.dropdown')?.remove();

      const menu = document.createElement('div');
      menu.className = 'dropdown';
      menu.style.cssText = 'position: fixed; background: var(--color-bg-elevated); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); padding: 6px; z-index: 999999; min-width: 220px;';

      const addItem = (iconName, label, onClick, danger = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-family: inherit; cursor: pointer; text-align: left; color: ' + (danger ? 'var(--color-danger)' : 'var(--color-text-primary)') + ';';
        btn.appendChild(icon(iconName, 18, 2));
        const span = document.createElement('span');
        span.textContent = label;
        btn.appendChild(span);
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--color-bg-hover)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          menu.remove();
          try { await onClick(); } catch (err) { toast.error('Ошибка: ' + err.message); }
        });
        menu.appendChild(btn);
      };

      addItem('info', 'Информация', () => this._showChatInfo(chat));
      addItem(chat.muted ? 'bell' : 'bellOff', chat.muted ? 'Включить звук' : 'Без звука', async () => {
        chat.muted = !chat.muted;
        bus.emit('chats:persist', chat.id);
        bus.emit('chats:update');
      });
      addItem('trash', 'Очистить историю', () => this._clearHistory(chat), true);

      document.body.appendChild(menu);
      const rect = e.currentTarget.getBoundingClientRect();
      const mw = menu.getBoundingClientRect().width;
      menu.style.left = Math.max(8, rect.right - mw) + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';

      setTimeout(() => {
        document.addEventListener('click', (ev) => {
          if (!menu.contains(ev.target)) menu.remove();
        }, { once: true });
      }, 10);
    });

    // Мобильная кнопка назад
    document.getElementById('backBtn')?.addEventListener('click', () => {
      document.getElementById('app').classList.remove('has-conv');
      store.state.activeChatId = null;
    });

    // Системная тема
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.settings.settings.theme === 'auto') this.settings._applyAll();
    });

    // Периодическая синхронизация с сервером (каждые 5 секунд)
    setInterval(async () => {
      try {
        const res = await fetch('/api/data');
        const data = await res.json();
        
        let changed = false;
        
        // Пользователи
        if (data.users) {
          for (const u of data.users) {
            await DB.put('users', u);
          }
        }
        
        // Чаты
        if (data.chats && data.chats.length !== store.state.chats.length) {
          store.state.chats = data.chats;
          changed = true;
        }
        
        // Сообщения
        if (data.messages) {
          const byChat = {};
          data.messages.forEach((m) => {
            if (!byChat[m.chatId]) byChat[m.chatId] = [];
            byChat[m.chatId].push(m);
          });
          
          // Проверяем изменения
          for (const chatId in byChat) {
            const oldCount = (store.state.messages[chatId] || []).length;
            const newCount = byChat[chatId].length;
            if (newCount !== oldCount) {
              store.state.messages[chatId] = byChat[chatId];
              changed = true;
            }
          }
        }
        
        if (changed) {
          bus.emit('chats:update');
          // Не дёргаем render — это вызывает лаги
          // bus.emit('messages:render');
        }
      } catch (e) {
        // сервер недоступен — нормально
      }
    }, 5000);

    // Индикатор «печатает»
    bus.on('users:typing', ({ chatId, username, typing }) => {
      if (chatId !== store.state.activeChatId) return;
      const statusEl = document.getElementById('convStatus');
      if (!statusEl) return;
      if (typing) {
        statusEl.innerHTML = '<span style="color: var(--color-accent);">печатает…</span>';
        clearTimeout(window.__typingTimeout);
        window.__typingTimeout = setTimeout(() => {
          const chat = store.state.chats.find((c) => c.id === chatId);
          if (chat) {
            const s = getChatStatusText(chat);
            statusEl.textContent = s;
          }
        }, 3000);
      }
    });

    // Обработка онлайн статуса
    bus.on('users:status', ({ username, status }) => {
      const chat = store.state.chats.find((c) => c.participants?.some((p) => p.id === username));
      if (!chat || chat.id !== store.state.activeChatId) return;
      const statusEl = document.getElementById('convStatus');
      if (!statusEl) return;
      statusEl.textContent = status.online ? 'онлайн' : 'не в сети';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
      if (e.key === 'Escape') {
        if (store.state.ui.replyTo) this.composer._clearReply();
        if (store.state.ui.editingId) this.composer._clearEdit();
      }
    });
  },

  async _openChat(chatId) {
    if (!chatId) return;
    const chat = store.state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    store.state.activeChatId = chatId;
    chat.unread = 0;
    bus.emit('chats:persist', chatId);

    document.getElementById('app').classList.add('has-conv');
    document.getElementById('emptyState').hidden = true;
    document.getElementById('convHeader').hidden = false;

    const convAvatar = document.getElementById('convAvatar');
    convAvatar.replaceChildren(avatar({ name: chat.title, gradient: chat.gradient, avatarUrl: chat.avatar, size: 'md', online: chat.type === 'personal' }));
    document.getElementById('convName').textContent = chat.title;

    const statusEl = document.getElementById('convStatus');
    const chatStatus = Users.getChatStatus(chat);
    statusEl.textContent = chatStatus.text;

    // Обновляем статус каждые 30 секунд
    if (this._statusInterval) clearInterval(this._statusInterval);
    this._statusInterval = setInterval(() => {
      if (store.state.activeChatId !== chat.id) return;
      const s = Users.getChatStatus(chat);
      statusEl.textContent = s.text;
    }, 30000);

    // Pinned
    const pinnedBar = document.getElementById('pinnedBar');
    const pinnedMsg = (store.state.messages[chatId] || []).find((m) => m.pinned);
    if (pinnedMsg) {
      pinnedBar.hidden = false;
      pinnedBar.replaceChildren(
        el('div', { class: 'pinned__icon' }),
        el('div', { class: 'pinned__body' },
          el('div', { class: 'pinned__label', text: 'Закреплённое' }),
          el('div', { class: 'pinned__text', text: stripMarkdown(pinnedMsg.text || '').slice(0, 80) })
        )
      );
    } else {
      pinnedBar.hidden = true;
    }


    bus.emit('messages:render');
    this.messageList.scrollToBottom(false);
    setTimeout(() => this.composer.focus(), 100);

    // Отмечаем все входящие как прочитанные
    try {
      const { Sync } = await import('./data/Sync.js');
      Sync.markRead(chatId, store.state.user.username);
      // Локально тоже обновляем
      const list = store.state.messages[chatId] || [];
      list.forEach((m) => {
        if (m.authorId !== store.state.user.username && m.status !== 'read') {
          m.status = 'read';
        }
      });
    } catch (e) {}

    const userKey = this.getUserKey();
    DB.put('meta', { key: `activeChatId:${userKey}`, value: chatId });
  },





  async _showProfile() {
    const { modal, confirmDialog } = await import('./ui/Modal.js');
    const user = store.state.user;

    const body = document.createElement('div');
    body.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 16px;';

        // Кликабельный аватар
    const avatarWrap = document.createElement('div');
    avatarWrap.style.cssText = 'position: relative; cursor: pointer;';
    const avatarEl = avatar({ name: user.name, gradient: user.gradient, avatarUrl: user.avatar, size: 'xl' });
    avatarWrap.appendChild(avatarEl);

    // Индикатор "изменить"
    const editBadge = document.createElement('div');
    editBadge.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; border-radius: 50%; background: var(--color-accent); color: #fff; display: grid; place-items: center; border: 3px solid var(--color-bg-elevated); font-size: 16px;';
    editBadge.textContent = '📷';
    avatarWrap.appendChild(editBadge);

    // Скрытый input для файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    avatarWrap.appendChild(fileInput);

    avatarWrap.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Файл больше 5MB');
        return;
      }

      try {
        // Сжимаем изображение через canvas
        const dataUrl = await compressImage(file, 400);
        user.avatar = dataUrl;
        await DB.put('users', user);
        bus.emit('chats:update');
        toast.success('Аватар обновлён');
        // Обновляем превью
        avatarEl.style.backgroundImage = `url(${dataUrl})`;
        avatarEl.textContent = '';
      } catch (err) {
        console.error(err);
        toast.error('Не удалось загрузить');
      }
    });

    body.appendChild(avatarWrap);

    const usernameTag = document.createElement('div');
    usernameTag.textContent = '@' + (user.username || 'unknown');
    usernameTag.style.cssText = 'font-size: 14px; color: var(--color-accent); background: var(--color-accent-subtle, rgba(42,171,238,0.1)); padding: 6px 14px; border-radius: 999px; font-weight: 500;';
    body.appendChild(usernameTag);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = user.name || '';
    nameInput.maxLength = 32;
    nameInput.style.cssText = 'font-size: 20px; font-weight: 600; text-align: center; padding: 8px 12px; border: 2px solid transparent; border-radius: 12px; background: var(--color-bg-hover); width: 100%; max-width: 260px; outline: none; color: inherit; font-family: inherit;';
    nameInput.addEventListener('focus', () => nameInput.style.borderColor = 'var(--color-accent)');
    nameInput.addEventListener('blur', async () => {
      nameInput.style.borderColor = 'transparent';
      const newName = nameInput.value.trim();
      if (newName.length < 2) { toast.error('Минимум 2 символа'); nameInput.value = user.name; return; }
      user.name = newName;
      await DB.put('users', user);
      bus.emit('chats:update');
      toast.success('Имя сохранено');
    });
    body.appendChild(nameInput);

    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.textContent = '🔁  Сменить пользователя';
    switchBtn.style.cssText = 'display: block; width: 100%; padding: 12px 16px; border: none; border-radius: 12px; background: var(--color-accent); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;';
    switchBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Выйти?', message: 'Следующий вход — по @username.', confirmText: 'Выйти' });
      if (ok) { await Auth.logout(); location.reload(); }
    });
    body.appendChild(switchBtn);

    const version = document.createElement('div');
    version.textContent = 'Ultra Messenger v3.0';
    version.style.cssText = 'text-align: center; color: var(--color-text-tertiary); font-size: 12px;';
    body.appendChild(version);

    modal({ title: 'Профиль', body });
  },

  _showChatInfo(chat) {
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
    body.append(el('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      avatar({ name: chat.title, gradient: chat.gradient, avatarUrl: chat.avatar, size: 'xl' }),
      el('div', {},
        el('h3', { text: chat.title, style: { fontSize: '18px', fontWeight: '600' } }),
        el('p', { text: chat.type === 'group' ? `${(chat.participants || []).length} участников` : 'Личный чат', style: { fontSize: '13px', color: 'var(--color-text-secondary)' } })
      )
    ));
    import('./ui/Modal.js').then(({ modal }) => modal({ title: 'Информация о чате', body }));
  },

  async _clearHistory(chat) {
    const { confirmDialog } = await import('./ui/Modal.js');
    if (!await confirmDialog({ title: 'Очистить историю?', message: 'Все сообщения будут удалены.', danger: true, confirmText: 'Очистить' })) return;
    store.state.messages[chat.id] = [];
    await DB.deleteMessagesByChat(chat.id);
    bus.emit('messages:render');
    bus.emit('chats:update');
    toast.success('История очищена');
  }
};

/**
 * Сжимает изображение через canvas.
 */
function compressImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = height * maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = width * maxSize / height;
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.__APP__ = APP;

window.addEventListener('DOMContentLoaded', () => {
  APP.init().catch((e) => {
    console.error(e);
    document.getElementById('splash').hidden = true;
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif"><h1>Ошибка запуска</h1><p style="color:#666">' + e.message + '</p><button onclick="location.reload()" style="padding:12px 24px;border-radius:8px;border:none;background:#2aabee;color:#fff;cursor:pointer">Перезагрузить</button></div>';
  });
});


function getChatStatusText(chat) {
  if (chat.type === 'bot') return 'бот';
  if (chat.type === 'group') return `${(chat.participants || []).length} участников`;
  if (chat.type === 'channel') return 'канал';
  if (chat.type === 'saved') return 'сохранённые';
  const me = window.__STORE__?.state?.user;
  const partner = (chat.participants || []).find((p) => p.id !== me?.username);
  if (partner) {
    const online = window.__STORE__?.state?.onlineUsers?.[partner.id];
    return online ? 'онлайн' : 'не в сети';
  }
  return 'онлайн';
}
