/**
 * AudioPlayer — глобальный плеер для аудио-сообщений.
 * Показывается сверху над composer при воспроизведении.
 */
import { el, formatDuration } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';

export class AudioPlayer {
  constructor() {
    this.audio = null;
    this.currentMsgId = null;
    this.panel = null;
    this.isPlaying = false;
    this.playbackRate = 1;
    this.loop = false;
    this.volume = 1;
  }

  /** Воспроизвести аудио */
  play(msg, url, name, duration) {
    // Если это же сообщение — toggle
    if (this.currentMsgId === msg.id && this.audio) {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.audio.play();
        this.isPlaying = true;
        this._updatePlayButton();
      }
      return;
    }

    // Иначе — новое аудио
    this.stop();

    this.audio = new Audio(url);
    this.currentMsgId = msg.id;
    this.audio.playbackRate = this.playbackRate;
    this.audio.loop = this.loop;
    this.audio.volume = this.volume;

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.panel) {
        const total = this.panel.querySelector('[data-total]');
        if (total) total.textContent = formatDuration(this.audio.duration);
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.panel) return;
      const current = this.panel.querySelector('[data-current]');
      const progress = this.panel.querySelector('[data-progress]');
      if (current) current.textContent = formatDuration(this.audio.currentTime);
      if (progress && this.audio.duration) {
        progress.style.width = ((this.audio.currentTime / this.audio.duration) * 100) + '%';
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this._updatePlayButton();
      if (!this.loop) {
        // Автоматически скрыть через 3 секунды
        setTimeout(() => {
          if (!this.isPlaying) this.hide();
        }, 3000);
      }
    });

    this.audio.addEventListener('error', () => {
      console.error('[AudioPlayer] Ошибка воспроизведения');
      this.hide();
    });

    this.isPlaying = true;
    this.audio.play().then(() => {
      this._render(name, duration);
      this._updatePlayButton();
    }).catch((err) => {
      console.error('[AudioPlayer] Play failed:', err);
      this.hide();
    });
  }

  /** Пауза */
  pause() {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
      this._updatePlayButton();
    }
  }

  /** Стоп + скрыть */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.currentMsgId = null;
    this.isPlaying = false;
    this.hide();
  }

  /** Скрыть панель */
  hide() {
    this.panel?.remove();
    this.panel = null;
  }

  /** Обновить иконку play/pause */
  _updatePlayButton() {
    if (!this.panel) return;
    const btn = this.panel.querySelector('[data-play-btn]');
    if (!btn) return;
    btn.innerHTML = this.isPlaying
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  /** Рендер панели */
  _render(name, duration) {
    this.hide();

    const panel = document.createElement('div');
    panel.className = 'audio-player-panel';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: min(360px, calc(100vw - 32px));
      background: #2b2b2b;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      padding: 10px 14px;
      z-index: 9999;
      color: #fff;
      font-family: inherit;
      border: 1px solid #2f2f2f;
      animation: slideDown 0.2s ease-out;
    `;

    // Прогресс-бар сверху
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; height: 2px; background: rgba(255,255,255,0.1); border-radius: 12px 12px 0 0; overflow: hidden; cursor: pointer;';
    const progressFill = document.createElement('div');
    progressFill.setAttribute('data-progress', '');
    progressFill.style.cssText = 'height: 100%; width: 0%; background: #8774e1; transition: width 0.1s linear;';
    progressBar.appendChild(progressFill);
    panel.appendChild(progressBar);

    // Клик по прогресс-бару — перемотка
    progressBar.addEventListener('click', (e) => {
      if (!this.audio || !this.audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      this.audio.currentTime = pct * this.audio.duration;
    });

    // Кнопки управления
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // ◀◀ Назад 15с
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.style.cssText = 'width: 32px; height: 32px; border: none; background: transparent; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%;';
    backBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>';
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.audio) this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
    });
    controls.appendChild(backBtn);

    // ▶/⏸ Play/Pause
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.setAttribute('data-play-btn', '');
    playBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: #8774e1; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%;';
    playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isPlaying) this.pause();
      else {
        this.audio?.play();
        this.isPlaying = true;
        this._updatePlayButton();
      }
    });
    controls.appendChild(playBtn);

    // ▶▶ Вперёд 15с
    const fwdBtn = document.createElement('button');
    fwdBtn.type = 'button';
    fwdBtn.style.cssText = 'width: 32px; height: 32px; border: none; background: transparent; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%;';
    fwdBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z"/></svg>';
    fwdBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.audio) this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
    });
    controls.appendChild(fwdBtn);

    // Инфо: название + время
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; min-width: 0; margin-left: 4px;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    nameEl.textContent = name || 'Аудио';
    info.appendChild(nameEl);

    const timeEl = document.createElement('div');
    timeEl.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.6); display: flex; gap: 6px; font-variant-numeric: tabular-nums;';
    const currentEl = document.createElement('span');
    currentEl.setAttribute('data-current', '');
    currentEl.textContent = '00:00';
    timeEl.appendChild(currentEl);
    const separator = document.createElement('span');
    separator.textContent = '•';
    timeEl.appendChild(separator);
    const totalEl = document.createElement('span');
    totalEl.setAttribute('data-total', '');
    totalEl.textContent = duration || '00:00';
    timeEl.appendChild(totalEl);
    info.appendChild(timeEl);
    controls.appendChild(info);

    // 🔊 Громкость
    const volBtn = document.createElement('button');
    volBtn.type = 'button';
    volBtn.title = 'Громкость';
    volBtn.style.cssText = 'width: 32px; height: 32px; border: none; background: transparent; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%;';
    volBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    volBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.audio) return;
      this.audio.muted = !this.audio.muted;
      volBtn.style.opacity = this.audio.muted ? '0.5' : '1';
    });
    controls.appendChild(volBtn);

    // 1X Скорость
    const rateBtn = document.createElement('button');
    rateBtn.type = 'button';
    rateBtn.style.cssText = 'min-width: 32px; height: 32px; padding: 0 6px; border: none; background: transparent; color: #fff; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 50%;';
    rateBtn.textContent = '1X';
    rateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rates = [1, 1.25, 1.5, 2, 0.5];
      const idx = rates.indexOf(this.playbackRate);
      this.playbackRate = rates[(idx + 1) % rates.length];
      if (this.audio) this.audio.playbackRate = this.playbackRate;
      rateBtn.textContent = this.playbackRate + 'X';
    });
    controls.appendChild(rateBtn);

    // 🔁 Повтор
    const loopBtn = document.createElement('button');
    loopBtn.type = 'button';
    loopBtn.title = 'Повтор';
    loopBtn.style.cssText = 'width: 32px; height: 32px; border: none; background: transparent; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%; opacity: 0.6;';
    loopBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
    loopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loop = !this.loop;
      if (this.audio) this.audio.loop = this.loop;
      loopBtn.style.opacity = this.loop ? '1' : '0.6';
      loopBtn.style.color = this.loop ? '#8774e1' : '#fff';
    });
    controls.appendChild(loopBtn);

    // × Закрыть
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.style.cssText = 'width: 32px; height: 32px; border: none; background: transparent; color: #fff; cursor: pointer; display: grid; place-items: center; border-radius: 50%;';
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stop();
    });
    controls.appendChild(closeBtn);

    panel.appendChild(controls);
    document.body.appendChild(panel);
    this.panel = panel;

    // Анимация
    const style = document.createElement('style');
    style.textContent = '@keyframes slideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }';
    if (!document.getElementById('audio-player-style')) {
      style.id = 'audio-player-style';
      document.head.appendChild(style);
    }
  }
}

export const audioPlayer = new AudioPlayer();
export default audioPlayer;
