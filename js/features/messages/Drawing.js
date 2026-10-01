/**
 * Drawing v3 — рисование в фоне чата.
 * Учтены все баги: parent null, сохранение между чатами, очистка.
 */
import { toast } from '../../ui/Toast.js';

const STORAGE_KEY = 'um_drawings';

export class Drawing {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.container = null;      // .messages (родитель canvas)
    this.active = false;
    this.tool = 'pen';
    this.color = '#2aabee';
    this.size = 4;
    this.chatId = null;
    this.drawing = false;
    this.lastPoint = null;
    this.strokes = [];
    this.currentStroke = null;
    this.resizeObserver = null;
    this._pendingEmoji = null;
  }

  /** Инициализация */
  init(container) {
    // Проверка что контейнер есть
    if (!container) {
      console.warn('[Drawing] Контейнер не передан');
      return;
    }

    // Уже создан — не дублируем
    if (this.canvas && this.canvas.isConnected) return;

    // Ищем .messages
    const messagesEl = container.querySelector?.('.messages') || container;
    if (!messagesEl) {
      console.warn('[Drawing] .messages не найден');
      return;
    }

    this.container = messagesEl;

    // Создаём canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'drawing-canvas';
    canvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      pointer-events: none;
      z-index: 0;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    messagesEl.insertBefore(canvas, messagesEl.firstChild);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Первичный ресайз
    this._resize();

    // ResizeObserver — наблюдаем за .messages
    try {
      this.resizeObserver = new ResizeObserver(() => this._resize());
      this.resizeObserver.observe(messagesEl);
    } catch (e) {
      console.warn('[Drawing] ResizeObserver не поддерживается', e);
    }

    // Скролл — canvas растёт вместе с контентом
    messagesEl.addEventListener('scroll', () => this._onScroll(), { passive: true });

    // События мыши
    canvas.addEventListener('mousedown', (e) => this._onPointerDown(e));
    canvas.addEventListener('mousemove', (e) => this._onPointerMove(e));
    canvas.addEventListener('mouseup', () => this._onPointerUp());
    canvas.addEventListener('mouseleave', () => this._onPointerUp());

    // События touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        this._onPointerDown(e.touches[0]);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.drawing) {
        e.preventDefault();
        this._onPointerMove(e.touches[0]);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => this._onPointerUp());

    console.log('[Drawing] Инициализирован');
  }

  /** Ресайз с защитой от null */
  _resize() {
    if (!this.canvas || !this.container) {
      console.warn('[Drawing._resize] Canvas или container null');
      return;
    }

    if (!this.canvas.isConnected) {
      console.warn('[Drawing._resize] Canvas не в DOM');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = this.container.clientWidth;
    // Высота = максимальная из scrollHeight и clientHeight
    const height = Math.max(this.container.scrollHeight, this.container.clientHeight);

    if (width === 0 || height === 0) {
      // Ещё не отрисовано — подождём
      setTimeout(() => this._resize(), 100);
      return;
    }

    // Сохраняем старый canvas как картинку
    let oldImage = null;
    if (this.canvas.width > 0 && this.canvas.height > 0) {
      try {
        oldImage = this.canvas.toDataURL();
      } catch {}
    }

    // Новый размер
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // Сброс трансформации и масштаб
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Перерисовка штрихов
    this._redrawAll();
  }

  /** Скролл — обновляем размер canvas */
  _onScroll() {
    if (!this.canvas || !this.container) return;
    const dpr = window.devicePixelRatio || 1;
    const height = Math.max(this.container.scrollHeight, this.container.clientHeight);
    const targetPixelHeight = height * dpr;

    if (this.canvas.height !== targetPixelHeight) {
      this.canvas.height = targetPixelHeight;
      this.canvas.style.height = height + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._redrawAll();
    }
  }

  /** Перерисовать всё */
  _redrawAll() {
    if (!this.ctx || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    // Полная очистка
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Рисуем все штрихи ПО ПОРЯДКУ
    for (const stroke of this.strokes) {
      if (stroke.type === 'path') {
        // ВАЖНО: ластик = destination-out (стирает), ручка = source-over (рисует)
        if (stroke.erase) {
          this.ctx.globalCompositeOperation = 'destination-out';
        } else {
          this.ctx.globalCompositeOperation = 'source-over';
        }

        this.ctx.strokeStyle = stroke.erase ? 'rgba(0,0,0,1)' : stroke.color;
        this.ctx.lineWidth = stroke.size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();

        for (let i = 0; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          if (i === 0) this.ctx.moveTo(p.x, p.y);
          else this.ctx.lineTo(p.x, p.y);
        }

        if (stroke.points.length === 1) {
          // Одиночная точка
          this.ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
          this.ctx.fillStyle = stroke.erase ? 'rgba(0,0,0,1)' : stroke.color;
          this.ctx.fill();
        } else {
          this.ctx.stroke();
        }
      } else if (stroke.type === 'emoji') {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.font = stroke.size + 'px serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(stroke.emoji, stroke.x, stroke.y);
      }
    }

    this.ctx.globalCompositeOperation = 'source-over';
  }

  /** Включить режим рисования */
  enable(chatId) {
    this.active = true;
    this.chatId = chatId;

    this.strokes = this._load(chatId);
    this._resize();
    this._redrawAll();

    if (this.canvas) {
      this.canvas.style.pointerEvents = 'auto';
      this.canvas.style.cursor = this.tool === 'eraser' ? 'cell' : 'crosshair';
      this.canvas.style.transform = 'translateY(0)';
    }

    // Сообщения не перехватывают клики
    const messagesEl = document.querySelector('.messages');
    if (messagesEl) {
      // Делаем bubble прозрачными для кликов
      messagesEl.style.userSelect = 'none';
    }

    console.log('[Drawing] Режим включён для чата', chatId, '— рисунков:', this.strokes.length);
  }

  /** Выключить */
  disable() {
    this.active = false;

    if (this.canvas) {
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.cursor = 'default';
    }

    const messagesEl = document.querySelector('.messages');
    if (messagesEl) {
      messagesEl.style.userSelect = '';
    }

    console.log('[Drawing] Режим выключен');
  }

  /** Опустить/поднять */
  slideDown() {
    if (this.canvas) this.canvas.style.transform = 'translateY(100%)';
  }

  slideUp() {
    if (this.canvas) this.canvas.style.transform = 'translateY(0)';
  }

  /** Сменить инструмент */
  setTool(tool) {
    this.tool = tool;
    if (this.canvas) {
      this.canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'emoji' ? 'copy' : 'crosshair');
    }
  }

  setColor(color) {
    this.color = color;
  }

  setSize(size) {
    this.size = size;
  }

  /** Поставить эмодзи */
  placeEmoji(emoji, x, y) {
    const stroke = { type: 'emoji', emoji, x, y, size: 48 };
    this.strokes.push(stroke);
    this._redrawAll();
    this._save();
    this._updateCounter();
  }

  /** ГЛАВНОЕ — очистка всего */
  clear() {
    console.log('[Drawing.clear] Вызван. Было:', this.strokes.length);

    // 1. Очищаем массив
    this.strokes = [];

    // 2. Очищаем canvas
    if (this.canvas && this.ctx) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, w, h);
      const dpr = window.devicePixelRatio || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      console.log('[Drawing.clear] Canvas очищен:', w, 'x', h);
    }

    // 3. Сохраняем пустой массив
    this._save();

    // 4. Обновляем счётчик
    this._updateCounter();

    console.log('[Drawing.clear] ✅ Готово, strokes:', this.strokes.length);
    toast.success('Рисунки удалены');
  }

  /** Есть ли рисунки */
  get hasDrawings() {
    return this.strokes.length > 0;
  }

  /** Обновить счётчик */
  _updateCounter() {
    const counter = document.querySelector('.drawing-counter');
    if (counter) counter.textContent = '🎨 ' + this.strokes.length + ' шт.';
  }

  // ============== Обработчики мыши/touch ==============

  _onPointerDown(e) {
    if (!this.active) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.tool === 'emoji') {
      if (this._pendingEmoji) {
        this.placeEmoji(this._pendingEmoji, x, y);
        this._pendingEmoji = null;
      }
      return;
    }

    this.drawing = true;
    this.currentStroke = {
      type: 'path',
      color: this.tool === 'eraser' ? '#000000' : this.color,
      size: this.tool === 'eraser' ? this.size * 4 : this.size,
      points: [{ x, y }],
      erase: this.tool === 'eraser'
    };

    if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
    }

    this.lastPoint = { x, y };

    // Первая точка
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.currentStroke.size / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.currentStroke.color;
    this.ctx.fill();
  }

  _onPointerMove(e) {
    if (!this.drawing || !this.active || !this.currentStroke) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.currentStroke.points.push({ x, y });

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(x, y);
    this.ctx.strokeStyle = this.currentStroke.color;
    this.ctx.lineWidth = this.currentStroke.size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    this.lastPoint = { x, y };
  }

  _onPointerUp() {
    if (this.drawing && this.currentStroke) {
      this.strokes.push(this.currentStroke);
      this._save();
      this._updateCounter();
    }
    this.drawing = false;
    this.currentStroke = null;
    this.lastPoint = null;
    if (this.ctx) this.ctx.globalCompositeOperation = 'source-over';
  }

  // ============== Сохранение ==============

  _load(chatId) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return all[chatId] || [];
    } catch { return []; }
  }

  _save() {
    if (!this.chatId) return;
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[this.chatId] = this.strokes;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[Drawing] Не удалось сохранить:', e);
    }
  }

  /** Уничтожить */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.ctx = null;
    this.container = null;
  }
}

export default Drawing;
