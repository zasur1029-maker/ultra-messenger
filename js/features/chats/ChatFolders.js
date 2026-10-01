/**
 * ChatFolders — фильтры чатов.
 */
export function filterByFolder(chats, folder) {
  if (folder === 'all') return chats;
  if (folder === 'personal') return chats.filter((c) => c.type === 'personal' || c.type === 'bot');
  if (folder === 'group') return chats.filter((c) => c.type === 'group');
  if (folder === 'channel') return chats.filter((c) => c.type === 'channel');
  if (folder === 'favorite') return chats.filter((c) => c.favorite);
  return chats;
}

export default { filterByFolder };
