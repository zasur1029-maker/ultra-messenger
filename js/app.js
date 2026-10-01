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
  drawing: null,
  drawingBtn: null,

  getUserKey() {
    const u = store.state.user;
    return u?.username || u?.id || 'anon';
  },

  async init() {
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

    if (store.state.activeChatId) {
      this._openChat(store.state.activeChatId);
    }

    document.getElementById('splash').hidden = true;
  },

  async _loadData() {
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
    // === DRAWING init ===
    import('./features/messages/Drawing.js').then(({ Drawing }) => {
      this.drawing = new Drawing();
      const convEl = document.querySelector('.conversation');
      if (convEl) this.drawing.init(convEl);

      // Опускаем рисунки при фокусе на composer
      this.composer.input.addEventListener('focus', () => {
        if (this.drawing.hasDrawings) this.drawing.slideDown();
      });
      this.composer.input.addEventListener('blur', () => {
        if (this.drawing.hasDrawings && !this.drawing.active) this.drawing.slideUp();
      });

      // Смена чата — загрузка рисунков
      bus.on('ui:openChat', (chatId) => {
        if (this.drawing) {
          this.drawing.strokes = this.drawing._load(chatId);
          this.drawing.chatId = chatId;
          this.drawing._redrawAll();
        }
      });

      console.log('[App] Drawing подключён');
    });

    // Кнопка рисования в composer
    const composerEl = document.getElementById('composer');
    const emojiBtnEl = document.getElementById('emojiBtn');
    if (composerEl && emojiBtnEl) {
      const drawingBtn = document.createElement('button');
      drawingBtn.type = 'button';
      drawingBtn.className = 'icon-btn';
      drawingBtn.title = 'Рисовать на фоне';
      drawingBtn.setAttribute('aria-label', 'Режим рисования');
      drawingBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>';
      composerEl.insertBefore(drawingBtn, emojiBtnEl);
      this.drawingBtn = drawingBtn;

      drawingBtn.addEventListener('click', () => {
        if (!this.drawing) { toast.error('Рисование загружается…'); return; }
        const chatId = store.state.activeChatId;
        if (!chatId) { toast.info('Откройте чат'); return; }

        if (this.drawing.active) {
          this._closeDrawingUI();
        } else {
          this.drawing.enable(chatId);
          drawingBtn.style.color = 'var(--color-accent)';
          this._showDrawingToolbar();
        }
      });
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

  _openChat(chatId) {
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

    // Загрузить рисунки для этого чата
    if (this.drawing) {
      this.drawing.strokes = this.drawing._load(chatId);
      this.drawing.chatId = chatId;
      this.drawing._redrawAll();
    }

    bus.emit('messages:render');
    this.messageList.scrollToBottom(false);
    setTimeout(() => this.composer.focus(), 100);

    const userKey = this.getUserKey();
    DB.put('meta', { key: `activeChatId:${userKey}`, value: chatId });
  },

  _showDrawingToolbar() {
    console.log('[Drawing Toolbar] Открываю');
    document.querySelector('.drawing-toolbar')?.remove();
    document.querySelector('.drawing-counter')?.remove();

    const conv = document.querySelector('.conversation');
    if (!conv) { console.warn('[Drawing Toolbar] .conversation не найден'); return; }

    const toolbar = document.createElement('div');
    toolbar.className = 'drawing-toolbar';
    toolbar.style.cssText = 'position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--color-bg-elevated); border-radius: 999px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 100; max-width: calc(100vw - 32px); overflow-x: auto;';

    // Цвета
    const colors = ['#2aabee', '#e53935', '#4caf50', '#ff9800', '#8b5cf6', '#000000', '#ffffff'];
    colors.forEach((color, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'drawing-toolbar__color' + (i === 0 ? ' is-active' : '');
      btn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 2px solid ' + (i === 0 ? 'var(--color-text-primary)' : 'transparent') + '; background: ' + color + '; cursor: pointer; padding: 0; flex-shrink: 0;' + (color === '#ffffff' ? ' box-shadow: inset 0 0 0 1px #ccc;' : '');
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.drawing-toolbar__color').forEach((b) => { b.style.borderColor = 'transparent'; });
        btn.style.borderColor = 'var(--color-text-primary)';
        if (this.drawing) { this.drawing.setColor(color); this.drawing.setTool('pen'); }
      });
      toolbar.appendChild(btn);
    });

    // Разделитель
    const div1 = document.createElement('div');
    div1.style.cssText = 'width: 1px; height: 24px; background: var(--color-divider); margin: 0 4px;';
    toolbar.appendChild(div1);

    // Ручка / ластик
    const tools = [
      { tool: 'pen', svg: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>', label: 'Ручка' },
      { tool: 'eraser', svg: '<path d="M20 20H7L3 16a2 2 0 0 1 0-3L14 2a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3L11 21"/>', label: 'Ластик' }
    ];
    tools.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = t.label;
      btn.style.cssText = 'width: 32px; height: 32px; border: none; border-radius: 50%; background: ' + (t.tool === 'pen' ? 'var(--color-accent)' : 'transparent') + '; color: ' + (t.tool === 'pen' ? '#fff' : 'var(--color-text-primary)') + '; cursor: pointer; display: grid; place-items: center; padding: 0; flex-shrink: 0;';
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + t.svg + '</svg>';
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('button[data-tool]').forEach((b) => { b.style.background = 'transparent'; b.style.color = 'var(--color-text-primary)'; });
        btn.style.background = 'var(--color-accent)';
        btn.style.color = '#fff';
        if (this.drawing) this.drawing.setTool(t.tool);
      });
      btn.dataset.tool = t.tool;
      toolbar.appendChild(btn);
    });

    // Разделитель
    const div2 = document.createElement('div');
    div2.style.cssText = 'width: 1px; height: 24px; background: var(--color-divider); margin: 0 4px;';
    toolbar.appendChild(div2);

    // Размеры
    [2, 4, 8, 16].forEach((s, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Размер ' + s;
      btn.style.cssText = 'width: 28px; height: 28px; border: 2px solid ' + (i === 1 ? 'var(--color-accent)' : 'transparent') + '; border-radius: 50%; background: var(--color-bg-hover); cursor: pointer; display: grid; place-items: center; padding: 0; flex-shrink: 0;';
      btn.innerHTML = '<span style="width: ' + (s + 2) + 'px; height: ' + (s + 2) + 'px; background: var(--color-text-primary); border-radius: 50%;"></span>';
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('button[data-size]').forEach((b) => { b.style.borderColor = 'transparent'; });
        btn.style.borderColor = 'var(--color-accent)';
        if (this.drawing) this.drawing.setSize(s);
      });
      btn.dataset.size = s;
      toolbar.appendChild(btn);
    });

    // Разделитель
    const div3 = document.createElement('div');
    div3.style.cssText = 'width: 1px; height: 24px; background: var(--color-divider); margin: 0 4px;';
    toolbar.appendChild(div3);

    // Эмодзи
    const emojiBtn = document.createElement('button');
    emojiBtn.type = 'button';
    emojiBtn.title = 'Поставить эмодзи';
    emojiBtn.style.cssText = 'width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; cursor: pointer; font-size: 18px; padding: 0; flex-shrink: 0;';
    emojiBtn.textContent = '😀';
    emojiBtn.addEventListener('click', () => {
      if (!this.drawing) return;
      this.drawing.setTool('emoji');
      this.emoji.open(emojiBtn, (emoji) => {
        this.drawing._pendingEmoji = emoji;
        toast.info('Кликните на фон, чтобы поставить ' + emoji);
      });
    });
    toolbar.appendChild(emojiBtn);

    // Разделитель
    const div4 = document.createElement('div');
    div4.style.cssText = 'width: 1px; height: 24px; background: var(--color-divider); margin: 0 4px;';
    toolbar.appendChild(div4);

    // Очистить
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.title = 'Очистить всё';
    clearBtn.style.cssText = 'width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--color-danger); cursor: pointer; display: grid; place-items: center; padding: 0; flex-shrink: 0;';
    clearBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    clearBtn.addEventListener('click', async () => {
      const { confirmDialog } = await import('./ui/Modal.js');
      const ok = await confirmDialog({ title: 'Очистить рисунки?', message: 'Все рисунки этого чата будут удалены.', danger: true, confirmText: 'Очистить' });
      if (ok && this.drawing) {
        this.drawing.clear();
        this._updateDrawingCounter();
      }
    });
    toolbar.appendChild(clearBtn);

    // Закрыть
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = 'Закрыть';
    closeBtn.style.cssText = 'width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--color-text-secondary); cursor: pointer; display: grid; place-items: center; padding: 0; flex-shrink: 0;';
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    closeBtn.addEventListener('click', () => this._closeDrawingUI());
    toolbar.appendChild(closeBtn);

    conv.appendChild(toolbar);

    // Счётчик
    const counter = document.createElement('div');
    counter.className = 'drawing-counter';
    counter.style.cssText = 'position: absolute; top: 70px; left: 16px; padding: 6px 12px; background: var(--color-bg-elevated); color: var(--color-text-secondary); border-radius: 999px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 100;';
    counter.textContent = '🎨 ' + (this.drawing?.strokes?.length || 0) + ' шт.';
    conv.appendChild(counter);
  },

  _updateDrawingCounter() {
    const counter = document.querySelector('.drawing-counter');
    if (counter && this.drawing) {
      counter.textContent = '🎨 ' + this.drawing.strokes.length + ' шт.';
    }
  },

  _closeDrawingUI() {
    console.log('[Drawing Toolbar] Закрываю');
    document.querySelector('.drawing-toolbar')?.remove();
    document.querySelector('.drawing-counter')?.remove();
    if (this.drawing) {
      this.drawing.disable();
      this.drawing.slideUp();
    }
    if (this.drawingBtn) {
      this.drawingBtn.style.color = '';
    }
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
