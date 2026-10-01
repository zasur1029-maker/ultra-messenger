/**
 * StickerPicker — большие эмодзи-стикеры.
 */
import { el } from '../../core/Utils.js';

const STICKERS = ['😀','😂','🥰','😎','🤔','😴','🎉','🔥','💯','👍','❤️','🌙','☀️','🌈','⚡','🎮','☕','🍕','🎵','🐱','🐶','🌸','⭐','💎'];

export class StickerPicker {
  constructor() { this.el = null; }

  open(anchor, onPick) {
    this.close();
    const panel = el('div', {
      style: {
        position: 'fixed', width: '340px', maxHeight: '400px',
        background: 'var(--color-bg-elevated)', borderRadius: '16px',
        boxShadow: 'var(--shadow-2xl)', zIndex: '500', overflow: 'auto',
        padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px'
      }
    });
    STICKERS.forEach((emoji) => {
      const btn = el('button', {
        text: emoji,
        style: {
          aspectRatio: '1', fontSize: '40px', background: 'var(--color-bg-hover)',
          border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.15s'
        },
        onClick: () => { onPick?.(emoji); this.close(); }
      });
      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
      btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
      panel.append(btn);
    });
    const r = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 360))}px`;
    panel.style.top = `${Math.max(8, r.top - 420)}px`;
    document.body.append(panel);
    this.el = panel;
    setTimeout(() => document.addEventListener('click', this._outside, { once: true }), 0);
  }

  close() { this.el?.remove(); this.el = null; }
  _outside = (e) => { if (this.el && !this.el.contains(e.target)) this.close(); };
}

export default StickerPicker;
