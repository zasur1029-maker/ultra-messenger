/**
 * Reactions — быстрые реакции + пикер.
 */
import { el } from '../../core/Utils.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';

export const QUICK_REACTIONS = ['❤️','👍','😂','🔥','😮','😢','🎉','👏'];

export function toggleReaction(chatId, messageId, emoji) {
  const list = store.state.messages[chatId];
  if (!list) return;
  const msg = list.find((m) => m.id === messageId);
  if (!msg) return;
  msg.reactions = msg.reactions || {};
  const users = msg.reactions[emoji] || [];
  const i = users.indexOf(store.state.user.id);
  if (i >= 0) users.splice(i, 1);
  else users.push(store.state.user.id);
  if (users.length === 0) delete msg.reactions[emoji];
  else msg.reactions[emoji] = users;
  bus.emit('messages:update', { chatId, message: msg });
  bus.emit('messages:persist', { chatId });
}

export function openReactionPicker(anchor, chatId, messageId) {
  document.querySelector('.reaction-picker')?.remove();
  const picker = el('div', {
    class: 'reaction-picker',
    style: {
      position: 'fixed', background: 'var(--color-bg-elevated)',
      borderRadius: '999px', padding: '6px', boxShadow: 'var(--shadow-xl)',
      display: 'flex', gap: '2px', zIndex: '1000'
    }
  });
  QUICK_REACTIONS.forEach((emoji) => {
    const btn = el('button', {
      text: emoji,
      style: {
        width: '40px', height: '40px', border: 'none', background: 'transparent',
        borderRadius: '50%', fontSize: '22px', cursor: 'pointer'
      },
      onClick: () => { toggleReaction(chatId, messageId, emoji); picker.remove(); }
    });
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.2)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    picker.append(btn);
  });
  document.body.append(picker);
  const r = anchor.getBoundingClientRect();
  picker.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 360))}px`;
  picker.style.top = `${Math.max(8, r.top - 60)}px`;
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) picker.remove();
    }, { once: true });
  }, 0);
}

export default { toggleReaction, openReactionPicker, QUICK_REACTIONS };
