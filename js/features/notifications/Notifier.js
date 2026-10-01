/**
 * Уведомления: Browser Push (эмуляция), тосты, звук.
 */
import { toast } from '../../ui/Toast.js';
import { bus } from '../../core/EventBus.js';
import { store } from '../../core/Store.js';

export class Notifier {
  constructor() {
    this.enabled = false;
    this._bind();
  }

  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { this.enabled = true; return true; }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    this.enabled = result === 'granted';
    return this.enabled;
  }

  _bind() {
    bus.on('bot:replied', ({ chatId, message }) => {
      if (chatId === store.state.activeChatId) return;
      const chat = store.state.chats.find((c) => c.id === chatId);
      if (!chat || chat.muted) return;
      this._notify(chat, message);
    });
  }

  _notify(chat, message) {
    this._playSound();
    if (this.enabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(chat.title, {
          body: message.text?.slice(0, 100) || 'Новое сообщение',
          icon: chat.gradient ? undefined : undefined,
          tag: chat.id
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch {}
    }
    if (navigator.vibrate) navigator.vibrate(40);
  }

  _playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }
}
