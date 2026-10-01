/**
 * ContextMenu v2 — переписан с нуля.
 * Гарантированная работа обработчиков.
 */
import { icon } from '../core/Icon.js';

let activeMenu = null;

/**
 * Показать контекстное меню.
 * @param {Array} items — [{ icon, label, onClick, danger, divider, hint }]
 * @param {Object} opts — { x, y, anchor }
 */
export function showContextMenu(items, opts = {}) {
  hideContextMenu();

  const { x = 0, y = 0, anchor = null } = opts;

  const menu = document.createElement('div');
  menu.className = 'ctx';
  menu.setAttribute('role', 'menu');
  menu.style.cssText = `
    position: fixed;
    min-width: 220px;
    padding: 6px;
    background: var(--color-bg-elevated, #fff);
    border-radius: 12px;
    box-shadow: 0 20px 40px -12px rgba(0,0,0,0.5);
    z-index: 999999;
    animation: ctxIn 0.12s ease-out;
    pointer-events: auto;
    font-family: inherit;
  `;

  const close = () => hideContextMenu();

  items.forEach((item) => {
    if (item.divider) {
      const d = document.createElement('div');
      d.style.cssText = 'height: 1px; margin: 4px 0; background: var(--color-divider, rgba(0,0,0,0.08));';
      menu.appendChild(d);
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      color: ${item.danger ? 'var(--color-danger, #e53935)' : 'var(--color-text-primary, #0f1419)'};
      pointer-events: auto;
      position: relative;
      z-index: 1;
      transition: background 0.12s;
    `;

    if (item.icon) {
      const ic = icon(item.icon, 18, 2);
      ic.style.flexShrink = '0';
      ic.style.opacity = '0.8';
      btn.appendChild(ic);
    } else {
      const spacer = document.createElement('span');
      spacer.style.cssText = 'display: inline-block; width: 18px;';
      btn.appendChild(spacer);
    }

    const label = document.createElement('span');
    label.textContent = item.label;
    label.style.flex = '1';
    btn.appendChild(label);

    if (item.hint) {
      const hint = document.createElement('span');
      hint.textContent = item.hint;
      hint.style.cssText = 'font-size: 12px; color: var(--color-text-tertiary);';
      btn.appendChild(hint);
    }

    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--color-bg-hover, #f4f4f5)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');

    // ОБРАБОТЧИК — прямой, без посредников
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[CtxMenu] Нажато:', item.label);
      close();
      try {
        if (typeof item.onClick === 'function') {
          await item.onClick();
        }
      } catch (err) {
        console.error('[CtxMenu] Ошибка в', item.label, ':', err);
      }
    });

    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Позиционирование
  let left = x;
  let top = y;

  if (anchor && !x && !y) {
    const r = anchor.getBoundingClientRect();
    left = r.left;
    top = r.bottom + 4;
  }

  const rect = menu.getBoundingClientRect();
  left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  activeMenu = menu;

  // Закрытие по клику снаружи
  const onOutside = (e) => {
    if (menu.contains(e.target)) return;
    close();
  };
  const onEsc = (e) => {
    if (e.key === 'Escape') close();
  };
  const onScroll = () => close();

  setTimeout(() => {
    document.addEventListener('click', onOutside);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
  }, 10);

  function cleanupListeners() {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onEsc);
    window.removeEventListener('scroll', onScroll, true);
  }

  // Сохраняем cleanup чтобы hideContextMenu мог их снять
  menu._cleanup = cleanupListeners;

  return { hide: close, el: menu };
}

export function hideContextMenu() {
  if (activeMenu) {
    activeMenu._cleanup?.();
    activeMenu.remove();
    activeMenu = null;
  }
  // На всякий случай — снести все оставшиеся
  document.querySelectorAll('.ctx').forEach((m) => m.remove());
}

export default { showContextMenu, hideContextMenu };
