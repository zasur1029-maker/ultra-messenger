/**
 * Список чатов: рендер, сортировка, фильтрация, поиск.
 * Использует FLIP-анимации для плавной сортировки.
 */
import { el, formatTime, stripMarkdown as strip, debounce, rafThrottle } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { avatar } from '../../ui/Avatar.js';
import { showContextMenu } from '../../ui/ContextMenu.js';
import { showDropdown } from '../../ui/Dropdown.js';
import { toast } from '../../ui/Toast.js';
import { Stories, openStoryViewer } from '../messages/Stories.js';

export class ChatList {
  constructor(container) {
    this.container = container;
    this.searchInput = document.getElementById('searchInput');
    this.searchClear = document.getElementById('searchClear');
    this.filters = document.getElementById('filters');

    this._bindEvents();
    this.render();
  }

  _bindEvents() {
    // Поиск
    const onSearch = debounce((v) => {
      store.state.ui.searchQuery = v;
      this.searchClear.hidden = !v;
      this.render();
    }, 150);
    this.searchInput.addEventListener('input', (e) => onSearch(e.target.value.trim()));
    this.searchClear.addEventListener('click', () => {
      this.searchInput.value = '';
      store.state.ui.searchQuery = '';
      this.searchClear.hidden = true;
      this.render();
    });

    // Фильтры
    this.filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter');
      if (!btn) return;
      this.filters.querySelectorAll('.filter').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      store.state.ui.filter = btn.dataset.filter;
      this.render();
    });

    bus.on('chats:update', () => this.render());
    bus.on('state:activeChatId', () => this._updateActive());
  }

  _updateActive() {
    const active = store.state.activeChatId;
    this.container.querySelectorAll('.chat-item').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.id === active);
    });
  }

  getFilteredChats() {
    const { filter, searchQuery } = store.state.ui;
    let chats = [...store.state.chats];

    // Не показываем архивные в основном списке
    chats = chats.filter((c) => !c.archived);

    // Фильтр
    if (filter === 'personal') chats = chats.filter((c) => c.type === 'personal' || c.type === 'bot');
    else if (filter === 'group') chats = chats.filter((c) => c.type === 'group');
    else if (filter === 'channel') chats = chats.filter((c) => c.type === 'channel');
    else if (filter === 'favorite') chats = chats.filter((c) => c.favorite);

    // Поиск
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      chats = chats.filter((c) => {
        if (c.title.toLowerCase().includes(q)) return true;
        const msgs = store.state.messages[c.id] || [];
        return msgs.some((m) => (m.text || '').toLowerCase().includes(q));
      });
    }

    // Сортировка: pinned → updatedAt
    chats.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    return chats;
  }

  render() {
    // FLIP: запоминаем позиции
    const oldPositions = new Map();
    this.container.querySelectorAll('.chat-item').forEach((n) => oldPositions.set(n.dataset.id, n.getBoundingClientRect().top));

    const chats = this.getFilteredChats();
    const frag = document.createDocumentFragment();

    if (chats.length === 0) {
      frag.append(el('li', { class: 'empty', style: { padding: '48px 24px' } },
        el('p', { text: 'Чаты не найдены', style: { color: 'var(--color-text-tertiary)' } })
      ));
    } else {
      for (const chat of chats) {
        frag.append(this._renderChat(chat));
      }
    }

    this.container.replaceChildren(frag);

    // FLIP: анимируем
    this.container.querySelectorAll('.chat-item').forEach((node) => {
      const oldTop = oldPositions.get(node.dataset.id);
      if (oldTop != null) {
        const newTop = node.getBoundingClientRect().top;
        const dy = oldTop - newTop;
        if (Math.abs(dy) > 1) {
          node.animate(
            [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
            { duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
          );
        }
      }
    });

    this._updateActive();
  }

  _renderChat(chat) {
    const msgs = store.state.messages[chat.id] || [];
    const last = msgs[msgs.length - 1];
    const node = el('li', {
      class: `chat-item ${chat.id === store.state.activeChatId ? 'is-active' : ''}`,
      dataset: { id: chat.id },
      role: 'option',
      'aria-selected': String(chat.id === store.state.activeChatId),
      tabindex: '0'
    });

    // Аватар с обёрткой для сторис
    const isGroup = chat.type === 'group' || chat.type === 'channel';
    const avatarWrap = el('div', { class: 'chat-item__avatar-wrap', style: { position: 'relative', flexShrink: '0' } });

    const av = avatar({
      name: chat.title,
      gradient: chat.gradient,
      avatarUrl: chat.avatar,
      size: 'lg',
      online: chat.type === 'personal' && chat.id.startsWith('bot_') && chat.id !== 'bot_helper'
    });

    // Проверяем есть ли истории
    const hasStories = Stories.for(chat.id).length > 0;
    const hasUnseen = Stories.hasUnseen(chat.id, store.state.user.id);

    if (hasStories) {
      avatarWrap.classList.add('has-stories');
      if (hasUnseen) avatarWrap.classList.add('has-unseen');
    }

    avatarWrap.appendChild(av);

    // Клик на аватар открывает сторис или профиль
    avatarWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasStories) {
        openStoryViewer(chat.id, store.state.user.id, () => {
          // Обновляем после просмотра
          this.render();
        });
      } else {
        // Открываем профиль собеседника
        import('../../app.js').then(() => {
          if (window.__APP__) window.__APP__._showUserProfile(chat);
        });
      }
    });

    node.append(avatarWrap);

    // Контент
    const body = el('div', { class: 'chat-item__body' });

    const row1 = el('div', { class: 'chat-item__row' },
      el('span', { class: 'chat-item__name', text: chat.title }),
      el('span', { class: 'chat-item__time', text: last ? formatTime(last.createdAt) : '' })
    );

    let previewText = 'Нет сообщений';
    if (last) {
      const isOwn = last.authorId === store.state.user.id;
      const prefix = isOwn ? 'Вы: ' : (isGroup && last.authorId !== store.state.user.id ? '' : '');
      if (last.type === 'image') previewText = `${prefix}📷 Фото`;
      else if (last.type === 'file') previewText = `${prefix}📎 ${last.attachments[0]?.name || 'Файл'}`;
      else if (last.type === 'voice') previewText = `${prefix}🎤 Голосовое`;
      else previewText = prefix + strip(last.text || '');
    }

    const row2 = el('div', { class: 'chat-item__preview' },
      el('span', { class: 'chat-item__preview-text', text: previewText })
    );

    body.append(row1, row2);
    node.append(body);

    // Бейдж непрочитанных
    if (chat.unread > 0) {
      node.append(el('span', { class: `chat-item__unread ${chat.muted ? 'chat-item__unread--muted' : ''}`, text: String(chat.unread) }));
    }

    // Иконки pin/mute
    if (chat.pinned) node.append(el('span', { class: 'chat-item__pin' }, icon('pin', 14, 2)));
    else if (chat.muted) node.append(el('span', { class: 'chat-item__mute' }, icon('bellOff', 14, 2)));

    // Клик
    node.addEventListener('click', () => bus.emit('ui:openChat', chat.id));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bus.emit('ui:openChat', chat.id); }
    });

    // Контекстное меню
    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu([
        { icon: 'pin', label: chat.pinned ? 'Открепить' : 'Закрепить', onClick: () => this._togglePin(chat) },
        { icon: 'bellOff', label: chat.muted ? 'Включить звук' : 'Без звука', onClick: () => this._toggleMute(chat) },
        { icon: 'star', label: chat.favorite ? 'Убрать из избранного' : 'В избранное', onClick: () => this._toggleFavorite(chat) },
        { icon: 'archive', label: 'В архив', onClick: () => this._archive(chat) },
        { divider: true },
        { icon: 'trash', label: 'Удалить чат', danger: true, onClick: () => this._delete(chat) }
      ], { x: e.clientX, y: e.clientY });
    });

    return node;
  }

  _togglePin(chat) { chat.pinned = !chat.pinned; bus.emit('chats:update'); bus.emit('chats:persist', chat.id); }
  _toggleMute(chat) { chat.muted = !chat.muted; bus.emit('chats:update'); bus.emit('chats:persist', chat.id); }
  _toggleFavorite(chat) { chat.favorite = !chat.favorite; bus.emit('chats:update'); bus.emit('chats:persist', chat.id); }
  _archive(chat) { chat.archived = true; bus.emit('chats:update'); bus.emit('chats:persist', chat.id); toast.info('Чат в архиве'); }

  async _delete(chat) {
    const { confirmDialog } = await import('../../ui/Modal.js');
    const ok = await confirmDialog({ title: 'Удалить чат?', message: 'Все сообщения будут удалены безвозвратно.', danger: true, confirmText: 'Удалить' });
    if (!ok) return;
    store.state.chats = store.state.chats.filter((c) => c.id !== chat.id);
    delete store.state.messages[chat.id];
    if (store.state.activeChatId === chat.id) store.state.activeChatId = null;
    bus.emit('chats:delete', chat.id);
    bus.emit('chats:update');
    toast.success('Чат удалён');
  }
}
