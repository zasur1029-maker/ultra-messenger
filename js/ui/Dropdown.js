/**
 * Выпадающее меню у кнопки.
 */
import { el } from '../core/Utils.js';
import { icon } from '../core/Icon.js';

export function showDropdown(anchor, items, { align = 'right' } = {}) {
  document.querySelector('.dropdown')?.remove();

  const menu = el('div', { class: 'dropdown', role: 'menu' });
  items.forEach((item) => {
    if (item.divider) { menu.append(el('div', { class: 'ctx__divider' })); return; }
    const btn = el('button', {
      class: 'dropdown__item',
      role: 'menuitem',
      onClick: () => { hide(); item.onClick?.(); }
    });
    if (item.icon) btn.append(icon(item.icon, 18, 2));
    btn.append(el('span', { text: item.label }));
    menu.append(btn);
  });

  document.body.append(menu);
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = align === 'right' ? rect.right - menuRect.width : rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${rect.bottom + 4}px`;

  const onDoc = (e) => { if (!menu.contains(e.target) && e.target !== anchor) hide(); };
  const onEsc = (e) => { if (e.key === 'Escape') hide(); };
  setTimeout(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onEsc); }, 0);

  function hide() {
    menu.remove();
    document.removeEventListener('click', onDoc);
    document.removeEventListener('keydown', onEsc);
  }
  return { hide };
}
