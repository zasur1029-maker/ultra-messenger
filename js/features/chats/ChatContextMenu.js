/**
 * ChatContextMenu — пункты меню чата.
 */
export function chatMenuItems(chat, handlers) {
  return [
    { icon: 'pin', label: chat.pinned ? 'Открепить' : 'Закрепить', onClick: () => handlers.togglePin?.(chat) },
    { icon: 'bellOff', label: chat.muted ? 'Включить звук' : 'Без звука', onClick: () => handlers.toggleMute?.(chat) },
    { icon: 'star', label: chat.favorite ? 'Убрать из избранного' : 'В избранное', onClick: () => handlers.toggleFavorite?.(chat) },
    { divider: true },
    { icon: 'trash', label: 'Удалить', danger: true, onClick: () => handlers.remove?.(chat) }
  ];
}

export default { chatMenuItems };
