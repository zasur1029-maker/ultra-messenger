/**
 * Поле ввода: auto-grow, отправка, reply/edit preview,
 * вложения, голосовая запись.
 */
import { el, debounce, formatDuration, uid } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { createMessage } from '../../data/Models.js';
import { toast } from '../../ui/Toast.js';
import { modal } from '../../ui/Modal.js';

export class Composer {
  constructor() {
    this.input = document.getElementById('messageInput');
    this.form = document.getElementById('composer');
    this.emojiBtn = document.getElementById('emojiBtn');
    this.attachBtn = document.getElementById('attachBtn');
    this.voiceBtn = document.getElementById('voiceBtn');
    this.fileInput = document.getElementById('fileInput');
    this.replyPreview = document.getElementById('replyPreview');
    this.sendBtn = document.getElementById('sendBtn');

    this._bind();
  }

  _bind() {
    // Auto-grow
    const autoGrow = () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 140) + 'px';
    };
    this.input.addEventListener('input', autoGrow);

    // Enter / Shift+Enter
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // Submit
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.send(); });

    // Emoji
    this.emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bus.emit('ui:toggleEmoji', this.emojiBtn);
    });

    // Attach
    this.attachBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this._handleFiles(e.target.files));

    // Drag & drop
    const conv = document.querySelector('.conversation');
    conv.addEventListener('dragover', (e) => { e.preventDefault(); conv.style.outline = '2px dashed var(--color-accent)'; });
    conv.addEventListener('dragleave', () => { conv.style.outline = ''; });
    conv.addEventListener('drop', (e) => {
      e.preventDefault();
      conv.style.outline = '';
      if (e.dataTransfer.files.length) this._handleFiles(e.dataTransfer.files);
    });

    // Voice
    this.voiceBtn.addEventListener('click', () => this._startVoiceRecording());

    // Reply / Edit
    bus.on('ui:replyChanged', (msg) => this._renderReplyPreview(msg));
    bus.on('ui:editChanged', (msg) => this._renderEditPreview(msg));

    // Отслеживание печати
    const onTyping = debounce(() => bus.emit('user:stoppedTyping'), 1500);
    this.input.addEventListener('input', () => {
      bus.emit('user:typing');
      onTyping();
    });
  }

  focus() { this.input.focus(); }

  send() {
    const text = this.input.value.trim();
    const chatId = store.state.activeChatId;
    if (!chatId) {
      toast.error('Не выбран чат');
      return;
    }

    const editingId = store.state.ui.editingId;
    if (editingId) {
      this._applyEdit(chatId, editingId, text);
      return;
    }

    if (!text) return;

    // ПРОСТО: создаём сообщение и сохраняем через ChatService
    const me = store.state.user;
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      chatId,
      authorId: me.username || me.id,
      authorName: me.name,
      text,
      type: 'text',
      attachments: [],
      reactions: {},
      replyTo: store.state.ui.replyTo?.id || null,
      status: 'sending',
      createdAt: Date.now()
    };

    // СРАЗУ отправляем на сервер
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    }).catch((err) => console.warn('[Composer] Ошибка отправки:', err));

    console.log('[Composer] Сообщение отправлено:', msg.id);
    import('../../data/Sync.js').then(({ Sync }) => {
      Sync.sendMessage(msg);
      const chat = store.state.chats.find((x) => x.id === chatId);
      if (chat) Sync.sendChat(chat);
    }).catch(() => {});

    console.log('[Composer] Отправляю:', msg);

    // Добавляем в state
    if (!store.state.messages[chatId]) store.state.messages[chatId] = [];
    store.state.messages[chatId].push(msg);

    // Обновляем чат
    const chat = store.state.chats.find((c) => c.id === chatId);
    if (chat) chat.updatedAt = Date.now();

    // Эмитим события — app.js их обработает и сохранит в БД
    bus.emit('messages:append', { chatId, message: msg });
    bus.emit('message:sent', { chatId, message: msg });

    // Очищаем input
    this.input.value = '';
    this.input.style.height = 'auto';
    this._clearReply();
    this.focus();

    // СТАТУСЫ
    setTimeout(() => { msg.status = 'sent'; bus.emit('messages:update', { chatId, message: msg }); }, 300);
    setTimeout(() => { msg.status = 'delivered'; bus.emit('messages:update', { chatId, message: msg }); }, 700);
  }

  _applyEdit(chatId, messageId, newText) {
    if (!newText) return;
    const list = store.state.messages[chatId] || [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return;
    msg.text = newText;
    msg.edited = true;
    msg.editedAt = Date.now();
    bus.emit('messages:update', { chatId, message: msg });
    bus.emit('messages:persist', { chatId });
    this.input.value = '';
    this.input.style.height = 'auto';
    this._clearEdit();
  }

  async _handleFiles(files) {
    const chatId = store.state.activeChatId;
    if (!chatId) return;

    for (const file of Array.from(files).slice(0, 10)) {
      const isImage = file.type.startsWith('image/');
          let url;
    if (isImage) {
      // Для изображений — конвертируем в dataURL (навсегда сохранится)
      url = await fileToDataUrl(file);
    } else {
      // Для остальных файлов — blob (временно)
      url = URL.createObjectURL(file);
    }
      let width = null, height = null;

      if (isImage) {
        try {
          const dims = await getImageDimensions(url);
          width = dims.w; height = dims.h;
        } catch {}
      }

      const msg = createMessage({
        chatId,
        authorId: store.state.user.id,
        type: isImage ? 'image' : 'file',
        text: '',
        attachments: [{
          kind: isImage ? 'image' : 'file',
          url,
          name: file.name,
          size: file.size,
          sizeFormatted: formatBytes(file.size),
          mime: file.type,
          width, height
        }],
        status: 'sending'
      });

      const list = store.state.messages[chatId] || (store.state.messages[chatId] = []);
      list.push(msg);
      bus.emit('messages:append', { chatId, message: msg });
      bus.emit('message:sent', { chatId, message: msg });
    }
    this.fileInput.value = '';
  }

  async _startVoiceRecording() {
    // Импортируем класс
    const { VoiceRecorder } = await import('./VoiceRecorder.js');

    // Если уже записываем — остановить и отправить
    if (this._voiceRecorder && this._voiceRecorder.isRecording) {
      await this._stopVoiceRecording(true);
      return;
    }

    let recorder;
    try {
      recorder = new VoiceRecorder();
      await recorder.start();
    } catch (err) {
      console.error('[Composer] Ошибка старта записи:', err);
      toast.error('Не удалось получить доступ к микрофону');
      return;
    }

    this._voiceRecorder = recorder;
    this._voiceStartTime = Date.now();
    this._voiceCancelled = false;

    console.log('[Composer] Запись началась');

    // Меняем UI — показываем индикатор записи
    this.voiceBtn.classList.add('is-recording');
    this.voiceBtn.setAttribute('aria-label', 'Отправить голосовое');
    this.voiceBtn.title = 'Отправить голосовое';
    this.voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

    // Скрываем поле ввода и кнопку отправки
    this.input.style.display = 'none';
    this.sendBtn.style.display = 'none';

    // Создаём плашку записи
    const recordingUI = document.createElement('div');
    recordingUI.className = 'voice-recording-ui';
    recordingUI.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1; padding: 8px 12px; background: var(--color-bg-hover); border-radius: 20px;';

    const redDot = document.createElement('span');
    redDot.style.cssText = 'width: 10px; height: 10px; border-radius: 50%; background: var(--color-danger, #e53935); animation: pulse 1s infinite;';
    recordingUI.appendChild(redDot);

    const timer = document.createElement('span');
    timer.style.cssText = 'font-size: 14px; font-variant-numeric: tabular-nums; font-weight: 500; color: var(--color-danger); min-width: 45px;';
    timer.textContent = '0:00';
    recordingUI.appendChild(timer);

    const hint = document.createElement('span');
    hint.style.cssText = 'flex: 1; font-size: 13px; color: var(--color-text-secondary);';
    hint.textContent = 'Идёт запись… Нажмите ⬛ чтобы отправить';
    recordingUI.appendChild(hint);

    // Кнопка отмены
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'icon-btn';
    cancelBtn.title = 'Отменить';
    cancelBtn.setAttribute('aria-label', 'Отменить запись');
    cancelBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    cancelBtn.style.cssText = 'width: 36px; height: 36px; color: var(--color-danger);';
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._cancelVoiceRecording();
    });
    recordingUI.appendChild(cancelBtn);

    // Вставляем в форму перед voiceBtn
    this.form.insertBefore(recordingUI, this.voiceBtn);
    this._voiceUI = recordingUI;

    // Таймер обновления
    this._voiceTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - this._voiceStartTime) / 1000;
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      timer.textContent = mins + ':' + String(secs).padStart(2, '0');
    }, 200);

    // Автостоп через 5 минут
    this._voiceAutoStopTimer = setTimeout(() => {
      if (this._voiceRecorder && this._voiceRecorder.isRecording) {
        console.log('[Composer] Автостоп через 5 минут');
        this._stopVoiceRecording(true);
      }
    }, 5 * 60 * 1000);
  }

  async _stopVoiceRecording(send = true) {
    if (!this._voiceRecorder) return;

    console.log('[Composer] Останавливаю запись, send:', send);

    // Очищаем таймеры
    clearInterval(this._voiceTimerInterval);
    clearTimeout(this._voiceAutoStopTimer);

    const recorder = this._voiceRecorder;
    this._voiceRecorder = null;

    let result = null;
    try {
      result = await recorder.stop();
    } catch (err) {
      console.error('[Composer] Ошибка остановки:', err);
    }

    // Восстанавливаем UI
    this._resetVoiceUI();

    if (!send || !result || !result.blob) {
      console.log('[Composer] Запись отменена или пуста');
      return;
    }

    // Отправляем голосовое
    console.log('[Composer] Отправляю голосовое, размер:', result.blob.size);

    const chatId = store.state.activeChatId;
    if (!chatId) {
      toast.error('Не выбран чат');
      return;
    }

    // Генерируем волновую форму
    const bars = 40;
    const waveform = [];
    for (let i = 0; i < bars; i++) {
      waveform.push(0.3 + Math.random() * 0.7);
    }

    const msg = createMessage({
      chatId,
      authorId: store.state.user.id,
      type: 'voice',
      attachments: [{
        kind: 'voice',
        url: result.url,
        blob: result.blob,
        duration: result.duration,
        durationFormatted: formatDuration(result.duration),
        waveform,
        mime: result.mime || 'audio/webm'
      }],
      status: 'sending'
    });

    const list = store.state.messages[chatId] || (store.state.messages[chatId] = []);
    list.push(msg);

    const chat = store.state.chats.find((c) => c.id === chatId);
    if (chat) chat.updatedAt = Date.now();

    bus.emit('messages:append', { chatId, message: msg });
    bus.emit('message:sent', { chatId, message: msg });
    bus.emit('chats:update');

    toast.success('Голосовое отправлено');
  }

  _cancelVoiceRecording() {
    console.log('[Composer] Отмена записи');
    if (this._voiceRecorder) {
      this._voiceRecorder.cancel();
      this._voiceRecorder = null;
    }
    clearInterval(this._voiceTimerInterval);
    clearTimeout(this._voiceAutoStopTimer);
    this._resetVoiceUI();
    toast.info('Запись отменена');
  }

  _resetVoiceUI() {
    this.voiceBtn.classList.remove('is-recording');
    this.voiceBtn.setAttribute('aria-label', 'Голосовое');
    this.voiceBtn.title = 'Голосовое сообщение';
    this.voiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>';

    if (this._voiceUI) {
      this._voiceUI.remove();
      this._voiceUI = null;
    }

    this.input.style.display = '';
    this.sendBtn.style.display = '';
  }

  _renderReplyPreview(msg) {
    const chat = store.state.chats.find((c) => c.id === msg.chatId);
    const author = msg.authorId === store.state.user.id ? store.state.user : (chat?.participants?.find((p) => p.id === msg.authorId) || { name: 'Пользователь' });
    this.replyPreview.hidden = false;
    this.replyPreview.replaceChildren(
      el('div', { class: 'reply-preview__body' },
        el('div', { class: 'reply-preview__author', text: author.name }),
        el('div', { class: 'reply-preview__text', text: msg.text || 'Вложение' })
      ),
      el('button', { class: 'icon-btn', 'aria-label': 'Отменить', onClick: () => this._clearReply() }, icon('close', 18))
    );
    this.focus();
  }

  _clearReply() {
    store.state.ui.replyTo = null;
    this.replyPreview.hidden = true;
    this.replyPreview.replaceChildren();
  }

  _renderEditPreview(msg) {
    this.replyPreview.hidden = false;
    this.replyPreview.replaceChildren(
      el('div', { class: 'reply-preview__body' },
        el('div', { class: 'reply-preview__author', text: 'Редактирование' }),
        el('div', { class: 'reply-preview__text', text: msg.text })
      ),
      el('button', { class: 'icon-btn', 'aria-label': 'Отменить', onClick: () => this._clearEdit() }, icon('close', 18))
    );
    this.input.value = msg.text;
    this.input.focus();
  }

  _clearEdit() {
    store.state.ui.editingId = null;
    this.input.value = '';
    this.replyPreview.hidden = true;
    this.replyPreview.replaceChildren();
  }
}

function getImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}
/**
 * Конвертирует файл в dataURL — сохраняется навсегда.
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
