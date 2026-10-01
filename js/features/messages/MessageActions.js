/**
 * MessageActions — reply/edit/delete/copy/forward.
 */
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { toast } from '../../ui/Toast.js';

export function replyTo(msg) {
  store.state.ui.replyTo = msg;
  bus.emit('ui:replyChanged', msg);
}

export function editMessage(msg) {
  if (msg.authorId !== store.state.user.id) return;
  store.state.ui.editingId = msg.id;
  bus.emit('ui:editChanged', msg);
}

export function deleteMessage(chatId, messageId) {
  const list = store.state.messages[chatId];
  if (!list) return;
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx < 0) return;
  const removed = list.splice(idx, 1)[0];
  bus.emit('messages:render');
  bus.emit('messages:persist', { chatId });
  toast.info('Удалено', {
    action: { label: 'Отменить', onClick: () => { list.splice(idx, 0, removed); bus.emit('messages:render'); } },
    duration: 5000
  });
}

export function copyMessage(msg) {
  navigator.clipboard.writeText(msg.text || '').then(() => toast.success('Скопировано'));
}

export default { replyTo, editMessage, deleteMessage, copyMessage };
