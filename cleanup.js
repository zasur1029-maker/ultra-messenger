/**
 * Очистка ВСЕХ рисунков (локально + на сервере).
 * Запусти из консоли браузера: APP.clearAllDrawings()
 */
window.APP = window.APP || {};

window.APP.clearAllDrawings = async function() {
  console.log('🗑 Очищаю все рисунки…');

  // 1. Локально
  localStorage.removeItem('um_drawings');
  console.log('✅ localStorage очищен');

  // 2. Canvas на всех чатах
  if (window.__DRAWING__) {
    window.__DRAWING__.strokes = [];
    window.__DRAWING__._redrawAll();
    console.log('✅ Canvas очищен');
  }

  // 3. На сервере — через API
  try {
    const chats = (window.__STORE__?.state?.chats) || [];
    for (const chat of chats) {
      await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chat.id, strokes: [] })
      });
    }
    console.log('✅ Сервер очищен');
  } catch (e) {
    console.warn('Ошибка сервера:', e);
  }

  console.log('✅ ВСЁ ОЧИЩЕНО');
};
