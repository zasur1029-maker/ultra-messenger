/**
 * UserSearch v3 — простой и надёжный поиск + создание чата.
 */
import { Users } from './Users.js';
import { modal } from '../../ui/Modal.js';
import { toast } from '../../ui/Toast.js';
import { avatar } from '../../ui/Avatar.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { DB } from '../../data/DB.js';
import { createChat, createMessage } from '../../data/Models.js';

export async function openUserSearch() {
  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Введите @username или имя…';
  input.style.cssText = 'width: 100%; padding: 12px 16px; background: var(--color-bg-hover); border: 2px solid transparent; border-radius: 12px; font-size: 15px; font-family: inherit; color: inherit; outline: none; box-sizing: border-box;';
  input.addEventListener('focus', () => input.style.borderColor = 'var(--color-accent)');
  input.addEventListener('blur', () => input.style.borderColor = 'transparent');
  body.appendChild(input);

  const results = document.createElement('div');
  results.style.cssText = 'display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; min-height: 100px;';
  body.appendChild(results);

  const empty = document.createElement('div');
  empty.style.cssText = 'text-align: center; padding: 32px; color: var(--color-text-tertiary); font-size: 14px;';
  empty.textContent = 'Начните вводить @username';
  results.appendChild(empty);

  let searchTimeout = null;

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { results.replaceChildren(empty); return; }

      const found = await Users.search(q);
      const me = store.state.user;

      results.replaceChildren();
      if (!found.length) {
        const noRes = document.createElement('div');
        noRes.style.cssText = 'text-align: center; padding: 32px; color: var(--color-text-tertiary); font-size: 14px;';
        noRes.textContent = `Никого не найдено по «${q}»`;
        results.appendChild(noRes);
        return;
      }

      found.forEach((u) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer;';
        row.addEventListener('mouseenter', () => row.style.background = 'var(--color-bg-hover)');
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');

        const av = avatar({ name: u.name, gradient: u.gradient, avatarUrl: u.avatar, size: 'md' });
        row.appendChild(av);

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';

        const name = document.createElement('div');
        name.textContent = u.name + (u.username === me.username ? ' (вы)' : '');
        name.style.cssText = 'font-weight: 500; font-size: 15px;';
        info.appendChild(name);

        const uname = document.createElement('div');
        uname.textContent = '@' + u.username;
        uname.style.cssText = 'font-size: 13px; color: var(--color-accent);';
        info.appendChild(uname);

        row.appendChild(info);

        const btn = document.createElement('button');
        btn.textContent = 'Написать';
        btn.style.cssText = 'padding: 8px 14px; border: none; background: var(--color-accent); color: #fff; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;';
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await makeChat(u);
          modalRef.close();
        });
        row.appendChild(btn);

        results.appendChild(row);
      });
    }, 200);
  });

  setTimeout(() => input.focus(), 100);
  const modalRef = modal({ title: '🔍 Найти человека', body, width: '480px' });
}

async function makeChat(otherUser) {
  const me = store.state.user;
  console.log('[Search] Создаю чат', me.username, '↔', otherUser.username);

  // ID чата — ОДИН для обоих (сортируем usernames)
  const ids = [me.username, otherUser.username].sort();
  const chatId = 'pair__' + ids.join('__');
  console.log('[Search] chatId:', chatId);

  // Ищем существующий
  let chat = store.state.chats.find((c) => c.id === chatId);
  if (chat) {
    console.log('[Search] Чат уже есть');
    bus.emit('ui:openChat', chatId);
    return chat;
  }

  // Проверяем в БД
  chat = await DB.get('chats', chatId);
  if (!chat) {
    // Создаём
    chat = {
      id: chatId,
      type: 'personal',
      title: otherUser.name,
      gradient: otherUser.gradient,
      avatar: otherUser.avatar,
      participants: [
        { id: me.username, name: me.name, gradient: me.gradient, avatar: me.avatar },
        { id: otherUser.username, name: otherUser.name, gradient: otherUser.gradient, avatar: otherUser.avatar }
      ],
      pinned: false,
      muted: false,
      unread: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    console.log('[Search] Создан:', chat);
    await DB.put('chats', chat);
  }

  // Добавляем в state
  if (!store.state.chats.find((c) => c.id === chatId)) {
    store.state.chats.push(chat);
  }
  if (!store.state.messages[chatId]) {
    store.state.messages[chatId] = await DB.getMessages(chatId, 500);
  }

  bus.emit('chats:update');
  bus.emit('ui:openChat', chatId);
  toast.success('Чат с ' + otherUser.name + ' открыт');
  return chat;
}

export async function openUserProfile(user) {
  const body = document.createElement('div');
  body.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 16px;';
  body.appendChild(avatar({ name: user.name, gradient: user.gradient, avatarUrl: user.avatar, size: 'xl' }));

  const name = document.createElement('h3');
  name.textContent = user.name;
  name.style.cssText = 'font-size: 22px; font-weight: 600; margin: 8px 0 0;';
  body.appendChild(name);

  const btn = document.createElement('button');
  btn.textContent = '💬 Написать';
  btn.style.cssText = 'width: 100%; padding: 12px; border: none; background: var(--color-accent); color: #fff; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;';
  btn.addEventListener('click', async () => {
    await makeChat(user);
    modalRef.close();
  });
  body.appendChild(btn);

  const modalRef = modal({ title: 'Профиль', body, width: '360px' });
}

export default { openUserSearch, openUserProfile };
