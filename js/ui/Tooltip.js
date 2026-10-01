/**
 * Tooltip — всплывающая подсказка.
 */
import { el } from '../core/Utils.js';

let active = null;

export function attachTooltip(target, text) {
  if (!target) return () => {};
  const show = () => {
    hide();
    const tip = el('div', {
      text,
      style: {
        position: 'fixed', background: 'rgba(0,0,0,0.85)', color: '#fff',
        padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
        pointerEvents: 'none', zIndex: '9999', whiteSpace: 'nowrap',
        transition: 'opacity 0.15s', opacity: '0'
      }
    });
    document.body.append(tip);
    const r = target.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    tip.style.top = `${Math.max(4, r.top - tr.height - 6)}px`;
    tip.style.left = `${Math.max(4, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - 4))}px`;
    requestAnimationFrame(() => tip.style.opacity = '1');
    active = tip;
  };
  const hide = () => { active?.remove(); active = null; };
  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  return () => {
    target.removeEventListener('mouseenter', show);
    target.removeEventListener('mouseleave', hide);
    hide();
  };
}

export default { attach: attachTooltip };
