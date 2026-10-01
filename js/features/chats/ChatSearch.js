/**
 * ChatSearch — fuzzy-поиск.
 */
import { store } from '../../core/Store.js';

function score(query, text) {
  query = query.toLowerCase(); text = text.toLowerCase();
  if (!query) return 1;
  if (text.includes(query)) return 100 - text.indexOf(query);
  let s = 0, qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) { s++; qi++; }
  }
  return qi === query.length ? s : 0;
}

export function searchChats(query) {
  if (!query) return store.state.chats;
  return store.state.chats
    .map((c) => {
      const ts = score(query, c.title);
      const msgs = store.state.messages[c.id] || [];
      const ms = msgs.reduce((m, x) => Math.max(m, score(query, x.text || '')), 0);
      return { chat: c, s: Math.max(ts, ms) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.chat);
}

export default { searchChats };
