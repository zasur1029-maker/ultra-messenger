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
    const onTyping = debounce(() => {
      bus.emit('user:stoppedTyping');
      const chatId = store.state.activeChatId;
      if (chatId) {
        import('../../data/Sync.js').then(({ Sync }) => {
          if (store.state.user?.username) {
            Sync.setTyping(store.state.user.username, chatId, false);
          }
        });
      }
    }, 1500);
    this.input.addEventListener('input', () => {
      bus.emit('user:typing');
      const chatId = store.state.activeChatId;
      if (chatId) {
        import('../../data/Sync.js').then(({ Sync }) => {
          if (store.state.user?.username) {
            Sync.setTyping(store.state.user.username, chatId, true);
          }
        });
      }
      onTyping();
    });
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
    // 1. Загружаем blob как base64
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUrl = 'data:' + (blob.type || 'audio/webm') + ';base64,' + base64;

        // 2. Сохраняем на сервере
        let voiceUrl = null;
        try {
          const res = await fetch('/api/upload-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, name: 'voice-' + Date.now() + '.webm' })
          });
          const uploaded = await res.json();
          voiceUrl = uploaded.url;
          console.log('[Voice] Загружено:', voiceUrl);
        } catch (e) {
          console.warn('[Voice] Ошибка загрузки:', e);
        }

        const msg = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          chatId,
          authorId: me.username || me.id,
          authorName: me.name,
          type: 'voice',
          text: '',
          attachments: [{
            kind: 'voice',
            url: voiceUrl || URL.createObjectURL(blob),
            duration,
            durationFormatted: formatDuration(duration),
            waveform,
            mime: blob.type || 'audio/webm'
          }],
          reactions: {},
          status: 'sending',
          createdAt: Date.now()
        };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ duration, width, height, thumbnail: null });
      };
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать видео'));
    };
  });
}

/**
 * Загружает файл с прогрессом через XHR.
 */
function uploadFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      } else {
        reject(new Error('Upload failed: ' + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}
