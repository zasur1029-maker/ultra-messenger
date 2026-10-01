/**
 * Skeleton — заглушки загрузки.
 */
import { el } from '../core/Utils.js';

export function skeleton({ width = '100%', height = '16px', radius = '8px' } = {}) {
  return el('div', { class: 'skeleton', style: { width, height, borderRadius: radius } });
}

export function chatItemSkeleton() {
  return el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px' } },
    skeleton({ width: '54px', height: '54px', radius: '50%' }),
    el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' } },
      skeleton({ width: '60%', height: '14px' }),
      skeleton({ width: '80%', height: '12px' })
    )
  );
}

export default { skeleton, chatItemSkeleton };
