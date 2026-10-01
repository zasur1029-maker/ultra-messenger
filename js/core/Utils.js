/**
 * Утилиты: DOM, debounce, throttle, uid, форматирование.
 * Все функции чистые или stateless.
 */

export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Создаёт DOM-элемент с атрибутами и детьми */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v; // только для доверенного контента
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Безопасная установка текста (XSS-safe) */
export function setText(node, text) { node.textContent = text ?? ''; }

/** Очистка узла */
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/** debounce */
export function debounce(fn, ms = 150) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** throttle с requestAnimationFrame */
export function rafThrottle(fn) {
  let scheduled = false, lastArgs;
  return function (...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(this, lastArgs);
    });
  };
}

/** Уникальный ID */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Экранирование HTML */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Формат времени HH:MM */
export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Формат даты для разделителя */
export function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'long' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Формат размера файла */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/** Формат длительности (секунды) */
export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Хэш строки (djb2) — для генерации цвета аватара */
export function hashCode(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** Детерминированный градиент для аватара по имени */
export function gradientFor(name) {
  const h = hashCode(name || 'user');
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h >> 3) % 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 55%), hsl(${hue2} 70% 45%))`;
}

/** Инициалы */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Сон (await) */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Случайный элемент массива */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Случайный диапазон */
export const rand = (min, max) => min + Math.random() * (max - min);

/** Ограничение */
export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Группировка по ключу */
export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/**
 * Убирает markdown-разметку из текста (для превью).
 * Дубликат из MarkdownLite.js, вынесен сюда для удобства импорта.
 */
export function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '[код]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\|\|([^|]+)\|\|/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ============================================================
   DOM-хелперы (добавлены дополнительно)
   ============================================================ */

/**
 * querySelector-обёртка с контекстом.
 * Использование: $(sel) или $(sel, parent)
 */

/* ============================================================
   DOM-хелперы (querySelector обёртки)
   ============================================================ */

