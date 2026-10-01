/**
 * Система тостов: success / error / info с опциональным action.
 */
import { el, uid } from '../core/Utils.js';
import { icon } from '../core/Icon.js';

const HOST_ID = 'toasts';

export function toast(message, { type = 'info', duration = 3000, action = null } = {}) {
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  const node = el('div', { class: `toast toast--${type}`, role: 'status', dataset: { id: uid('toast') } });

  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  node.append(icon(iconName, 18, 2.2));
  node.append(el('span', { text: message, style: { flex: '1' } }));

  let timer = null;
  const dismiss = () => {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 200);
    clearTimeout(timer);
  };

  if (action) {
    const btn = el('button', {
      class: 'toast__action',
      text: action.label,
      onClick: () => { action.onClick?.(); dismiss(); }
    });
    node.append(btn);
  }

  host.append(node);
  timer = setTimeout(dismiss, duration);
  return { dismiss };
}

toast.success = (msg, opts) => toast(msg, { ...opts, type: 'success' });
toast.error = (msg, opts) => toast(msg, { ...opts, type: 'error' });
toast.info = (msg, opts) => toast(msg, { ...opts, type: 'info' });
