/**
 * Фабрики моделей данных.
 * Все объекты сериализуемы в IndexedDB (plain objects).
 */
import { uid } from '../core/Utils.js';

export function createUser({ id, name, username, avatar = null, gradient = null, bio = '' } = {}) {
  return {
    id: id || uid('user'),
    name: name || 'Пользователь',
    username: username || null,
    avatar,
    gradient,
    bio,
    createdAt: Date.now()
  };
}

export function createChat({
  id, type = 'personal', title, avatar = null, gradient = null,
  participants = [], ownerId = null, pinned = false, muted = false,
  archived = false, favorite = false, unread = 0, description = ''
} = {}) {
  return {
    id: id || uid('chat'),
    type,                   // personal | group | channel | bot | saved
    title: title || 'Без названия',
    avatar,
    gradient,
    participants,           // [{ id, name, gradient, avatar, role }]
    ownerId,
    pinned,
    muted,
    archived,
    favorite,
    unread,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function createMessage({
  id, chatId, authorId, text = '', type = 'text', attachments = [],
  replyTo = null, forwardedFrom = null, edited = false, editedAt = null,
  reactions = {}, status = 'sent', createdAt
} = {}) {
  return {
    id: id || uid('msg'),
    chatId,
    authorId,
    text,
    type,                   // text | image | file | voice | video_note | sticker | poll | system
    attachments,            // [{ kind, url, name, size, mime, duration, width, height, waveform }]
    replyTo,                // messageId
    forwardedFrom,          // { chatId, authorName }
    edited,
    editedAt,
    reactions,              // { '❤️': [userId, ...], '👍': [...] }
    status,                 // sending | sent | delivered | read
    createdAt: createdAt || Date.now()
  };
}

export function createReaction(emoji, userId) {
  return { emoji, userId, createdAt: Date.now() };
}
