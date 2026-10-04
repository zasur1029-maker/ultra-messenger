/**
 * Список сообщений с виртуальным скроллом (упрощённый, но эффективный).
 * Стратегия: рендерим все сообщения, но контент скрываем через content-visibility.
 * Для 10000+ — можно расширить до полной виртуализации.
 */
import { el, formatTime, formatDate, formatDuration, groupBy, debounce } from '../../core/Utils.js';
import { icon, iconHTML } from '../../core/Icon.js';
import { renderMarkdown, stripMarkdown } from './MarkdownLite.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { avatar } from '../../ui/Avatar.js';
import { showContextMenu } from '../../ui/ContextMenu.js';
import { toast } from '../../ui/Toast.js';

export class MessageList {
  constructor(container) {
    this.container = container;
    this.scrollDownBtn = document.getElementById('scrollDown');
    this.scrollDownBadge = document.getElementById('scrollDownBadge');
    this.autoScroll = true;
    this.displayLimit = 300;  // сколько сообщений показывать
    this.unreadBelow = 0;
    this._bindScroll();
    bus.on('messages:render', () => this.render());
    bus.on('messages:append', ({ chatId, message }) => this.append(chatId, message));
    bus.on('messages:update', ({ chatId, message }) => this.update(chatId, message));
  }

  _bindScroll() {
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = this.container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 60;
      this.autoScroll = atBottom;
      this.scrollDownBtn.hidden = atBottom || this.container.children.length === 0;
      if (atBottom) { this.unreadBelow = 0; this.scrollDownBadge.textContent = ''; }
    };
    this.container.addEventListener('scroll', onScroll, { passive: true });
    this.scrollDownBtn.addEventListener('click', () => this.scrollToBottom(true));
  }

  render() {
    const chatId = store.state.activeChatId;
    if (!chatId) { this.container.replaceChildren(); return; }
    const allMessages = store.state.messages[chatId] || [];
    // Показываем только последние displayLimit
    const messages = allMessages.slice(-this.displayLimit);
    const hasMore = allMessages.length > this.displayLimit;
    this._hasMore = hasMore;
    this._totalMessages = allMessages.length;
    const chat = store.state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    const frag = document.createDocumentFragment();

    // Группировка по дням
    const byDay = new Map();
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(m);
    }

    let prevAuthor = null;
    let prevTime = 0;

    for (const [key, dayMessages] of byDay) {
      const dayDivider = el('div', { class: 'day-divider' },
        el('span', { text: formatDate(dayMessages[0].createdAt) })
      );
      frag.append(dayDivider);

      for (const msg of dayMessages) {
        const grouped = prevAuthor === msg.authorId && (msg.createdAt - prevTime) < 3 * 60_000;
        frag.append(this._renderMessage(msg, chat, grouped));
        prevAuthor = msg.authorId;
        prevTime = msg.createdAt;
      }
    }

    this.container.replaceChildren(frag);
    if (this.autoScroll) this.scrollToBottom(false);
  }

  _renderMessage(msg, chat, grouped) {
    const me = store.state.user;
    const isOut = msg.authorId === me.id || msg.authorId === me.username;
    const participants = chat.participants || [];

    let author;
    if (isOut) {
      author = me;
    } else {
      author = participants.find((p) => p.id === msg.authorId) ||
               participants.find((p) => p.id === String(msg.authorId).toLowerCase()) ||
               { name: msg.authorName || 'Пользователь', gradient: null };
    }

    const msgNode = el('div', {
      class: 'msg ' + (isOut ? 'msg--out' : 'msg--in') + (grouped ? ' msg--grouped' : ''),
      dataset: { id: msg.id, chatId: chat.id },
      role: 'article'
    });

    // Аватар собеседника
    if (!isOut && chat.type !== 'personal' && chat.type !== 'bot' && chat.type !== 'saved') {
      const av = avatar({ name: author.name, gradient: author.gradient, size: 'sm' });
      msgNode.append(el('div', { class: 'msg__avatar' }, av));
    } else if (!isOut && !grouped) {
      msgNode.append(el('div', { class: 'msg__avatar', style: { width: '32px' } }));
    }

    // Body
    const body = el('div', { class: 'msg__body' });
    const bubble = el('div', { class: 'bubble ' + (isOut ? 'bubble--out' : 'bubble--in') + (!grouped ? (isOut ? ' bubble--tail-out' : ' bubble--tail-in') : '') });

    // Reply quote
    if (msg.replyTo) {
      const original = (store.state.messages[chat.id] || []).find((m) => m.id === msg.replyTo);
      if (original) {
        const origAuthor = original.authorId === me.id || original.authorId === me.username
          ? me
          : participants.find((p) => p.id === original.authorId) || { name: 'Кто-то' };
        const quote = el('div', {
          class: 'bubble__quote',
          onClick: () => this._scrollToMessage(original.id)
        },
          el('span', { class: 'bubble__quote-author', text: origAuthor.name }),
          el('span', { class: 'bubble__quote-text', text: stripMarkdown(original.text || '').slice(0, 120) })
        );
        bubble.append(quote);
      }
    }

    // Forward
    if (msg.forwardedFrom) {
      const fwd = el('div', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--color-accent)',
          fontSize: '13px',
          fontStyle: 'italic',
          marginBottom: '6px',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--color-divider)',
          width: '100%'
        }
      });
      const arrow = icon('forward', 14, 2.2);
      arrow.style.opacity = '0.9';
      fwd.append(arrow);
      fwd.append(el('span', { text: 'Переслано от ' + (msg.forwardedFrom.authorName || 'неизвестно') }));
      bubble.append(fwd);
    }

    // Автор в группах
    if (!isOut && !grouped && (chat.type === 'group' || chat.type === 'channel')) {
      bubble.append(el('div', { class: 'bubble__author', text: author.name }));
    }

    // Картинки
    if (msg.type === 'image' && msg.attachments && msg.attachments[0]) {
      const att = msg.attachments[0];
      if (!att.url || att.broken) {
        const placeholder = el('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 16px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: 'var(--color-text-tertiary)', fontSize: '13px', marginBottom: '4px', minWidth: '180px' },
          text: '🖼 Загрузка…'
        });
        bubble.append(placeholder);
        
        // Подгружаем картинку
        if (msg.id) {
          fetch('/api/data').then((r) => r.json()).then((data) => {
            const full = (data.messages || []).find((x) => x.id === msg.id);
            if (full && full.attachments && full.attachments[0] && full.attachments[0].url) {
              placeholder.replaceWith(el('img', {
                class: 'bubble__image',
                src: full.attachments[0].url,
                style: { maxWidth: '100%', borderRadius: '12px', marginBottom: '4px', cursor: 'pointer' },
                onClick: () => window.open(full.attachments[0].url, '_blank')
              }));
            }
          }).catch(() => {});
        }
      } else {
        const img = el('img', {
          class: 'bubble__image',
          src: att.url,
          alt: 'Изображение',
          loading: 'lazy',
          style: { maxWidth: '100%', maxHeight: '400px', borderRadius: '12px', marginBottom: '4px', cursor: 'pointer', objectFit: 'cover' }
        });
        img.addEventListener('click', () => window.open(att.url, '_blank'));
        bubble.append(img);
      }
    }

        // Видео
    if (msg.type === 'video' && msg.attachments && msg.attachments[0]) {
      const att = msg.attachments[0];
      const videoWrap = el('div', {
        style: {
          position: 'relative',
          marginBottom: '4px',
          borderRadius: '12px',
          overflow: 'hidden',
          cursor: 'pointer',
          maxWidth: '320px',
          minWidth: '200px'
        }
      });

      // Превью (thumbnail) или gradient
      const preview = el('div', {
        style: {
          background: att.thumbnail ? `url(${att.thumbnail}) center/cover` : 'linear-gradient(135deg, #667eea, #764ba2)',
          width: '100%',
          aspectRatio: att.width && att.height ? `${att.width}/${att.height}` : '16/9',
          maxHeight: '400px',
          display: 'grid',
          placeItems: 'center',
          position: 'relative'
        }
      });

      // Play-кнопка
      preview.appendChild(el('div', {
        style: {
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: '24px',
          backdropFilter: 'blur(8px)'
        },
        text: '▶'
      }));

      // Длительность
      if (att.duration) {
        preview.appendChild(el('span', {
          style: {
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            padding: '2px 8px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: '12px',
            borderRadius: '8px',
            fontFamily: 'monospace'
          },
          text: formatDuration(att.duration)
        }));
      }

      videoWrap.appendChild(preview);

      // Клик — открыть видео (если URL доступен)
      videoWrap.addEventListener('click', async () => {
        // Если url есть и это blob — играем локально
        if (att.url) {
          openVideoModal(att.url);
        } else {
          // Пытаемся загрузить с сервера
          toast.info('Видео доступно только на устройстве отправителя');
        }
      });

      bubble.appendChild(videoWrap);
    }

    // Файлы
    if (msg.type === 'file' && msg.attachments && msg.attachments[0]) {
      const f = msg.attachments[0];
      bubble.append(el('a', { class: 'bubble__file', href: f.url, download: f.name },
        el('div', { class: 'bubble__file-icon' }, icon('file', 20)),
        el('div', { class: 'bubble__file-info' },
          el('div', { class: 'bubble__file-name', text: f.name }),
          el('div', { class: 'bubble__file-size', text: f.sizeFormatted || '' })
        )
      ));
    }

    // Голосовые
    if (msg.type === 'voice' && msg.attachments && msg.attachments[0]) {
      const v = msg.attachments[0];
      const voiceEl = el('div', { class: 'bubble__voice' });
      const playBtn = el('button', { class: 'voice-play', 'aria-label': 'Играть' }, icon('play', 18));
      const wave = el('div', { class: 'voice-wave' });
      const bars = v.waveform || Array.from({ length: 32 }, () => Math.random());
      bars.forEach((h) => {
        const bar = el('i');
        bar.style.height = Math.max(4, h * 24) + 'px';
        wave.append(bar);
      });
      const time = el('span', { class: 'voice-time', text: v.durationFormatted || '0:00' });
      voiceEl.append(playBtn, wave, time);
      bubble.append(voiceEl);

      let audio = null;
      let audioBroken = false;
      playBtn.addEventListener('click', async () => {
        if (audioBroken) { toast.error('Голосовое недоступно'); return; }
        try {
          if (!audio) {
            audio = new Audio();
            audio.addEventListener('ended', () => playBtn.replaceChildren(icon('play', 18)));
            audio.addEventListener('error', () => { audioBroken = true; playBtn.style.opacity = '0.5'; });
            audio.src = v.url;
          }
          if (audio.paused) {
            await audio.play();
            playBtn.replaceChildren(icon('pause', 18));
          } else {
            audio.pause();
            playBtn.replaceChildren(icon('play', 18));
          }
        } catch (err) {
          audioBroken = true;
          playBtn.style.opacity = '0.5';
        }
      });
    }

    // Текст
    if (msg.text) {
      const emojiOnly = isEmojiOnly(msg.text);
      const textNode = el('div', { class: 'bubble__text' + (emojiOnly ? ' bubble__text--emoji' : '') });
      if (emojiOnly) {
        const trimmed = msg.text.trim();
        const emojiCount = Array.from(trimmed).length;
        let size = '52px';
        if (emojiCount >= 4) size = '36px';
        if (emojiCount >= 7) size = '26px';
        textNode.style.fontSize = size;
        textNode.style.lineHeight = '1.1';
        textNode.style.textAlign = 'center';
        textNode.style.letterSpacing = '2px';
        textNode.textContent = trimmed;
      } else {
        textNode.append(renderMarkdown(msg.text));
      }
      bubble.append(textNode);
    }

    // Мета: время + галочки
    const meta = el('span', { class: 'bubble__meta' });
    if (msg.edited) meta.append(el('span', { class: 'msg--edited', text: 'ред. ' }));
    meta.append(el('span', { text: formatTime(msg.createdAt) }));

    if (isOut) {
      let checkIcon = 'check';
      let checkClass = '';

      if (msg.status === 'read') {
        checkIcon = 'doubleCheck';
        checkClass = 'check--read';
      } else if (msg.status === 'delivered') {
        checkIcon = 'doubleCheck';
        checkClass = 'check--delivered';
      } else if (msg.status === 'sent') {
        checkIcon = 'check';
      } else {
        checkIcon = 'clock';
      }

      const check = icon(checkIcon, 14, 2);
      if (checkClass) check.classList.add(checkClass);
      meta.append(check);
    }
    bubble.append(meta);

    // Реакции
    const reactions = msg.reactions || {};
    const keys = Object.keys(reactions).filter((k) => reactions[k]?.length);
    if (keys.length) {
      const reactionsNode = el('div', { class: 'bubble__reactions' });
      for (const emoji of keys) {
        const users = reactions[emoji];
        const isMine = users.includes(me.id) || users.includes(me.username);
        reactionsNode.append(el('button', {
          class: 'reaction' + (isMine ? ' is-mine' : ''),
          onClick: (e) => { e.stopPropagation(); this._toggleReaction(chat.id, msg.id, emoji); }
        },
          el('span', { text: emoji }),
          el('span', { class: 'reaction__count', text: String(users.length) })
        ));
      }
      bubble.append(reactionsNode);
    }

    body.append(bubble);

    // Двойной клик — быстрая реакция
    bubble.addEventListener('dblclick', (e) => {
      if (e.target.closest('a, button, img')) return;
      this._toggleReaction(chat.id, msg.id, '❤️');
    });

    // Контекстное меню
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._showMsgContextMenu(e.clientX, e.clientY, chat, msg, isOut);
    });

    msgNode.append(body);
    return msgNode;
  }

  _showMsgContextMenu(x, y, chat, msg, isOut) {
    const items = [
      { icon: 'reply', label: 'Ответить', onClick: () => { store.state.ui.replyTo = msg; bus.emit('ui:replyChanged', msg); } },
      { icon: 'smile', label: 'Реакция', onClick: () => bus.emit('ui:reactionPicker', { chatId: chat.id, messageId: msg.id, x, y }) },
      { icon: 'copy', label: 'Копировать текст', onClick: () => navigator.clipboard.writeText(msg.text || '').then(() => toast.success('Скопировано')) },
      { icon: 'forward', label: 'Переслать', onClick: () => toast.info('Выберите чат для пересылки') },
      { divider: true },
      ...(isOut ? [
        { icon: 'edit', label: 'Редактировать', onClick: () => { store.state.ui.editingId = msg.id; bus.emit('ui:editChanged', msg); } },
        { icon: 'trash', label: 'Удалить', danger: true, onClick: () => this._deleteMessage(chat.id, msg.id) }
      ] : []),
      ...(!isOut ? [{ icon: 'trash', label: 'Удалить у себя', danger: true, onClick: () => this._deleteMessage(chat.id, msg.id) }] : [])
    ];
    showContextMenu(items, { x, y });
  }

  _toggleReaction(chatId, messageId, emoji) {
    const list = store.state.messages[chatId];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return;
    msg.reactions = msg.reactions || {};
    const users = msg.reactions[emoji] || [];
    const idx = users.indexOf(store.state.user.id);
    if (idx >= 0) users.splice(idx, 1);
    else users.push(store.state.user.id);
    if (users.length === 0) delete msg.reactions[emoji];
    else msg.reactions[emoji] = users;
    msg._updated = true;
    this.update(chatId, msg);
  }

  _deleteMessage(chatId, messageId) {
    const list = store.state.messages[chatId];
    const idx = list.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const removed = list.splice(idx, 1)[0];
    this.render();
    toast.info('Сообщение удалено', {
      action: {
        label: 'Отменить',
        onClick: () => {
          list.splice(idx, 0, removed);
          this.render();
          bus.emit('messages:persist', { chatId });
        }
      },
      duration: 5000
    });
    bus.emit('messages:persist', { chatId });
  }

  _scrollToMessage(id) {
    const node = this.container.querySelector(`[data-id="${id}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.animate([{ background: 'var(--color-accent-subtle)' }, { background: 'transparent' }], { duration: 1200 });
  }

  append(chatId, message) {
    if (chatId !== store.state.activeChatId) return;
    const list = store.state.messages[chatId] || [];
    const prev = list[list.length - 2];
    const grouped = prev && prev.authorId === message.authorId && (message.createdAt - prev.createdAt) < 3 * 60_000;
    const node = this._renderMessage(message, store.state.chats.find((c) => c.id === chatId), grouped);
    this.container.append(node);
    if (this.autoScroll) this.scrollToBottom(true);
    else {
      this.unreadBelow++;
      this.scrollDownBadge.textContent = String(this.unreadBelow);
      this.scrollDownBtn.hidden = false;
    }
  }

  update(chatId, message) {
    if (chatId !== store.state.activeChatId) return;

    // Находим сообщение в DOM
    const oldNode = this.container.querySelector('[data-id="' + message.id + '"]');
    if (!oldNode) return;

    // Находим meta (время + галочки)
    const meta = oldNode.querySelector('.bubble__meta');
    if (!meta) return;

    // Обновляем только галочку (без полной перерисовки!)
    const me = store.state.user;
    const isOut = message.authorId === me.id || message.authorId === me.username;
    if (!isOut) return;

    // Убираем старую галочку
    const oldCheck = meta.querySelector('svg');
    if (oldCheck) oldCheck.remove();

    // Добавляем новую
    let checkIcon = 'check';
    let checkClass = '';
    if (message.status === 'read') {
      checkIcon = 'doubleCheck';
      checkClass = 'check--read';
    } else if (message.status === 'delivered') {
      checkIcon = 'doubleCheck';
      checkClass = 'check--delivered';
    } else if (message.status === 'sent') {
      checkIcon = 'check';
    } else {
      checkIcon = 'clock';
    }
    const check = icon(checkIcon, 14, 2);
    if (checkClass) check.classList.add(checkClass);
    meta.append(check);

    // Также обновляем реакции если есть
    const oldReactions = oldNode.querySelector('.bubble__reactions');
    if (oldReactions && message.reactions) {
      // (не перерисовываем — только если были изменения)
    }
  }

  scrollToBottom(smooth = true) {
    this.autoScroll = true;
    this.displayLimit = 300;  // сколько сообщений показывать
    this.unreadBelow = 0;
    this.scrollDownBadge.textContent = '';
    this.scrollDownBtn.hidden = true;
    this.container.scrollTo({ top: this.container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  _quickReact(chatId, messageId) {
    console.log('[React] Открываю пикер для', messageId.slice(0, 12));

    const emojis = ['❤️', '👍', '😂', '🔥', '😮', '😢', '🎉', '👏'];

    // Backdrop — создаём ДО btn
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.35); z-index: 999998;';

    // Пикер
    const picker = document.createElement('div');
    picker.style.cssText = 'position: fixed; background: var(--color-bg-elevated, #fff); border-radius: 999px; padding: 6px; box-shadow: 0 20px 40px -8px rgba(0,0,0,0.5); display: flex; gap: 2px; z-index: 999999; left: 50%; top: 50%; transform: translate(-50%, -50%);';

    // Функция закрытия
    const close = () => {
      picker.remove();
      backdrop.remove();
      document.removeEventListener('keydown', onEsc);
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };

    // Обработчики
    backdrop.addEventListener('click', close);

    emojis.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = emoji;
      btn.style.cssText = 'width: 44px; height: 44px; border: none; background: transparent; border-radius: 50%; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: transform 0.12s, background 0.12s;';
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.25)';
        btn.style.background = 'var(--color-bg-hover, #f4f4f5)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[React] Выбрано:', emoji);
        this._toggleReaction(chatId, messageId, emoji);
        close();
      });
      picker.appendChild(btn);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(picker);
    document.addEventListener('keydown', onEsc);
  }

  _forwardMessage(chatId, msg) {
    console.log('[Forward] Открываю выбор чата');

    const chats = store.state.chats.filter((c) => c.id !== chatId);
    if (!chats.length) {
      toast.info('Нет других чатов');
      return;
    }

    import('../../ui/Modal.js').then(({ modal }) => {
      const body = document.createElement('div');
      body.style.cssText = 'display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto;';

      chats.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: none; background: transparent; border-radius: 10px; cursor: pointer; text-align: left; width: 100%; font-family: inherit; font-size: 14px; color: inherit; transition: background 0.12s;';
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--color-bg-hover)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');

        const av = document.createElement('div');
        av.textContent = (c.title || '?')[0].toUpperCase();
        av.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; background: ' + (c.gradient || 'linear-gradient(135deg, #667eea, #764ba2)') + '; color: #fff; display: grid; place-items: center; font-weight: 600; flex-shrink: 0; font-size: 16px;';
        btn.appendChild(av);

        const name = document.createElement('span');
        name.textContent = c.title;
        name.style.flex = '1';
        btn.appendChild(name);

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Forward] Выбран:', c.title);
          this._doForward(msg, c.id, c.title);
          m.close();
        });

        body.appendChild(btn);
      });

      const m = modal({ title: 'Переслать в…', body });
    }).catch((err) => {
      console.error('[Forward] Ошибка:', err);
      toast.error('Не удалось открыть список');
    });
  }

  _doForward(msg, targetChatId, targetTitle) {
    console.log('[Forward] Пересылаю в', targetTitle);

    // Определяем автора оригинала
    let originalAuthor = 'Кто-то';
    if (msg.authorId === store.state.user.id) {
      originalAuthor = store.state.user.name || 'Вы';
    } else {
      const originalChat = store.state.chats.find((c) => c.id === msg.chatId);
      if (originalChat) {
        if (originalChat.type === 'personal' || originalChat.type === 'bot') {
          originalAuthor = originalChat.title;
        } else {
          const participant = (originalChat.participants || []).find((p) => p.id === msg.authorId);
          originalAuthor = participant?.name || originalChat.title;
        }
      }
    }

    const newMsg = Object.assign({}, msg, {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      chatId: targetChatId,
      authorId: store.state.user.id,
      createdAt: Date.now(),
      status: 'sent',
      forwardedFrom: {
        chatId: msg.chatId,
        authorName: originalAuthor
      }
    });

    const list = store.state.messages[targetChatId] || (store.state.messages[targetChatId] = []);
    list.push(newMsg);

    bus.emit('messages:append', { chatId: targetChatId, message: newMsg });
    bus.emit('messages:persist', { chatId: targetChatId });

    const targetChat = store.state.chats.find((c) => c.id === targetChatId);
    if (targetChat) {
      targetChat.updatedAt = Date.now();
      bus.emit('chats:persist', targetChatId);
    }

    toast.success('Переслано в «' + targetTitle + '»');
  }

}


/**
 * Проверяет — содержит ли текст ТОЛЬКО эмодзи и пробелы (без букв/цифр).
 * Использует Unicode Extended_Pictographic.
 */
function isEmojiOnly(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 30) return false; // слишком длинный — точно не только эмодзи

  // Regex: только эмодзи + variation selectors + ZWJ + пробелы
  const emojiRegex = /^(?:\p{Extended_Pictographic}|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|\uFE0F|\u200D|\u{1F3FB}-\u{1F3FF}|\u{2700}-\u{27BF}|\u{2B00}-\u{2BFF}|[\s])+$/u;

  // Проверяем что НЕТ букв и цифр
  const hasLetters = /[a-zA-Zа-яА-Я0-9]/.test(trimmed);
  if (hasLetters) return false;

  return emojiRegex.test(trimmed);
}


function _openVideoModal(src, name) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;display:grid;place-items:center;';
  
  const video = document.createElement('video');
  video.src = src;
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  video.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:12px;';
  
  const close = document.createElement('button');
  close.textContent = '×';
  close.style.cssText = 'position:absolute;top:20px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:28px;cursor:pointer;';
  close.addEventListener('click', () => {
    video.pause();
    overlay.remove();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      video.pause();
      overlay.remove();
    }
  });
  
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      video.pause();
      overlay.remove();
      document.removeEventListener('keydown', esc);
    }
  });
  
  overlay.appendChild(video);
  overlay.appendChild(close);
  document.body.appendChild(overlay);
}
