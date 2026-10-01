/**
 * Компонент аватара: изображение / градиент с инициалами / онлайн-точка / бейдж.
 */
import { el, initials, gradientFor } from '../core/Utils.js';

export function avatar({ name = '', avatarUrl = null, gradient = null, size = 'md', online = false, badge = null, className = '' } = {}) {
  const sizeClass = size === 'md' ? '' : `avatar--${size}`;
  const node = el('div', {
    class: `avatar ${sizeClass} ${className}`.trim(),
    role: 'img',
    'aria-label': name || 'avatar',
    style: avatarUrl
      ? { backgroundImage: `url(${avatarUrl})` }
      : { background: gradient || gradientFor(name) }
  });
  if (!avatarUrl) node.textContent = initials(name);
  if (online) node.append(el('span', { class: 'avatar__online' }));
  if (badge != null) node.append(el('span', { class: 'avatar__badge', text: String(badge) }));
  return node;
}
