/**
 * WebRTC эмуляция звонка (реальный getUserMedia + отображение).
 * Screen sharing через getDisplayMedia, PiP.
 */
import { el, formatDuration } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { toast } from '../../ui/Toast.js';

export class Call {
  constructor() {
    this.overlay = document.getElementById('callOverlay');
    this.active = null;
  }

  async start(chatId, { video = false } = {}) {
    const chat = store.state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    let localStream = null;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    } catch {
      toast.error('Не удалось получить доступ к микрофону/камере');
      return;
    }

    this.active = {
      chatId,
      chat,
      video,
      localStream,
      startTime: Date.now(),
      muted: false,
      videoOff: !video,
      screenSharing: false,
      timerInterval: null
    };

    this._render();
    this.overlay.hidden = false;

    this.active.timerInterval = setInterval(() => {
      const timerEl = document.getElementById('callTimer');
      if (timerEl) timerEl.textContent = formatDuration((Date.now() - this.active.startTime) / 1000);
    }, 500);

    bus.emit('call:started', { chatId, video });
  }

  _render() {
    const { chat, localStream, video } = this.active;

    this.overlay.replaceChildren();

    const container = el('div', {
      style: {
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #1a2633, #0e1621)',
        position: 'relative'
      }
    });

    // Видео собеседника (эмуляция — аватар + пульсация)
    const remote = el('div', {
      style: {
        flex: '1', display: 'grid', placeItems: 'center',
        position: 'relative'
      }
    });

    // Аватар собеседника (в стиле большого круга)
    const remoteAvatar = el('div', {
      style: {
        width: '180px', height: '180px',
        borderRadius: '50%',
        background: chat.gradient || 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: '64px', fontWeight: '600',
        animation: 'pulse 3s infinite',
        boxShadow: '0 0 80px rgba(42, 171, 238, 0.4)'
      },
      text: chat.title.charAt(0).toUpperCase()
    });
    remote.append(remoteAvatar);

    // Локальное видео (PiP в углу)
    if (video && localStream) {
      const localVideo = el('video', {
        autoplay: true,
        muted: true,
        playsinline: true,
        style: {
          position: 'absolute',
          top: '20px', right: '20px',
          width: '180px', height: '120px',
          objectFit: 'cover',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '2px solid rgba(255,255,255,0.1)',
          zIndex: '10',
          cursor: 'pointer'
        }
      });
      localVideo.srcObject = localStream;
      localVideo.addEventListener('click', () => {
        if (document.pictureInPictureEnabled && localVideo.requestPictureInPicture) {
          localVideo.requestPictureInPicture().catch(() => {});
        }
      });
      remote.append(localVideo);
    }

    container.append(remote);

    // Инфо сверху
    const header = el('div', {
      style: {
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '24px',
        display: 'flex', alignItems: 'center', gap: '16px',
        color: '#fff',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent)'
      }
    },
      el('div', {
        style: {
          width: '44px', height: '44px',
          borderRadius: '50%',
          background: chat.gradient || 'linear-gradient(135deg, #667eea, #764ba2)',
          display: 'grid', placeItems: 'center',
          fontWeight: '600'
        },
        text: chat.title.charAt(0).toUpperCase()
      }),
      el('div', {},
        el('div', { style: { fontWeight: '600', fontSize: '18px' }, text: chat.title }),
        el('div', { id: 'callTimer', style: { fontSize: '14px', opacity: '0.8' }, text: '0:00' })
      )
    );
    container.append(header);

    // Кнопки управления
    const controls = el('div', {
      style: {
        position: 'absolute', bottom: '40px', left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', gap: '16px', alignItems: 'center'
      }
    });

    const ctrlBtn = (iconName, label, onClick, danger = false) => {
      const btn = el('button', {
        'aria-label': label,
        title: label,
        onClick,
        style: {
          width: '60px', height: '60px',
          borderRadius: '50%',
          background: danger ? '#e53935' : 'rgba(255,255,255,0.15)',
          color: '#fff',
          display: 'grid', placeItems: 'center',
          backdropFilter: 'blur(10px)',
          transition: 'transform 0.15s, background 0.15s',
          border: 'none'
        }
      }, icon(iconName, 24));
      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
      btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
      return btn;
    };

    // Mute
    const muteBtn = ctrlBtn('mic', 'Микрофон', () => {
      this.active.muted = !this.active.muted;
      localStream.getAudioTracks().forEach((t) => t.enabled = !this.active.muted);
      muteBtn.replaceChildren(icon(this.active.muted ? 'micOff' : 'mic', 24));
      muteBtn.style.background = this.active.muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
    });

    controls.append(muteBtn);

    if (video) {
      const camBtn = ctrlBtn('video', 'Камера', () => {
        this.active.videoOff = !this.active.videoOff;
        localStream.getVideoTracks().forEach((t) => t.enabled = !this.active.videoOff);
        camBtn.replaceChildren(icon(this.active.videoOff ? 'video' : 'video', 24));
        camBtn.style.opacity = this.active.videoOff ? '0.5' : '1';
      });
      controls.append(camBtn);
    }

    // Screen share
    const screenBtn = ctrlBtn('screen', 'Демонстрация экрана', async () => {
      try {
        if (this.active.screenSharing) {
          this.active.screenStream?.getTracks().forEach((t) => t.stop());
          this.active.screenSharing = false;
          screenBtn.style.background = 'rgba(255,255,255,0.15)';
        } else {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          this.active.screenStream = screenStream;
          this.active.screenSharing = true;
          screenBtn.style.background = 'var(--color-accent)';
          screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            this.active.screenSharing = false;
            screenBtn.style.background = 'rgba(255,255,255,0.15)';
          });
          toast.info('Демонстрация экрана включена');
        }
      } catch {
        // пользователь отменил
      }
    });
    controls.append(screenBtn);

    // Speaker
    const speakerBtn = ctrlBtn('speaker', 'Динамик', () => {
      toast.info('Динамик переключён');
    });
    controls.append(speakerBtn);

    // End call
    const endBtn = ctrlBtn('phone', 'Завершить', () => this.end(), true);
    controls.append(endBtn);

    container.append(controls);
    this.overlay.append(container);
  }

  end() {
    if (!this.active) return;
    this.active.localStream?.getTracks().forEach((t) => t.stop());
    this.active.screenStream?.getTracks().forEach((t) => t.stop());
    clearInterval(this.active.timerInterval);
    this.overlay.hidden = true;
    this.overlay.replaceChildren();
    const duration = (Date.now() - this.active.startTime) / 1000;
    bus.emit('call:ended', { chatId: this.active.chatId, duration });
    this.active = null;
  }
}
