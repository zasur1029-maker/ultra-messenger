/**
 * Миграция: помечает битые blob URL как broken.
 * Запускается один раз при обновлении.
 */
import { DB } from '../data/DB.js';

export async function migrate() {
  const version = localStorage.getItem('um_migration');
  if (version === 'v2') return;

  console.log('[Migrate] Начинаю миграцию...');

  try {
    const messages = await DB.getAll('messages');
    let updated = 0;

    for (const msg of messages) {
      if (msg.attachments && msg.attachments.length > 0) {
        let changed = false;
        for (const att of msg.attachments) {
          if (att.url && att.url.startsWith('blob:') && att.kind === 'image') {
            att.broken = true;
            att.url = null;
            changed = true;
            updated++;
          }
        }
        if (changed) {
          await DB.put('messages', msg);
        }
      }
    }

    localStorage.setItem('um_migration', 'v2');
    console.log(`[Migrate] ✅ Обновлено ${updated} сообщений`);
  } catch (e) {
    console.error('[Migrate] Ошибка:', e);
  }
}

export default migrate;
