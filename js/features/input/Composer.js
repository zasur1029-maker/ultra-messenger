/**
 * Composer — поле ввода с меню прикрепления.
 */
import { el, debounce, formatDuration, formatBytes } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { toast } from '../../ui/Toast.js';

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
    this._voiceRecorder = null;
    this._voiceUI = null;
    this._bind();
  }

  _bind() {
    const autoGrow = () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 140) + 'px';
    };
    this.input.addEventListener('input', autoGrow);

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.send(); });

    this.emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bus.emit('ui:toggleEmoji', this.emojiBtn);
    });

    // МЕНЮ ПРИКРЕПЛЕНИЯ
    this.attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showAttachMenu();
    });

    this.fileInput.addEventListener('change', (e) => this._handleFiles(e.target.files));

    // Drag & drop
    const conv = document.querySelector('.conversation');
    if (conv) {
      conv.addEventListener('dragover', (e) => { e.preventDefault(); conv.style.outline = '2px dashed var(--color-accent)'; });
      conv.addEventListener('dragleave', () => { conv.style.outline = ''; });
      conv.addEventListener('drop', (e) => {
        e.preventDefault();
        conv.style.outline = '';
        if (e.dataTransfer.files.length) this._handleFiles(e.dataTransfer.files);
      });
    }

    this.voiceBtn.addEventListener('click', () => this._startVoiceRecording());

    bus.on('ui:replyChanged', (msg) => this._renderReplyPreview(msg));
    bus.on('ui:editChanged', (msg) => this._renderEditPreview(msg));

    const onTyping = debounce(() => {
      bus.emit('user:stoppedTyping');
      const chatId = store.state.activeChatId;
      if (chatId) {
        import('../../data/Sync.js').then(({ Sync }) => {
          if (store.state.user?.username) Sync.setTyping(store.state.user.username, chatId, false);
        }).catch(() => {});
      }
    }, 1500);

    this.input.addEventListener('input', () => {
      bus.emit('user:typing');
      const chatId = store.state.activeChatId;
      if (chatId) {
        import('../../data/Sync.js').then(({ Sync }) => {
          if (store.state.user?.username) Sync.setTyping(store.state.user.username, chatId, true);
        }).catch(() => {});
      }
      onTyping();
    });
  }

  _showAttachMenu() {
    console.log('[Composer] Меню прикрепления');
    document.querySelector('.attach-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'attach-menu';
    menu.style.position = 'fixed';
    menu.style.background = '#2b2b2b';
    menu.style.borderRadius = '12px';
    menu.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
    menu.style.padding = '6px';
    menu.style.minWidth = '220px';
    menu.style.zIndex = '999999';
    menu.style.border = '1px solid #2f2f2f';

    const items = [
      { icon: 'image', label: 'Фото или видео', accept: 'image/*,video/*' },
      { icon: 'file', label: 'Документ', accept: '.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx' },
      { icon: 'voice', label: 'Аудио', accept: 'audio/*' },
      { divider: true },
      { icon: 'poll', label: 'Опрос', disabled: true },
      { icon: 'check', label: 'Чек-лист', disabled: true }
    ];

    const icons = {
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
      voice: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
      poll: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
      check: '<path d="M20 6 9 17l-5-5"/>'
    };

    items.forEach((item) => {
      if (item.divider) {
        const d = document.createElement('div');
        d.style.height = '1px';
        d.style.background = '#2f2f2f';
        d.style.margin = '4px 6px';
        menu.appendChild(d);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '12px';
      btn.style.width = '100%';
      btn.style.padding = '10px 12px';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.borderRadius = '8px';
      btn.style.fontSize = '14px';
      btn.style.fontFamily = 'inherit';
      btn.style.textAlign = 'left';
      btn.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
      btn.style.color = item.disabled ? '#707579' : '#ffffff';

      if (!item.disabled) {
        btn.addEventListener('mouseenter', () => btn.style.background = '#3a3a3a');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.innerHTML = icons[item.icon] || '';
      btn.appendChild(svg);

      const label = document.createElement('span');
      label.textContent = item.label;
      btn.appendChild(label);

      if (!item.disabled) {
        btn.addEventListener('click', () => {
          menu.remove();
          this.fileInput.accept = item.accept || '*/*';
          this.fileInput.click();
        });
      }

      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const rect = this.attachBtn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, rect.left) + 'px';
    menu.style.top = Math.max(8, rect.top - menuRect.height - 8) + 'px';

    const closeOnOutside = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== this.attachBtn) {
        menu.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    const closeOnEsc = (ev) => {
      if (ev.key === 'Escape') {
        menu.remove();
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnOutside);
      document.addEventListener('keydown', closeOnEsc);
    }, 10);
  }

  focus() { this.input.focus(); }

  send() {
    const text = this.input.value.trim();
    const chatId = store.state.activeChatId;
    if (!chatId) { toast.error('Не выбран чат'); return; }

    const editingId = store.state.ui.editingId;
    if (editingId) { this._applyEdit(chatId, editingId, text); return; }
    if (!text) return;

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

    if (!store.state.messages[chatId]) store.state.messages[chatId] = [];
    store.state.messages[chatId].push(msg);

    const chat = store.state.chats.find((c) => c.id === chatId);
    if (chat) chat.updatedAt = Date.now();

    bus.emit('messages:append', { chatId, message: msg });
    bus.emit('message:sent', { chatId, message: msg });

    this.input.value = '';
    this.input.style.height = 'auto';
    this._clearReply();
    this.focus();

    setTimeout(() => {
      if (msg.status === 'sending') {
        msg.status = 'sent';
        bus.emit('messages:update', { chatId, message: msg });
        import('../../data/Sync.js').then(({ Sync }) => Sync.sendMessage(msg)).catch(() => {});
      }
    }, 500);

    setTimeout(() => {
      if (msg.status === 'sent') {
        msg.status = 'delivered';
        bus.emit('messages:update', { chatId, message: msg });
        import('../../data/Sync.js').then(({ Sync }) => Sync.sendMessage(msg)).catch(() => {});
      }
    }, 1500);

    import('../../data/Sync.js').then(({ Sync }) => {
      Sync.sendMessage(msg);
      if (chat) Sync.sendChat(chat);
    }).catch(() => {});
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

    const MAX_SIZE = 100 * 1024 * 1024;

    for (const file of Array.from(files).slice(0, 10)) {
      if (file.size > MAX_SIZE) {
        toast.error('Файл слишком большой: ' + (file.size / 1024 / 1024).toFixed(1) + ' МБ');
        continue;
      }

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const me = store.state.user;

      const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        chatId,
        authorId: me.username || me.id,
        authorName: me.name,
        type: isImage ? 'image' : (isVideo ? 'video' : 'file'),
        text: '',
        attachments: [{
          kind: isImage ? 'image' : (isVideo ? 'video' : 'file'),
          url: null,
          name: file.name,
          size: file.size,
          sizeFormatted: formatBytes(file.size),
          mime: file.type,
          uploading: true,
          progress: 0
        }],
        reactions: {},
        status: 'sending',
        createdAt: Date.now()
      };

      const list = store.state.messages[chatId] || (store.state.messages[chatId] = []);
      list.push(msg);
      bus.emit('messages:append', { chatId, message: msg });

      if (isVideo) {
        try {
          const meta = await getVideoMetadata(file);
          msg.attachments[0].thumbnail = meta.thumbnail;
          msg.attachments[0].duration = meta.duration;
          msg.attachments[0].width = meta.width;
          msg.attachments[0].height = meta.height;
          bus.emit('messages:update', { chatId, message: msg });
        } catch (e) {}
      }

      if (isImage) {
        try {
          const preview = await fileToDataUrl(file);
          msg.attachments[0].thumbnail = preview;
          msg.attachments[0].url = preview;
          bus.emit('messages:update', { chatId, message: msg });
        } catch (e) {}
      }

      try {
        const uploaded = await uploadFileWithProgress(file, (progress) => {
          msg.attachments[0].progress = progress;
          bus.emit('messages:update', { chatId, message: msg });
        });

        msg.attachments[0].url = uploaded.url;
        msg.attachments[0].uploading = false;
        msg.attachments[0].progress = 100;

        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg)
        });

        msg.status = 'sent';
        bus.emit('messages:update', { chatId, message: msg });

        import('../../data/Sync.js').then(({ Sync }) => Sync.sendMessage(msg)).catch(() => {});

        setTimeout(() => {
          msg.status = 'delivered';
          bus.emit('messages:update', { chatId, message: msg });
        }, 500);
      } catch (err) {
        console.error('[Composer]', err);
        toast.error('Ошибка загрузки: ' + err.message);
        msg.attachments[0].uploading = false;
        msg.attachments[0].error = true;
        bus.emit('messages:update', { chatId, message: msg });
      }
    }
    this.fileInput.value = '';
  }

  async _startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Микрофон недоступен');
      return;
    }
    if (this._voiceRecorder) {
      await this._stopVoiceRecording(true);
      return;
    }

    let recorder, stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
    } catch (e) {
      toast.error('Микрофон запрещён');
      return;
    }

    this._voiceRecorder = recorder;
    this._voiceStream = stream;
    this._voiceChunks = [];
    this._voiceStart = Date.now();
    this._voiceCancelled = false;

    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size) this._voiceChunks.push(e.data);
    });

    recorder.start();
    this.voiceBtn.classList.add('is-recording');
    this.voiceBtn.style.color = 'var(--color-danger)';

    const timer = document.createElement('span');
    timer.style.cssText = 'font-size:13px;color:var(--color-danger);align-self:center;padding:0 8px;font-variant-numeric:tabular-nums;';
    timer.textContent = '0:00';
    this.form.insertBefore(timer, this.input);
    this.input.style.display = 'none';
    this.sendBtn.style.display = 'none';

    this._voiceTimerInterval = setInterval(() => {
      timer.textContent = formatDuration((Date.now() - this._voiceStart) / 1000);
    }, 200);

    this._voiceTimerEl = timer;
  }

  async _stopVoiceRecording(send = true) {
    if (!this._voiceRecorder) return;
    const recorder = this._voiceRecorder;
    const stream = this._voiceStream;
    const startTime = this._voiceStart;

    clearInterval(this._voiceTimerInterval);
    this._voiceTimerEl?.remove();
    this.input.style.display = '';
    this.sendBtn.style.display = '';
    this.voiceBtn.classList.remove('is-recording');
    this.voiceBtn.style.color = '';

    return new Promise((resolve) => {
      recorder.addEventListener('stop', async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this._voiceChunks, { type: 'audio/webm' });
        this._voiceRecorder = null;
        this._voiceStream = null;
        this._voiceChunks = [];

        if (!send || blob.size < 200) { resolve(); return; }

        const duration = (Date.now() - startTime) / 1000;
        const chatId = store.state.activeChatId;
        if (!chatId) { resolve(); return; }

        const waveform = Array.from({ length: 40 }, () => 0.3 + Math.random() * 0.7);
        const me = store.state.user;

        const msg = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          chatId,
          authorId: me.username || me.id,
          authorName: me.name,
          type: 'voice',
          text: '',
          attachments: [{
            kind: 'voice',
            blob,
            url: URL.createObjectURL(blob),
            duration,
            durationFormatted: formatDuration(duration),
            waveform,
            mime: 'audio/webm'
          }],
          reactions: {},
          status: 'sending',
          createdAt: Date.now()
        };

        const list = store.state.messages[chatId] || (store.state.messages[chatId] = []);
        list.push(msg);
        bus.emit('messages:append', { chatId, message: msg });
        bus.emit('message:sent', { chatId, message: msg });
        resolve();
      }, { once: true });

      recorder.stop();
    });
  }

  _renderReplyPreview(msg) {
    const chat = store.state.chats.find((c) => c.id === msg.chatId);
    const author = msg.authorId === store.state.user.id ? store.state.user
      : (chat?.participants?.find((p) => p.id === msg.authorId) || { name: 'Пользователь' });
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function uploadFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      } else {
        reject(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Сеть'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

async function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      video.currentTime = Math.min(1, duration / 2);
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxW = 400;
          const ratio = Math.min(1, maxW / width);
          canvas.width = width * ratio;
          canvas.height = height * ratio;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve({ duration, width, height, thumbnail });
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve({ duration, width, height, thumbnail: null });
        }
      };
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video error')); };
  });
}
